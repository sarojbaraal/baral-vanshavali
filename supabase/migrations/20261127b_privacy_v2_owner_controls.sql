-- Privacy v2, phase 3 (DB): owner controls.
--  * set_my_privacy v2: explicit 'all' is stored (it must beat the "near" default), new level 'family', more fields.
--  * people_hidden_keys: hiding a date also hides its exactness flag / time.
--  * get_people: adds `locked_fields` (fields that exist but are hidden from this viewer) so the UI can show "🔒 गोप्य".
--  * privacy_audience(): how many members each level reaches (for the live count in the settings dialog).

create or replace function public.people_hidden_keys(p people, own uuid, r text, fam uuid[], nr uuid[], bsy int)
returns text[] language sql stable security definer set search_path = public as $$
  with base as (
    select k from (
      select e.k from jsonb_each_text(coalesce(p.privacy, '{}'::jsonb)) e(k, v)
        where e.v = 'me' or (e.v = 'family' and not (p.id = any(fam))) or (e.v = 'near' and not (p.id = any(nr)))
      union all
      select d.k from unnest(array['phone','address']) d(k)
        where r = 'general' and coalesce(p.is_living, true) and not (coalesce(p.privacy, '{}'::jsonb) ? d.k) and not (p.id = any(nr))
      union all
      select m.k from unnest(array['birth_bs','birth_time','photo_url']) m(k)
        where coalesce(p.is_living, true) and p.birth_bs ~ '^[0-9]{4}' and substr(p.birth_bs, 1, 4)::int >= bsy - 18
          and not (p.id = any(nr))
    ) q)
  select coalesce(array(
    select k from base
    union select 'birth_exact' from base where k = 'birth_bs'
    union select 'birth_time' from base where k = 'birth_bs'
    union select 'marriage_exact' from base where k = 'marriage_bs'
    union select 'divorce_exact' from base where k = 'divorce_bs'), '{}') $$;

create or replace function public.people_locked_fields(p people, hk text[], cols text[]) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array(
    select k from unnest(array['phone','address','birth_bs','birth_time','birth_place','marriage_bs','divorce_bs',
                               'photo_url','education','occupation','organization','facebook']) k
    where (k = any(hk) or not (k = any(cols))) and coalesce(to_jsonb(p) ->> k, '') <> ''), '{}') $$;

revoke all on function public.people_hidden_keys(people, uuid, text, uuid[], uuid[], int),
  public.people_locked_fields(people, text[], text[]) from public, anon, authenticated;

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
              else jsonb_pick(to_jsonb(p), cols) - hk.k
                   || jsonb_build_object('locked_fields', to_jsonb(people_locked_fields(p, hk.k, cols))) end
          || '{"is_locked":false}'::jsonb)
        || jsonb_build_object(
          'father_id', case when p.father_id = any(hid) then null else p.father_id end,
          'mother_id', case when p.mother_id = any(hid) then null else p.mother_id end,
          'spouse_id', case when p.spouse_id = any(hid) then null else p.spouse_id end,
          'more_spouse_ids', case when p.more_spouse_ids is null then null else to_jsonb(array(select x from unnest(p.more_spouse_ids) x where not (x = any(hid)))) end)
    end order by p.created_at)
    from people p
    cross join lateral (select case when adm or p.id = own or not coalesce(p.id = any(vis), false) then '{}'::text[]
                                    else people_hidden_keys(p, own, r, fam, near, bsy) end as k) hk
    where adm or not p.hidden), '[]'::jsonb);
end $$;


create or replace function public.set_my_privacy(p_privacy jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid; k text; v text; clean jsonb := '{}'::jsonb;
begin
  select position_person_id into pid from profiles where id = auth.uid();
  if pid is null then raise exception 'पहिले आफ्नो स्थान छान्नुहोस्'; end if;
  for k, v in select * from jsonb_each_text(coalesce(p_privacy, '{}'::jsonb)) loop
    if k <> all (array['phone','address','birth_bs','birth_time','birth_place','marriage_bs','divorce_bs',
                       'photo_url','education','occupation','organization','facebook']) then
      raise exception 'अमान्य क्षेत्र: %', k; end if;
    if v not in ('all','near','family','me') then raise exception 'अमान्य छनोट: %', v; end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;
  update people set privacy = clean where id = pid;
  return clean;
end $$;
revoke all on function public.set_my_privacy(jsonb) from public, anon;
grant execute on function public.set_my_privacy(jsonb) to authenticated;

-- how many living members each level reaches for the caller's own person
create or replace function public.privacy_audience() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pid uuid; f uuid[]; n uuid[];
begin
  select position_person_id into pid from profiles where id = auth.uid();
  if pid is null then return '{}'::jsonb; end if;
  f := array_remove(public.imm_ids(pid), pid);
  n := array(select distinct x from unnest(public.imm_ids(pid) || public.down_ids(public.near_roots(pid))) x where x <> pid);
  return jsonb_build_object(
    'family', (select count(*) from people where id = any(f) and coalesce(is_living, true) and not hidden),
    'near',   (select count(*) from people where id = any(n) and coalesce(is_living, true) and not hidden),
    'members', (select count(*) from profiles where suspended_at is null));
end $$;
revoke all on function public.privacy_audience() from public, anon;
grant execute on function public.privacy_audience() to authenticated;
