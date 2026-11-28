-- Privacy v2 coverage check. Run in the SQL editor: every row returned is a problem; zero rows = pass.
-- 1. every people column must be classified (public / trusted / own / admin), so none is exposed by accident
select 'unclassified column' as problem, c.column_name as detail
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'people'
  and not (c.column_name = any (public.people_public_cols() || public.people_trusted_cols() || public.people_own_cols() || public.people_admin_cols()))
union all
-- 2. classified names that are not real columns (typos silently hide data)
select 'unknown column in allowlist', k
from unnest(public.people_public_cols() || public.people_trusted_cols() || public.people_own_cols() || public.people_admin_cols()) k
where not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'people' and c.column_name = k)
union all
-- 3. API roles must have no direct table access to the privacy tables
select 'api role can touch table', g.table_name || ' ← ' || g.grantee
from information_schema.role_table_grants g
where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
  and g.table_name in ('people','field_requests','field_grants','field_blocks','privacy_log','bio_attempts','view_grants','view_requests','anchor_requests','invites');
