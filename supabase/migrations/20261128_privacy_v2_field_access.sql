-- Privacy v2, phase 4: ask for access to a hidden field.
-- A member can ask the owner for specific hidden fields; the owner grants them for 24h ("once") or "always",
-- sees every grant, and can revoke it at any time. Requests and grants are only reachable through the RPCs below.

create table if not exists public.field_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  fields text[] not null check (cardinality(fields) between 1 and 12),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','denied','cancelled')),
  duration text check (duration in ('once','always')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
create index if not exists field_requests_person_idx on public.field_requests(person_id, status);
create index if not exists field_requests_user_idx on public.field_requests(requester_id, status);

create table if not exists public.field_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  field text not null,
  expires_at timestamptz,                -- null = always
  granted_by uuid not null,
  request_id uuid references public.field_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  unique (user_id, person_id, field)
);
create index if not exists field_grants_user_idx on public.field_grants(user_id, person_id);

create table if not exists public.field_blocks (
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, user_id)
);

alter table public.field_requests enable row level security;
alter table public.field_grants enable row level security;
alter table public.field_blocks enable row level security;
revoke all on public.field_requests, public.field_grants, public.field_blocks from public, anon, authenticated;

-- ---------- helpers (internal) ----------
create or replace function public.lockable_fields() returns text[] language sql immutable as $$
  select array['phone','address','birth_bs','birth_time','birth_place','marriage_bs','divorce_bs',
               'photo_url','education','occupation','organization','facebook'] $$;

-- active grant keys of one viewer for one person (+ the flags that travel with a date)
create or replace function public.field_grant_keys(uid uuid, pid uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array(
    select k from (
      select g.field k from field_grants g
       where g.user_id = uid and g.person_id = pid and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
    ) a
    union select 'birth_exact' from field_grants g where g.user_id = uid and g.person_id = pid and g.field = 'birth_bs' and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
    union select 'marriage_exact' from field_grants g where g.user_id = uid and g.person_id = pid and g.field = 'marriage_bs' and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
    union select 'divorce_exact' from field_grants g where g.user_id = uid and g.person_id = pid and g.field = 'divorce_bs' and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
  ), '{}') $$;

-- who decides for a person: the member who has claimed that person; for a person nobody has claimed, an admin
create or replace function public.field_can_review(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and suspended_at is null and position_person_id = p_person)
      or (exists (select 1 from profiles where id = auth.uid() and suspended_at is null and (role = 'admin' or 'admin' = any(coalesce(roles, '{}'))))
          and not exists (select 1 from profiles where position_person_id = p_person)) $$;

revoke all on function public.lockable_fields(), public.field_grant_keys(uuid, uuid), public.field_can_review(uuid)
  from public, anon, authenticated;

-- ---------- get_people: honour grants (patched in place, idempotent) ----------
do $$ declare d text; begin
  d := pg_get_functiondef('public.get_people(text,uuid)'::regprocedure);
  if position('field_grant_keys' in d) = 0 then
    d := replace(d, 'hid uuid[]; cols text[];', 'hid uuid[]; cols text[]; use_grants boolean;');
    d := replace(d, E'  adm := r = ''admin'';\n', E'  adm := r = ''admin'';\n  use_grants := not (real_admin and p_as_person is not null);\n');
    d := replace(d, 'else people_hidden_keys(p, own, r, fam, near, bsy) end as k,',
      'else array(select x from unnest(people_hidden_keys(p, own, r, fam, near, bsy)) x
                                         where x <> all (field_grant_keys(case when use_grants then pr.id end, p.id))) end as k,');
    d := replace(d, 'else people_optin_cols(p, r) end as c) hk',
      'else people_optin_cols(p, r) || field_grant_keys(case when use_grants then pr.id end, p.id) end as c) hk');
    if position('use_grants boolean' in d) = 0 or position('x <> all' in d) = 0 or position('|| field_grant_keys' in d) = 0
       or position('use_grants := not' in d) = 0 then raise exception 'get_people grant patch did not apply'; end if;
    execute d;
  end if;
end $$;

-- ---------- requests ----------
create or replace function public.request_field_access(p_person uuid, p_fields text[], p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); f text[]; denied timestamptz; rid uuid;
begin
  if me is null or not exists (select 1 from profiles where id = me and suspended_at is null) then raise exception 'लगइन आवश्यक छ'; end if;
  if not exists (select 1 from people where id = p_person and not hidden) then raise exception 'व्यक्ति फेला परेन'; end if;
  if exists (select 1 from profiles where id = me and position_person_id = p_person) then raise exception 'आफ्नै विवरण माग्नु पर्दैन'; end if;
  f := array(select distinct x from unnest(coalesce(p_fields, '{}')) x where x = any (lockable_fields()));
  if cardinality(f) = 0 then raise exception 'कुनै मान्य विवरण छानिएको छैन'; end if;
  if exists (select 1 from field_blocks where person_id = p_person and user_id = me) then
    raise exception 'यो व्यक्तिले तपाईंको अनुरोध स्वीकार गर्न मिल्दैन'; end if;
  if exists (select 1 from field_requests where requester_id = me and person_id = p_person and status = 'pending') then
    raise exception 'यो व्यक्तिको अनुरोध पहिले नै पर्खाइमा छ'; end if;
  if (select count(*) from field_requests where requester_id = me and status = 'pending') >= 5 then
    raise exception 'एकै पटक ५ भन्दा बढी अनुरोध पर्खाइमा राख्न मिल्दैन'; end if;
  select max(decided_at) into denied from field_requests
   where requester_id = me and person_id = p_person and status = 'denied' and decided_at > now() - interval '30 days';
  if denied is not null then
    raise exception 'अस्वीकार भएको अनुरोध ३० दिनपछि मात्र फेरि पठाउन सकिन्छ (%)', to_char(denied + interval '30 days', 'YYYY-MM-DD'); end if;
  insert into field_requests(requester_id, person_id, fields, note)
    values (me, p_person, f, nullif(left(trim(coalesce(p_note, '')), 300), '')) returning id into rid;
  return rid;
