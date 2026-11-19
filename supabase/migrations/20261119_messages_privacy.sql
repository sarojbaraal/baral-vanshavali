-- 1) Site messages: public contact form + in-app "report a problem". RPC-only; only admins can read.
create table if not exists public.site_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact','problem')),
  name text, email text, subject text,
  body text not null,
  page text,
  user_id uuid,
  status text not null default 'new' check (status in ('new','read','done')),
  ip_hash text,
  created_at timestamptz not null default now()
);
alter table public.site_messages enable row level security;
revoke all on public.site_messages from anon, authenticated;
create index if not exists site_messages_created_idx on public.site_messages (created_at desc);

create or replace function public.submit_message(p_kind text, p_name text, p_email text, p_subject text, p_body text,
                                                 p_page text default null, p_hp text default null, p_elapsed int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ip text := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  h text := md5(coalesce(nullif(ip, ''), 'unknown') || coalesce(uid::text, ''));
  b text := btrim(coalesce(p_body, ''));
begin
  if p_hp is not null and p_hp <> '' then return jsonb_build_object('ok', true); end if;   -- honeypot: pretend success
  if p_kind not in ('contact','problem') then raise exception 'अमान्य प्रकार'; end if;
  if p_kind = 'problem' and uid is null then raise exception 'समस्या रिपोर्ट गर्न लगइन चाहिन्छ'; end if;
  if char_length(b) < 5 then raise exception 'सन्देश धेरै छोटो छ'; end if;
  if char_length(b) > 4000 then raise exception 'सन्देश धेरै लामो छ (४००० अक्षरसम्म)'; end if;
  if char_length(coalesce(p_name, '')) > 120 or char_length(coalesce(p_subject, '')) > 200 or char_length(coalesce(p_page, '')) > 300 then
    raise exception 'केही खाली ठाउँ धेरै लामो छ';
  end if;
  if p_kind = 'contact' and (p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'सही इमेल ठेगाना राख्नुहोस्'; end if;
  if p_elapsed is not null and p_elapsed < 3000 then raise exception 'कृपया केही सेकेन्डपछि फेरि पठाउनुहोस्'; end if;
  if (select count(*) from site_messages where ip_hash = h and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'धेरै सन्देश पठाइयो; केही बेरपछि फेरि प्रयास गर्नुहोस्';
  end if;
  if (select count(*) from site_messages where created_at > now() - interval '1 day') >= 300 then
    raise exception 'आज धेरै सन्देश आए; भोलि फेरि प्रयास गर्नुहोस्';
  end if;
  insert into site_messages (kind, name, email, subject, body, page, user_id, ip_hash)
  values (p_kind, nullif(btrim(p_name), ''), nullif(btrim(p_email), ''), nullif(btrim(p_subject), ''), b, nullif(p_page, ''), uid, h);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_message(text, text, text, text, text, text, text, int) from public;
grant execute on function public.submit_message(text, text, text, text, text, text, text, int) to anon, authenticated;

create or replace function public.list_messages() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'अनुमति छैन'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) - 'ip_hash' || jsonb_build_object('sender', (select full_name from profiles where id = m.user_id))
                   order by m.created_at desc) from (select * from site_messages order by created_at desc limit 300) m), '[]'::jsonb);
end $$;
revoke all on function public.list_messages() from public, anon;
grant execute on function public.list_messages() to authenticated;

create or replace function public.set_message_status(p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'अनुमति छैन'; end if;
  if p_status not in ('new','read','done') then raise exception 'अमान्य स्थिति'; end if;
  update site_messages set status = p_status where id = p_id;
end $$;
revoke all on function public.set_message_status(uuid, text) from public, anon;
grant execute on function public.set_message_status(uuid, text) to authenticated;

-- 2) Per-person field privacy: people.privacy = {"phone":"me|near|all", ...}; missing key = current rules.
alter table public.people add column if not exists privacy jsonb not null default '{}'::jsonb;

