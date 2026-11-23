-- AI biography must never overwrite a person's own writing:
--  bio_facts : short facts the AI learned from the self-written biography (reused in later generations)
--  bio_draft : a newer AI text waiting for the person to accept or discard
alter table public.people add column if not exists bio_facts jsonb not null default '[]'::jsonb;
alter table public.people add column if not exists bio_draft text;

-- the person themself or an admin decides about the draft: append (add under own text), replace, or discard
create or replace function public.resolve_bio_draft(p_person uuid, p_action text) returns void language plpgsql security definer set search_path = public as $$
declare mine uuid; d text; cur text;
begin
  select position_person_id into mine from profiles where id = auth.uid() and suspended_at is null;
  if not (is_admin() or (mine is not null and mine = p_person)) then raise exception 'अनुमति छैन'; end if;
  select bio_draft, bio into d, cur from people where id = p_person;
  if p_action = 'discard' then
    update people set bio_draft = null where id = p_person;
  elsif d is null or btrim(d) = '' then
    raise exception 'मस्यौदा छैन';
  elsif p_action = 'append' then
    update people set bio = left(btrim(coalesce(cur, '') || E'\n\n' || d), 4000), bio_draft = null, bio_at = now() where id = p_person;
  elsif p_action = 'replace' then
    update people set bio = left(d, 4000), bio_ai = true, bio_draft = null, bio_at = now() where id = p_person;
  else
    raise exception 'अमान्य कार्य';
  end if;
end $$;
revoke all on function public.resolve_bio_draft(uuid, text) from public, anon;
grant execute on function public.resolve_bio_draft(uuid, text) to authenticated;

-- get_people: same visibility rule as bio
do $$
declare d text;
begin
  select pg_get_functiondef('public.get_people(text,uuid)'::regprocedure) into d;
  if position('''bio_draft''' in d) = 0 then
    d := replace(d, '- ''bio''', '- ''bio'' - ''bio_facts'' - ''bio_draft''');
    execute d;
  end if;
end $$;