end $$;

create or replace function public.cancel_field_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update field_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
   where id = p_id and requester_id = auth.uid() and status = 'pending';
end $$;

-- decision: once (24h) | always | deny | block (deny + never again)
create or replace function public.review_field_request(p_id uuid, p_decision text, p_fields text[] default null) returns void
language plpgsql security definer set search_path = public as $$
declare r field_requests; f text[]; exp timestamptz;
begin
  if p_decision not in ('once','always','deny','block') then raise exception 'अमान्य निर्णय'; end if;
  select * into r from field_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'अनुरोध फेला परेन वा पहिले नै निर्णय भइसकेको छ'; end if;
  if not field_can_review(r.person_id) then raise exception 'यो अनुरोधमा निर्णय गर्ने अधिकार तपाईंलाई छैन'; end if;
  if p_decision in ('deny','block') then
    update field_requests set status = 'denied', decided_at = now(), decided_by = auth.uid() where id = p_id;
    if p_decision = 'block' then
      insert into field_blocks(person_id, user_id) values (r.person_id, r.requester_id) on conflict do nothing; end if;
    return;
  end if;
  f := case when p_fields is null then r.fields else array(select x from unnest(p_fields) x where x = any (r.fields)) end;
  if cardinality(f) = 0 then raise exception 'कुनै विवरण छानिएको छैन'; end if;
  exp := case when p_decision = 'once' then now() + interval '24 hours' else null end;
  insert into field_grants(user_id, person_id, field, expires_at, granted_by, request_id)
    select r.requester_id, r.person_id, x, exp, auth.uid(), r.id from unnest(f) x
  on conflict (user_id, person_id, field) do update
    set expires_at = excluded.expires_at, granted_by = excluded.granted_by, request_id = excluded.request_id,
        created_at = now(), revoked_at = null, revoked_by = null;
  update field_requests set status = 'approved', duration = p_decision, decided_at = now(), decided_by = auth.uid() where id = p_id;
end $$;

create or replace function public.revoke_field_grant(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g field_grants;
begin
  select * into g from field_grants where id = p_id and revoked_at is null;
  if not found then return; end if;
  if not field_can_review(g.person_id) then raise exception 'यो अनुमति फिर्ता लिने अधिकार तपाईंलाई छैन'; end if;
  update field_grants set revoked_at = now(), revoked_by = auth.uid() where id = p_id;
end $$;

-- everything the caller needs for the "पहुँच अनुरोध" dialog, in one call
create or replace function public.my_field_access() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'person_id', r.person_id, 'person', pe.name,
        'requester', coalesce(nullif(pr.full_name, ''), pr.email), 'requester_person', rp.name, 'fields', r.fields, 'note', r.note,
        'created_at', r.created_at) order by r.created_at)
      from field_requests r join people pe on pe.id = r.person_id join profiles pr on pr.id = r.requester_id
      left join people rp on rp.id = pr.position_person_id
      where r.status = 'pending' and field_can_review(r.person_id)), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(x order by (x->>'created_at') desc) from (
        select jsonb_build_object('id', r.id, 'person_id', r.person_id, 'person', pe.name, 'fields', r.fields, 'status', r.status,
          'duration', r.duration, 'created_at', r.created_at, 'decided_at', r.decided_at) x
        from field_requests r join people pe on pe.id = r.person_id
        where r.requester_id = me order by r.created_at desc limit 30) q), '[]'::jsonb),
    'given', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'person_id', g.person_id, 'person', pe.name, 'field', g.field,
        'grantee', coalesce(nullif(pr.full_name, ''), pr.email), 'expires_at', g.expires_at, 'created_at', g.created_at)
        order by g.created_at desc)
      from field_grants g join people pe on pe.id = g.person_id join profiles pr on pr.id = g.user_id
      where g.revoked_at is null and (g.expires_at is null or g.expires_at > now()) and field_can_review(g.person_id)), '[]'::jsonb),
    'received', coalesce((select jsonb_agg(jsonb_build_object('person_id', g.person_id, 'person', pe.name, 'field', g.field,
        'expires_at', g.expires_at) order by g.created_at desc)
      from field_grants g join people pe on pe.id = g.person_id
      where g.user_id = me and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())), '[]'::jsonb));
end $$;

revoke all on function public.request_field_access(uuid, text[], text), public.cancel_field_request(uuid),
  public.review_field_request(uuid, text, text[]), public.revoke_field_grant(uuid), public.my_field_access() from public, anon;
grant execute on function public.request_field_access(uuid, text[], text), public.cancel_field_request(uuid),
  public.review_field_request(uuid, text, text[]), public.revoke_field_grant(uuid), public.my_field_access() to authenticated;
