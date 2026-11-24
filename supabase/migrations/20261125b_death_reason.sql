-- Reason of death (free text, short).
alter table public.people add column if not exists death_reason text check (death_reason is null or char_length(death_reason) <= 120);

do $$
declare d text; a text := E'        death_tithi   = case when d ? ''death_tithi''';
begin
  select pg_get_functiondef('public.review_request(uuid,boolean,text)'::regprocedure) into d;
  if position('death_reason' in d) = 0 then
    if position(a in d) = 0 then raise exception 'review_request anchor not found'; end if;
    d := replace(d, a, E'        death_reason  = case when d ? ''death_reason''  then nullif(left(btrim(d->>''death_reason''), 120), '''') else death_reason end,\n' || a);
    execute d;
  end if;
end $$;
