-- 20261122b_anchor_requests.sql
-- नाता सन्दर्भ ("म … को … हुँ") अब एडमिनले स्वीकृत गरेपछि मात्र लागू हुन्छ।
-- सदस्यले request_anchor() ले अनुरोध पठाउँछ; एडमिनले review_anchor_request() ले स्वीकृत/अस्वीकृत गर्छ।
-- स्वीकृत हुँदा profiles.custom_anchor सेट हुन्छ। set_my_anchor() बाट सदस्यले अब सीधै सेट गर्न पाउँदैन (हटाउन मात्र पाउँछ; एडमिनले आफ्नो लागि सेट गर्न पाउँछ)।

create table if not exists public.anchor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.people(id) on delete cascade,
  relation_type text not null check (relation_type in ('son','daughter','father','mother','husband','wife','brother','sister')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);
alter table public.anchor_requests enable row level security;
create unique index if not exists anchor_requests_one_pending on public.anchor_requests(user_id) where status = 'pending';

create or replace function public.request_anchor(p_target uuid, p_rel text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'लगइन आवश्यक छ'; end if;
  if p_rel not in ('son','daughter','father','mother','husband','wife','brother','sister') then raise exception 'अमान्य साइनो'; end if;
  if not exists (select 1 from people where id = p_target and (hidden = false or is_admin())) then raise exception 'व्यक्ति फेला परेन'; end if;
  -- एउटा सदस्यको एउटै पर्खाइमा अनुरोध: नयाँले पुरानो पर्खाइलाई बदल्छ
  delete from anchor_requests where user_id = auth.uid() and status = 'pending';
  insert into anchor_requests(user_id, target_id, relation_type) values (auth.uid(), p_target, p_rel);
end $$;

-- आफ्नो पछिल्लो अनुरोध (पर्खाइमा / अस्वीकृत देखाउन)
create or replace function public.my_anchor_request() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  return (select jsonb_build_object('id', r.id, 'status', r.status, 'target_id', r.target_id, 'relation_type', r.relation_type,
            'target_name', p.name, 'created_at', r.created_at)
          from anchor_requests r join people p on p.id = r.target_id and (p.hidden = false or is_admin())
          where r.user_id = auth.uid() order by r.created_at desc limit 1);
end $$;

create or replace function public.admin_anchor_requests() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'अनुमति छैन'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'status', r.status, 'created_at', r.created_at, 'relation_type', r.relation_type,
    'user_id', r.user_id, 'user_name', coalesce(u.full_name, u.email),
    'target_id', r.target_id, 'target_name', p.name, 'target_father', f.name) order by r.created_at desc)
    from anchor_requests r join profiles u on u.id = r.user_id join people p on p.id = r.target_id
    left join people f on f.id = p.father_id where r.status = 'pending'), '[]'::jsonb);
end $$;

create or replace function public.review_anchor_request(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r anchor_requests;
begin
  if not is_admin() then raise exception 'अनुमति छैन'; end if;
  select * into r from anchor_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'अनुरोध फेला परेन वा पहिले नै समीक्षा भइसक्यो'; end if;
  update anchor_requests set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  if p_approve then
    update profiles set custom_anchor = jsonb_build_object('target_id', r.target_id, 'relation_type', r.relation_type) where id = r.user_id;
  end if;
end $$;

-- सदस्यले सीधै सेट गर्न पाउँदैन; हटाउन पाउँछ; एडमिनले आफ्नो लागि सेट गर्न पाउँछ
create or replace function public.set_my_anchor(p_target uuid, p_rel text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_target is null then update profiles set custom_anchor = null where id = auth.uid(); return; end if;
  if not is_admin() then raise exception 'नाता सन्दर्भ एडमिनको स्वीकृतिपछि मात्र लागू हुन्छ — अनुरोध पठाउनुहोस्'; end if;
  if p_rel not in ('son','daughter','father','mother','husband','wife','brother','sister') then raise exception 'अमान्य साइनो'; end if;
  if not exists (select 1 from people where id = p_target) then raise exception 'व्यक्ति फेला परेन'; end if;
  update profiles set custom_anchor = jsonb_build_object('target_id', p_target, 'relation_type', p_rel) where id = auth.uid();
end $$;

revoke all on function public.request_anchor(uuid, text), public.my_anchor_request(),
  public.admin_anchor_requests(), public.review_anchor_request(uuid, boolean) from public, anon;
grant execute on function public.request_anchor(uuid, text), public.my_anchor_request(),
  public.admin_anchor_requests(), public.review_anchor_request(uuid, boolean) to authenticated;