create or replace function public.set_my_privacy(p_privacy jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid; k text; v text; clean jsonb := '{}'::jsonb;
begin
  select position_person_id into pid from profiles where id = auth.uid();
  if pid is null then raise exception 'पहिले आफ्नो स्थान छान्नुहोस्'; end if;
  for k, v in select * from jsonb_each_text(coalesce(p_privacy, '{}'::jsonb)) loop
    if k not in ('phone','birth_bs','address','photo_url') then raise exception 'अमान्य क्षेत्र: %', k; end if;
    if v not in ('all','near','me') then raise exception 'अमान्य छनोट: %', v; end if;
    if v <> 'all' then clean := clean || jsonb_build_object(k, v); end if;
  end loop;
  update people set privacy = clean where id = pid;
  return clean;
end $$;
revoke all on function public.set_my_privacy(jsonb) from public, anon;
grant execute on function public.set_my_privacy(jsonb) to authenticated;

-- get_people: honour people.privacy for everyone except the person themself and admins
create or replace function public.get_people(p_role text default null::text, p_as_person uuid default null::uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  pr profiles; rs text[]; r text; adm boolean; real_admin boolean;
  own uuid; vis uuid[] := '{}'; near uuid[] := '{}'; bsy int;
begin
  select * into pr from profiles where id = auth.uid();
  if not found or pr.suspended_at is not null then return '[]'::jsonb; end if;
  rs := coalesce(pr.roles, '{}');
  real_admin := pr.role = 'admin' or 'admin' = any(rs);
  if pr.role = 'admin' then rs := array['admin','moderator','premium','general'];
  elsif pr.role = 'member' and cardinality(rs) = 0 then rs := array['general']; end if;
  if cardinality(rs) = 0 then return '[]'::jsonb; end if;
  r := case when p_role = any(rs) then p_role
            else (select x from unnest(array['admin','moderator','premium','general']) x where x = any(rs) limit 1) end;
  adm := r = 'admin';

  own := case when real_admin and p_as_person is not null then p_as_person else pr.position_person_id end;

  if not adm then
    vis := vis_ids(pr, own, r);
    near := imm_ids(own) || branch_ids(pr, own);
    if not (real_admin and p_as_person is not null) then
      vis := vis || array(select person_id from view_grants where user_id = pr.id);
    end if;
  end if;
  bsy := extract(year from now())::int + case when now() >= make_date(extract(year from now())::int, 4, 14) then 57 else 56 end;

  return coalesce((select jsonb_agg(
    case
      when adm then to_jsonb(p) || '{"is_locked":false}'::jsonb
      when not coalesce(p.id = any(vis), false) then
        jsonb_build_object('id', p.id, 'name', '••••••', 'gender', p.gender, 'father_id', p.father_id, 'mother_id', p.mother_id,
          'spouse_id', p.spouse_id, 'more_spouse_ids', p.more_spouse_ids, 'is_living', p.is_living, 'created_at', p.created_at, 'is_locked', true)
      else
        (case when r = 'general' and p.id is distinct from own
              then to_jsonb(p) - 'email' - 'phone' - 'address' - 'notes' - 'documents'
              else to_jsonb(p) - 'email' end)
          - case when coalesce(p.is_living, true) and p.birth_bs ~ '^[0-9]{4}' and substr(p.birth_bs, 1, 4)::int >= bsy - 18
                      and not coalesce(p.id = any(near), false)
                 then array['birth_bs', 'photo_url'] else '{}'::text[] end
          - case when p.id is distinct from own
                 then coalesce((select array_agg(e.k) from jsonb_each_text(p.privacy) e(k, v)
                                where e.v = 'me' or (e.v = 'near' and not coalesce(p.id = any(near), false))), '{}'::text[])
                      || array['privacy']
                 else '{}'::text[] end
          || '{"is_locked":false}'::jsonb
          || case when p.id = own then jsonb_build_object('email', p.email) else '{}'::jsonb end
    end order by p.created_at) from people p), '[]'::jsonb);
end $function$;
