-- एडमिनले कुनै सदस्यलाई लुकाउन सक्ने: लुकाइएको व्यक्ति एडमिन (एडमिन भूमिकामा हेर्दा) बाहेक कसैलाई get_people ले दिँदैन,
-- र अरूका पुर्खा/जीवनसाथी लिङ्कहरूबाट पनि हटाइन्छ। छाप्ने/निर्यात (क्लाइन्ट) मा एडमिनले समेत देख्दैन।
alter table public.people add column if not exists hidden boolean not null default false;

create or replace function public.admin_set_hidden(p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'admin मात्र'; end if;
  update people set hidden = coalesce(p_hidden, false) where id = p_id;
  if not found then raise exception 'व्यक्ति फेला परेन'; end if;
end $$;
revoke all on function public.admin_set_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_hidden(uuid, boolean) to authenticated;

create or replace function public.get_people(p_role text default null, p_as_person uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  pr profiles; rs text[]; r text; adm boolean; real_admin boolean;
  own uuid; vis uuid[] := '{}'; near uuid[] := '{}'; bsy int; hid uuid[];
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
  hid := array(select id from people where hidden);

  return coalesce((select jsonb_agg(
    case
      when adm then to_jsonb(p) || '{"is_locked":false}'::jsonb
      when not coalesce(p.id = any(vis), false) then
        jsonb_build_object('id', p.id, 'name', '••••••', 'gender', p.gender,
          'father_id', case when p.father_id = any(hid) then null else p.father_id end,
          'mother_id', case when p.mother_id = any(hid) then null else p.mother_id end,
          'spouse_id', case when p.spouse_id = any(hid) then null else p.spouse_id end,
          'more_spouse_ids', case when p.more_spouse_ids is null then null else to_jsonb(array(select x from unnest(p.more_spouse_ids) x where not (x = any(hid)))) end,
          'is_living', p.is_living, 'created_at', p.created_at, 'is_locked', true)
      else
        ((case when r = 'general' and p.id is distinct from own
              then to_jsonb(p) - 'email' - 'phone' - 'address' - 'notes' - 'documents' - 'bio'
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
          || case when p.id = own then jsonb_build_object('email', p.email) else '{}'::jsonb end)
        || jsonb_build_object(
          'father_id', case when p.father_id = any(hid) then null else p.father_id end,
          'mother_id', case when p.mother_id = any(hid) then null else p.mother_id end,
          'spouse_id', case when p.spouse_id = any(hid) then null else p.spouse_id end,
          'more_spouse_ids', case when p.more_spouse_ids is null then null else to_jsonb(array(select x from unnest(p.more_spouse_ids) x where not (x = any(hid)))) end)
    end order by p.created_at) from people p where adm or not p.hidden), '[]'::jsonb);
end $function$;
