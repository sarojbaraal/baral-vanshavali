-- Privacy v2, phase 3 (DB): owner opt-in for phone/address.
-- `general` members never saw others' phone/address. Now, when the OWNER explicitly sets phone/address to
-- 'all' | 'near' | 'family', a general viewer inside that circle sees it. Unset stays hidden (site default);
-- premium/moderator are unchanged (they see it unless the owner hides it).

create or replace function public.people_optin_cols(p people, r text) returns text[]
language sql stable security definer set search_path = public as $$
  select case when r = 'general'
    then coalesce(array(select k from unnest(array['phone','address']) k
                        where coalesce(p.privacy, '{}'::jsonb) ->> k in ('all','near','family')), '{}')
    else '{}'::text[] end $$;
revoke all on function public.people_optin_cols(people, text) from public, anon, authenticated;

do $$ declare d text; begin
  d := pg_get_functiondef('public.get_people(text,uuid)'::regprocedure);
  if position('hk.c' in d) = 0 then
    d := replace(d, 'jsonb_pick(to_jsonb(p), cols) - hk.k', 'jsonb_pick(to_jsonb(p), cols || hk.c) - hk.k');
    d := replace(d, 'people_locked_fields(p, hk.k, cols)', 'people_locked_fields(p, hk.k, cols || hk.c)');
    d := replace(d, 'else people_hidden_keys(p, own, r, fam, near, bsy) end as k) hk',
      'else people_hidden_keys(p, own, r, fam, near, bsy) end as k,
                                   case when adm or p.id = own or not coalesce(p.id = any(vis), false) then ''{}''::text[]
                                        else people_optin_cols(p, r) end as c) hk');
    if position('hk.c' in d) = 0 or position('as c) hk' in d) = 0 then raise exception 'get_people patch did not apply'; end if;
    execute d;
  end if;
end $$;
