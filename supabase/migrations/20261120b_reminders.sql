-- Occasion reminders by e-mail (opt-in): birthdays / wedding anniversaries of the member's own close family.
alter table public.profiles add column if not exists email_reminders boolean not null default false;

create table if not exists public.reminder_log (
  profile_id uuid not null,
  person_id uuid not null,
  kind text not null,
  on_date date not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, person_id, kind, on_date)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

create or replace function public.set_email_reminders(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'लगइन आवश्यक छ'; end if;
  update profiles set email_reminders = coalesce(p_on, false) where id = auth.uid();
end $$;
revoke all on function public.set_email_reminders(boolean) from public, anon;
grant execute on function public.set_email_reminders(boolean) to authenticated;

-- every morning 07:00 Nepal time (01:15 UTC) call the send-reminders function; it mails each event once (reminder_log)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('daily-occasion-reminders', '15 1 * * *', $cron$
  select net.http_post(
    url := 'https://bbrdnjkbmjwdgwahkbro.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$cron$);
