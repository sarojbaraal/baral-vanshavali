-- Staff inbox for the contact / problem messages: admins AND moderators read them in the dashboard and answer by e-mail.
--  * list_messages / set_message_status now allow moderators too.
--  * site_message_replies keeps every reply sent (written by the reply-message edge function, which sends the mail).
create table if not exists public.site_message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.site_messages(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists site_message_replies_msg on public.site_message_replies(message_id, created_at);
create index if not exists site_message_replies_sender on public.site_message_replies(sender_id, created_at);
alter table public.site_message_replies enable row level security;
revoke all on public.site_message_replies from public, anon, authenticated;

create or replace function public.list_messages() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mail_staff(auth.uid()) then raise exception 'अनुमति छैन'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) - 'ip_hash' || jsonb_build_object(
      'sender', (select full_name from profiles where id = m.user_id),
      'replies', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body, 'status', r.status, 'at', r.created_at,
                  'by', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1))) order by r.created_at)
                from site_message_replies r left join profiles p on p.id = r.sender_id where r.message_id = m.id), '[]'::jsonb))
      order by m.created_at desc) from (select * from site_messages order by created_at desc limit 300) m), '[]'::jsonb);
end $$;

create or replace function public.set_message_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_staff(auth.uid()) then raise exception 'अनुमति छैन'; end if;
  if p_status not in ('new', 'read', 'done') then raise exception 'अमान्य स्थिति'; end if;
  update site_messages set status = p_status where id = p_id;
end $$;
revoke all on function public.list_messages(), public.set_message_status(uuid, text) from public, anon;
grant execute on function public.list_messages(), public.set_message_status(uuid, text) to authenticated;
