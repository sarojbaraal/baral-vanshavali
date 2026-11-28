-- Privacy v2, phase 6 (applied live as `privacy_v2_phase6`).
-- F11: the public invite lookup no longer exposes a full birth date (year only)
create or replace function public.invite_info(p_token text)
 returns table(person_name text, father_name text, birth_bs text)
 language sql stable security definer set search_path to 'public' as $$
  select p.name, f.name, left(p.birth_bs::text, 4) from invites i join people p on p.id = i.person_id left join people f on f.id = p.father_id
  where i.token = p_token and i.used_at is null and i.expires_at > now() $$;

-- F9: these tables are reached only through RPCs (no policies exist); drop the unused table privileges
revoke all on public.view_grants, public.view_requests, public.anchor_requests from anon, authenticated;

-- F7: when an owner/steward makes birth date or address less public, AI text built from it is cleared
-- (it is rewritten automatically from public-level facts the next time the profile is opened)
create or replace function public.privacy_open(p jsonb, k text, dflt boolean) returns boolean
language sql immutable as $$
  select coalesce(p ->> k, '') = 'all' or (coalesce(p ->> k, '') = '' and dflt) $$;

create or replace function public.privacy_reset_ai(pid uuid, old jsonb, new jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare birth boolean; addr boolean;
begin
  birth := public.privacy_open(old, 'birth_bs', true) and not public.privacy_open(new, 'birth_bs', true);
  addr  := public.privacy_open(old, 'address', false) and not public.privacy_open(new, 'address', false);
  if birth or addr then
    update people set bio = case when bio_ai then null else bio end,
                      bio_at = case when bio_ai then null else bio_at end,
                      bio_draft = null,
                      ai_summary = case when birth then null else ai_summary end
     where id = pid;
  end if;
end $$;
revoke all on function public.privacy_open(jsonb, text, boolean), public.privacy_reset_ai(uuid, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.set_my_privacy(p_privacy jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; clean jsonb; old jsonb;
begin
  select position_person_id into pid from profiles where id = auth.uid();
  if pid is null then raise exception 'पहिले आफ्नो स्थान छान्नुहोस्'; end if;
  clean := public.privacy_clean(p_privacy);
  select privacy into old from people where id = pid;
  update people set privacy = clean where id = pid;
  perform public.privacy_reset_ai(pid, coalesce(old, '{}'::jsonb), clean);
  insert into privacy_log(person_id, actor_id, kind, detail) values (pid, auth.uid(), 'owner_set', jsonb_build_object('privacy', clean));
  return clean;
end $$;

create or replace function public.set_person_privacy(p_person uuid, p_privacy jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare clean jsonb; old jsonb;
begin
  if not public.can_steward(p_person) then raise exception 'यो व्यक्तिको गोपनीयता तपाईंले बदल्न मिल्दैन'; end if;
  clean := public.privacy_clean(p_privacy);
  select privacy into old from people where id = p_person;
  update people set privacy = clean where id = p_person;
  perform public.privacy_reset_ai(p_person, coalesce(old, '{}'::jsonb), clean);
  insert into privacy_log(person_id, actor_id, kind, detail) values (p_person, auth.uid(), 'steward_set', jsonb_build_object('privacy', clean));
  return clean;
end $$;
revoke all on function public.set_my_privacy(jsonb), public.set_person_privacy(uuid, jsonb) from public, anon;
grant execute on function public.set_my_privacy(jsonb), public.set_person_privacy(uuid, jsonb) to authenticated;

-- first-time AI biography: at most one attempt per person per hour, and a daily cap, enforced by the edge function
create table if not exists public.bio_attempts (
  person_id uuid primary key references public.people(id) on delete cascade,
  tried_at timestamptz not null default now()
);
alter table public.bio_attempts enable row level security;
revoke all on public.bio_attempts from public, anon, authenticated;

-- advisor: pure helper functions get a fixed search_path
alter function public.people_public_cols() set search_path = public;
alter function public.people_trusted_cols() set search_path = public;
alter function public.people_own_cols() set search_path = public;
alter function public.people_admin_cols() set search_path = public;
alter function public.jsonb_pick(jsonb, text[]) set search_path = public;
alter function public.lockable_fields() set search_path = public;
alter function public.privacy_clean(jsonb) set search_path = public;
alter function public.privacy_open(jsonb, text, boolean) set search_path = public;
