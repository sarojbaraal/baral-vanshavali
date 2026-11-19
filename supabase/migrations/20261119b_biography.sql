-- Biography on people: bio (text), bio_ai (written by AI, not yet edited by a person), bio_at (when generated / last saved)
alter table public.people add column if not exists bio text;
alter table public.people add column if not exists bio_ai boolean not null default false;
alter table public.people add column if not exists bio_at timestamptz;

-- the person themself or an admin may write/edit the biography; saving by hand clears the AI label
create or replace function public.set_bio(p_person uuid, p_bio text) returns void language plpgsql security definer set search_path = public as $$
declare mine uuid;
begin
  select position_person_id into mine from profiles where id = auth.uid() and suspended_at is null;
  if not (is_admin() or (mine is not null and mine = p_person)) then raise exception 'अनुमति छैन'; end if;
  if char_length(coalesce(p_bio, '')) > 4000 then raise exception 'जीवनी धेरै लामो छ (४००० अक्षरसम्म)'; end if;
  update people set bio = nullif(btrim(p_bio), ''), bio_ai = false, bio_at = now() where id = p_person;
end $$;
revoke all on function public.set_bio(uuid, text) from public, anon;
grant execute on function public.set_bio(uuid, text) to authenticated;

-- get_people: other general-role members do not receive the biography (same rule as notes)
do $$
declare d text;
begin
  select pg_get_functiondef('public.get_people(text,uuid)'::regprocedure) into d;
  if position('''bio''' in d) = 0 then
    d := replace(d, '- ''documents''', '- ''documents'' - ''bio''');
    execute d;
  end if;
end $$;
