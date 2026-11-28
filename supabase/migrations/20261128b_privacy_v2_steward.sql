-- Privacy v2, phase 5: stewardship for members who have not claimed an account + a privacy log.
--  * A person nobody has claimed is looked after by an admin, or by a moderator whose own branch they belong to
--    (person is "near" the moderator). The steward sets the person's privacy and answers access requests.
--  * Every change of privacy and every steward decision is logged. The owner (once they claim the person) sees
--    what others changed on their behalf; admins can read the whole log.

create table if not exists public.privacy_log (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  actor_id uuid not null,
  kind text not null check (kind in ('owner_set','steward_set','steward_grant','steward_revoke')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists privacy_log_person_idx on public.privacy_log(person_id, created_at desc);
alter table public.privacy_log enable row level security;
revoke all on public.privacy_log from public, anon, authenticated;

-- one validation for owner and steward writes
create or replace function public.privacy_clean(p_privacy jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v text; clean jsonb := '{}'::jsonb;
begin
  for k, v in select * from jsonb_each_text(coalesce(p_privacy, '{}'::jsonb)) loop
    if k <> all (array['phone','address','birth_bs','birth_time','birth_place','marriage_bs','divorce_bs',
                       'photo_url','education','occupation','organization','facebook']) then
      raise exception 'अमान्य क्षेत्र: %', k; end if;
    if v not in ('all','near','family','me') then raise exception 'अमान्य छनोट: %', v; end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;
  return clean;
end $$;

-- may the caller look after this unclaimed person?
create or replace function public.can_steward(p_person uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare pr profiles;
begin
  select * into pr from profiles where id = auth.uid() and suspended_at is null;
  if not found or not exists (select 1 from people where id = p_person) then return false; end if;
  if exists (select 1 from profiles where position_person_id = p_person) then return false; end if;   -- claimed: owner decides
  if pr.role = 'admin' or 'admin' = any(coalesce(pr.roles, '{}')) then return true; end if;
  return ('moderator' = any(coalesce(pr.roles, '{}')) or pr.role = 'moderator')
         and pr.position_person_id is not null
         and p_person = any (public.near_subjects(pr.position_person_id));
end $$;

-- the owner decides for a claimed person; a steward for an unclaimed one
create or replace function public.field_can_review(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and suspended_at is null and position_person_id = p_person)
      or public.can_steward(p_person) $$;

revoke all on function public.privacy_clean(jsonb), public.can_steward(uuid), public.field_can_review(uuid) from public, anon, authenticated;
grant execute on function public.can_steward(uuid) to authenticated;

create or replace function public.set_my_privacy(p_privacy jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; clean jsonb;
begin
  select position_person_id into pid from profiles where id = auth.uid();
  if pid is null then raise exception 'पहिले आफ्नो स्थान छान्नुहोस्'; end if;
  clean := public.privacy_clean(p_privacy);
  update people set privacy = clean where id = pid;
  insert into privacy_log(person_id, actor_id, kind, detail) values (pid, auth.uid(), 'owner_set', jsonb_build_object('privacy', clean));
  return clean;
end $$;

create or replace function public.set_person_privacy(p_person uuid, p_privacy jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare clean jsonb;
begin
  if not public.can_steward(p_person) then raise exception 'यो व्यक्तिको गोपनीयता तपाईंले बदल्न मिल्दैन'; end if;
  clean := public.privacy_clean(p_privacy);
  update people set privacy = clean where id = p_person;
  insert into privacy_log(person_id, actor_id, kind, detail) values (p_person, auth.uid(), 'steward_set', jsonb_build_object('privacy', clean));
  return clean;
end $$;

-- current settings of an unclaimed person, for the steward's dialog
create or replace function public.steward_privacy(p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_steward(p_person) then
    return jsonb_build_object('can', false, 'claimed', exists (select 1 from profiles where position_person_id = p_person));
  end if;
  return jsonb_build_object('can', true, 'claimed', false, 'privacy', coalesce((select privacy from people where id = p_person), '{}'::jsonb));
end $$;

-- live counts for the dialog: own person, or (steward) another person
drop function if exists public.privacy_audience();
create or replace function public.privacy_audience(p_person uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pid uuid; f uuid[]; n uuid[];
begin
  if p_person is null then select position_person_id into pid from profiles where id = auth.uid();
  elsif public.can_steward(p_person) then pid := p_person;
  else raise exception 'अनुमति छैन'; end if;
  if pid is null then return '{}'::jsonb; end if;
  f := array_remove(public.imm_ids(pid), pid);
  n := array(select distinct x from unnest(public.imm_ids(pid) || public.down_ids(public.near_roots(pid))) x where x <> pid);
  return jsonb_build_object(
    'family', (select count(*) from people where id = any(f) and coalesce(is_living, true) and not hidden),
    'near',   (select count(*) from people where id = any(n) and coalesce(is_living, true) and not hidden),
    'members', (select count(*) from profiles where suspended_at is null));
end $$;

-- steward decisions are logged too
create or replace function public.review_field_request(p_id uuid, p_decision text, p_fields text[] default null) returns void
language plpgsql security definer set search_path = public as $$
declare r field_requests; f text[]; exp timestamptz; steward boolean;
begin
  if p_decision not in ('once','always','deny','block') then raise exception 'अमान्य निर्णय'; end if;
  select * into r from field_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'अनुरोध फेला परेन वा पहिले नै निर्णय भइसकेको छ'; end if;
  if not public.field_can_review(r.person_id) then raise exception 'यो अनुरोधमा निर्णय गर्ने अधिकार तपाईंलाई छैन'; end if;
  steward := not exists (select 1 from profiles where id = auth.uid() and position_person_id = r.person_id);
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
  if steward then
    insert into privacy_log(person_id, actor_id, kind, detail)
      values (r.person_id, auth.uid(), 'steward_grant', jsonb_build_object('to', r.requester_id, 'fields', f, 'duration', p_decision));
  end if;
end $$;

create or replace function public.revoke_field_grant(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g field_grants;
begin
  select * into g from field_grants where id = p_id and revoked_at is null;
  if not found then return; end if;
  if not public.field_can_review(g.person_id) then raise exception 'यो अनुमति फिर्ता लिने अधिकार तपाईंलाई छैन'; end if;
  update field_grants set revoked_at = now(), revoked_by = auth.uid() where id = p_id;
  if not exists (select 1 from profiles where id = auth.uid() and position_person_id = g.person_id) then
    insert into privacy_log(person_id, actor_id, kind, detail)
      values (g.person_id, auth.uid(), 'steward_revoke', jsonb_build_object('to', g.user_id, 'field', g.field));
  end if;
end $$;

-- what others changed on my behalf (shown to me in the privacy dialog)
create or replace function public.my_privacy_log() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'at', l.created_at, 'by', coalesce(nullif(pr.full_name, ''), pr.email), 'detail', l.detail)
           order by l.created_at desc), '[]'::jsonb)
  from (select * from privacy_log where person_id = (select position_person_id from profiles where id = auth.uid())
          and actor_id <> auth.uid() order by created_at desc limit 20) l
  left join profiles pr on pr.id = l.actor_id $$;

-- admins read the whole log
create or replace function public.admin_privacy_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and suspended_at is null and (role = 'admin' or 'admin' = any(coalesce(roles, '{}')))) then
    raise exception 'एडमिन मात्र'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'at', l.created_at, 'person', pe.name,
             'by', coalesce(nullif(pr.full_name, ''), pr.email), 'detail', l.detail) order by l.created_at desc)
           from (select * from privacy_log order by created_at desc limit 100) l
           join people pe on pe.id = l.person_id left join profiles pr on pr.id = l.actor_id), '[]'::jsonb);
end $$;

revoke all on function public.set_my_privacy(jsonb), public.set_person_privacy(uuid, jsonb), public.steward_privacy(uuid),
  public.privacy_audience(uuid), public.my_privacy_log(), public.admin_privacy_log() from public, anon;
grant execute on function public.set_my_privacy(jsonb), public.set_person_privacy(uuid, jsonb), public.steward_privacy(uuid),
  public.privacy_audience(uuid), public.my_privacy_log(), public.admin_privacy_log() to authenticated;
revoke all on function public.review_field_request(uuid, text, text[]), public.revoke_field_grant(uuid) from public, anon;
grant execute on function public.review_field_request(uuid, text, text[]), public.revoke_field_grant(uuid) to authenticated;
