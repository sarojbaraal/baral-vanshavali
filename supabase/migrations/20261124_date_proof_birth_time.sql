-- Dates are often estimates: a ✓ marks a date as proven (documents / certain), and a birth time can be recorded.
alter table public.people add column if not exists birth_exact boolean not null default false;
alter table public.people add column if not exists death_exact boolean not null default false;
alter table public.people add column if not exists marriage_exact boolean not null default false;
alter table public.people add column if not exists birth_time text check (birth_time is null or birth_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- review_request: also save the new fields (the add / update branches both reach this point with pid set)
do $$
declare d text; a text := E'    if r.action in (''add'',''update'') then\n      select father_id';
begin
  select pg_get_functiondef('public.review_request(uuid,boolean,text)'::regprocedure) into d;
  if position('birth_exact' in d) = 0 then
    if position(a in d) = 0 then raise exception 'review_request anchor not found'; end if;
    d := replace(d, a, E'    if r.action in (''add'',''update'') then
      update people set
        birth_exact    = case when d ? ''birth_exact''    then coalesce((d->>''birth_exact'')::boolean, false)    else birth_exact end,
        death_exact    = case when d ? ''death_exact''    then coalesce((d->>''death_exact'')::boolean, false)    else death_exact end,
        marriage_exact = case when d ? ''marriage_exact'' then coalesce((d->>''marriage_exact'')::boolean, false) else marriage_exact end,
        birth_time     = case when d ? ''birth_time''     then (case when d->>''birth_time'' ~ ''^([01][0-9]|2[0-3]):[0-5][0-9]$'' then d->>''birth_time'' end) else birth_time end
      where id = pid;
      -- the marriage date is shared by the couple, so is its proof
      if d ? ''marriage_exact'' then
        update people set marriage_exact = (select marriage_exact from people where id = pid)
         where id = (select spouse_id from people where id = pid);
      end if;
    end if;
' || a);
    execute d;
  end if;
end $$;

-- children's birth time is hidden together with their birth date
do $$
declare d text;
begin
  select pg_get_functiondef('public.get_people(text,uuid)'::regprocedure) into d;
  if position('''birth_time''' in d) = 0 then
    d := replace(d, 'array[''birth_bs'', ''photo_url'']', 'array[''birth_bs'', ''birth_time'', ''photo_url'']');
    execute d;
  end if;
end $$;
