-- Death tithi (free text, e.g. "भाद्र शुक्ल पञ्चमी") and divorce date (+ proof mark).
alter table public.people add column if not exists death_tithi text check (death_tithi is null or char_length(death_tithi) <= 60);
alter table public.people add column if not exists divorce_bs text;
alter table public.people add column if not exists divorce_exact boolean not null default false;

do $$
declare d text; a text := E'    if r.action in (''add'',''update'') then\n      update people set\n        birth_exact';
begin
  select pg_get_functiondef('public.review_request(uuid,boolean,text)'::regprocedure) into d;
  if position('divorce_bs' in d) = 0 then
    if position(a in d) = 0 then raise exception 'review_request anchor not found'; end if;
    d := replace(d, a, E'    if r.action in (''add'',''update'') then
      update people set
        death_tithi   = case when d ? ''death_tithi''   then nullif(left(btrim(d->>''death_tithi''), 60), '''') else death_tithi end,
        divorce_bs    = case when d ? ''divorce_bs''    then nullif(d->>''divorce_bs'', '''') else divorce_bs end,
        divorce_exact = case when d ? ''divorce_exact'' then coalesce((d->>''divorce_exact'')::boolean, false) else divorce_exact end
      where id = pid;
      -- a divorce date is shared by the couple, like the marriage date
      if d ? ''divorce_bs'' or d ? ''divorce_exact'' then
        update people set divorce_bs = (select divorce_bs from people where id = pid),
                          divorce_exact = (select divorce_exact from people where id = pid)
         where id = (select spouse_id from people where id = pid);
      end if;
    end if;
' || a);
    execute d;
  end if;
end $$;
