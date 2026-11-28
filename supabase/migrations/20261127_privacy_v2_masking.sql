-- Privacy v2, phase 2: deny-by-default masking in get_people + owner-anchored "near".
--
-- Rules (decided with the owner, 2026-11-27):
--  * Allowlist, not blacklist: a new people column is invisible to non-admins until classified below.
--  * "near" of a subject = their immediate family + the branch of their father's grandfather
--    + the branch of their mother's grandfather (+ spouse's paternal branch). Anchored on the
--    SUBJECT, not on the viewer.
--  * premium / moderator keep seeing phone, address, notes, documents, bio_facts, bio_draft.
--  * general now also sees `bio` (the single public biography).
--  * Owner levels: absent/'all' | 'near' | 'family' | 'me'. Unset defaults to 'near' for a living
--    member's phone/address (birth date stays open unless the owner hides it), applied to `general` viewers only (trusted roles skip defaults).

-- ---------- helpers (internal; not callable by API roles) ----------
create or replace function public.jsonb_pick(j jsonb, keys text[]) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(k, j -> k), '{}'::jsonb) from unnest(keys) k where j ? k $$;

create or replace function public.people_public_cols() returns text[] language sql immutable as $$
  select array['id','name','gender','father_id','mother_id','spouse_id','more_spouse_ids','is_living',
    'birth_bs','birth_exact','birth_time','birth_place','death_bs','death_exact','death_place','death_tithi',
    'death_reason','marriage_bs','marriage_exact','divorce_bs','divorce_exact','marital_status',
    'maiden_name','married_name','education','occupation','organization','facebook','photo_url',
    'ai_summary','ai_tags','bio','bio_ai','bio_at','created_at'] $$;
create or replace function public.people_trusted_cols() returns text[] language sql immutable as $$
  select array['phone','address','notes','documents','bio_facts','bio_draft'] $$;
create or replace function public.people_own_cols() returns text[] language sql immutable as $$
  select array['email','privacy','ai_summary_self','ai_summary_self_at','avatar_url','login_provider'] $$;
create or replace function public.people_admin_cols() returns text[] language sql immutable as $$
  select array['hidden'] $$;

create or replace function public.gf_root(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select f.father_id from people p join people f on f.id = p.father_id where p.id = pid and f.father_id is not null),
    (select father_id from people where id = pid)) $$;

create or replace function public.mgf_root(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select mf.father_id from people p join people m on m.id = p.mother_id join people mf on mf.id = m.father_id
      where p.id = pid and mf.father_id is not null),
    (select m.father_id from people p join people m on m.id = p.mother_id where p.id = pid)) $$;

create or replace function public.near_roots(pid uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array(select r from (
    select public.gf_root(pid) r
    union select public.mgf_root(pid)
    union select public.gf_root(s) from people p, unnest(array[p.spouse_id] || coalesce(p.more_spouse_ids, '{}')) s
      where p.id = pid and s is not null
  ) q where r is not null), '{}') $$;

-- blood ancestors of a person and of their spouses (a viewer is in down(root) iff root is in this set)
create or replace function public.anc_ids(own uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array(
    with recursive seed(id) as (
      select own where own is not null
      union select s from people p, unnest(array[p.spouse_id] || coalesce(p.more_spouse_ids, '{}')) s
        where p.id = own and s is not null),
    up(id) as (
      select id from seed
      union select x from up join people q on q.id = up.id, unnest(array[q.father_id, q.mother_id]) x where x is not null)
    select id from up), '{}') $$;

-- subjects for whom this viewer counts as "near"
create or replace function public.near_subjects(own uuid) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare a uuid[] := public.anc_ids(own);
begin
  if own is null then return '{}'; end if;
  return public.imm_ids(own) || array(
    select p.id from people p
      left join people f on f.id = p.father_id left join people ff on ff.id = f.father_id
      left join people m on m.id = p.mother_id left join people mf on mf.id = m.father_id left join people mff on mff.id = mf.father_id
    where coalesce(ff.id, f.id) = any(a) or coalesce(mff.id, mf.id) = any(a)
       or exists (select 1 from unnest(array[p.spouse_id] || coalesce(p.more_spouse_ids, '{}')) s
                  join people sp on sp.id = s left join people sf on sf.id = sp.father_id left join people sff on sff.id = sf.father_id
                  where coalesce(sff.id, sf.id) = any(a)));
end $$;

-- keys of one person's row that this viewer must not see
create or replace function public.people_hidden_keys(p people, own uuid, r text, fam uuid[], nr uuid[], bsy int)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array(select distinct k from (
    select e.k from jsonb_each_text(coalesce(p.privacy, '{}'::jsonb)) e(k, v)
      where e.v = 'me' or (e.v = 'family' and not (p.id = any(fam))) or (e.v = 'near' and not (p.id = any(nr)))
    union all
    select d.k from unnest(array['phone','address']) d(k)
      where r = 'general' and coalesce(p.is_living, true) and not (coalesce(p.privacy, '{}'::jsonb) ? d.k) and not (p.id = any(nr))
    union all
    select m.k from unnest(array['birth_bs','birth_time','photo_url']) m(k)
      where coalesce(p.is_living, true) and p.birth_bs ~ '^[0-9]{4}' and substr(p.birth_bs, 1, 4)::int >= bsy - 18
        and not (p.id = any(nr))
  ) q), '{}') $$;

revoke all on function public.jsonb_pick(jsonb, text[]), public.people_public_cols(), public.people_trusted_cols(),
  public.people_own_cols(), public.people_admin_cols(), public.gf_root(uuid), public.mgf_root(uuid),
  public.near_roots(uuid), public.anc_ids(uuid), public.near_subjects(uuid),
  public.people_hidden_keys(people, uuid, text, uuid[], uuid[], int) from public, anon, authenticated;

-- ---------- get_people ----------
create or replace function public.get_people(p_role text default null, p_as_person uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pr profiles; rs text[]; r text; adm boolean; real_admin boolean;
  own uuid; vis uuid[] := '{}'; near uuid[] := '{}'; fam uuid[] := '{}'; bsy int; hid uuid[]; cols text[];
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
    fam := imm_ids(own);
    near := case when own is not null then near_subjects(own) else fam || branch_ids(pr, own) end;
    if not (real_admin and p_as_person is not null) then
      vis := vis || array(select person_id from view_grants where user_id = pr.id);
    end if;
    cols := people_public_cols() || case when r in ('premium','moderator') then people_trusted_cols() else '{}'::text[] end;
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
        (case when p.id = own then to_jsonb(p) - people_admin_cols()
              else jsonb_pick(to_jsonb(p), cols) - people_hidden_keys(p, own, r, fam, near, bsy) end
          || '{"is_locked":false}'::jsonb)
        || jsonb_build_object(
          'father_id', case when p.father_id = any(hid) then null else p.father_id end,
          'mother_id', case when p.mother_id = any(hid) then null else p.mother_id end,
          'spouse_id', case when p.spouse_id = any(hid) then null else p.spouse_id end,
          'more_spouse_ids', case when p.more_spouse_ids is null then null else to_jsonb(array(select x from unnest(p.more_spouse_ids) x where not (x = any(hid)))) end)
    end order by p.created_at) from people p where adm or not p.hidden), '[]'::jsonb);
end $$;
