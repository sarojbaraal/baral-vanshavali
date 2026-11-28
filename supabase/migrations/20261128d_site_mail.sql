-- In-site messages ("इमेल जस्तो"): members <-> staff (admin / moderator) only, with up to 3 attachments.
--  * A member can write to a staff member; a staff member can write to any active member. Members cannot write to each other.
--  * Everything goes through RPCs; the tables have no API access. Attachments live in the private `mail` bucket
--    (folder = thread id), readable only by the two people in the thread.
--  * Limits: 5000 characters, 3 attachments (5 MB each, jpg/png/webp/pdf), 30 messages a day (staff 100).

create table if not exists public.mail_threads (
  id uuid primary key,
  a_id uuid not null references public.profiles(id) on delete cascade,
  b_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 120),
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  check (a_id <> b_id)
);
create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 3),
  created_at timestamptz not null default now()
);
create table if not exists public.mail_reads (
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  hidden boolean not null default false,
  primary key (thread_id, user_id)
);
create index if not exists mail_threads_a on public.mail_threads(a_id, last_at desc);
create index if not exists mail_threads_b on public.mail_threads(b_id, last_at desc);
create index if not exists mail_messages_thread on public.mail_messages(thread_id, created_at);
create index if not exists mail_messages_sender on public.mail_messages(sender_id, created_at);
alter table public.mail_threads enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_reads enable row level security;
revoke all on public.mail_threads, public.mail_messages, public.mail_reads from public, anon, authenticated;

-- ---------- helpers ----------
create or replace function public.mail_active(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = u and p.suspended_at is null
    and (p.role in ('admin', 'member') or cardinality(coalesce(p.roles, '{}')) > 0)) $$;

create or replace function public.mail_staff(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = u and p.suspended_at is null
    and (p.role in ('admin', 'moderator') or p.roles && array['admin', 'moderator'])) $$;

-- is the caller one of the two people of this thread? (also used by the storage policies)
create or replace function public.mail_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mail_threads m where m.id = t and auth.uid() in (m.a_id, m.b_id) and public.mail_active(auth.uid())) $$;

create or replace function public.mail_folder_ok(path text, writing boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text := split_part(path, '/', 1);
begin
  if f !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or not public.mail_active(auth.uid()) then return false; end if;
  if public.mail_member(f::uuid) then return true; end if;
  -- a new message: the folder is the id of a thread that does not exist yet
  return writing and not exists (select 1 from mail_threads where id = f::uuid);
end $$;

revoke all on function public.mail_active(uuid), public.mail_staff(uuid), public.mail_member(uuid), public.mail_folder_ok(text, boolean) from public, anon;
grant execute on function public.mail_member(uuid), public.mail_folder_ok(text, boolean) to authenticated;
revoke execute on function public.mail_active(uuid), public.mail_staff(uuid) from authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mail', 'mail', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "mail read" on storage.objects;
drop policy if exists "mail insert" on storage.objects;
drop policy if exists "mail delete" on storage.objects;
create policy "mail read" on storage.objects for select to authenticated
  using (bucket_id = 'mail' and public.mail_folder_ok(name, false));
create policy "mail insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'mail' and public.mail_folder_ok(name, true));
create policy "mail delete" on storage.objects for delete to authenticated
  using (bucket_id = 'mail' and owner = auth.uid());

-- ---------- RPCs ----------
-- who the caller may write to: staff -> every active member, member -> staff only
create or replace function public.mail_directory() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare staff boolean;
begin
  if not public.mail_active(auth.uid()) then return '[]'::jsonb; end if;
  staff := public.mail_staff(auth.uid());
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
            'staff', public.mail_staff(p.id)) order by coalesce(nullif(p.full_name, ''), p.email))
    from profiles p where p.id <> auth.uid() and public.mail_active(p.id) and (staff or public.mail_staff(p.id))), '[]'::jsonb);
end $$;

create or replace function public.mail_send(p_thread uuid, p_to uuid, p_subject text, p_body text, p_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t mail_threads; body text := btrim(coalesce(p_body, '')); sub text := btrim(coalesce(p_subject, ''));
        a jsonb; clean jsonb := '[]'::jsonb; sent int; other uuid;
begin
  if me is null or not public.mail_active(me) then raise exception 'लगइन आवश्यक छ'; end if;
  if p_thread is null then raise exception 'अमान्य अनुरोध'; end if;
  if char_length(body) < 1 or char_length(body) > 5000 then raise exception 'सन्देश १ देखि ५००० अक्षरको हुनुपर्छ'; end if;
  select count(*) into sent from mail_messages where sender_id = me and created_at > now() - interval '24 hours';
  if sent >= case when public.mail_staff(me) then 100 else 30 end then raise exception 'आजको सन्देश सीमा पुग्यो, भोलि फेरि प्रयास गर्नुहोस्'; end if;

  select * into t from mail_threads where id = p_thread for update;
  if found then
    if me not in (t.a_id, t.b_id) then raise exception 'यो सन्देश-शृङ्खलामा तपाईं हुनुहुन्न'; end if;
    other := case when me = t.a_id then t.b_id else t.a_id end;
    if not public.mail_active(other) then raise exception 'यो सदस्यलाई अहिले सन्देश पठाउन मिल्दैन'; end if;
  else
    if p_to is null or p_to = me or not public.mail_active(p_to) then raise exception 'प्राप्तकर्ता मिलेन'; end if;
    if not (public.mail_staff(me) or public.mail_staff(p_to)) then raise exception 'सदस्यले एडमिन वा मोडरेटरलाई मात्र सन्देश पठाउन सक्छ'; end if;
    if char_length(sub) < 1 then sub := '(विषय छैन)'; end if;
    insert into mail_threads(id, a_id, b_id, subject) values (p_thread, me, p_to, left(sub, 120)) returning * into t;
    other := p_to;
  end if;

  if jsonb_typeof(coalesce(p_attachments, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 3 then
    raise exception 'बढीमा ३ फाइल संलग्न गर्न मिल्छ'; end if;
  for a in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    if (a ->> 'path') is null or split_part(a ->> 'path', '/', 1) <> p_thread::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'mail' and o.name = a ->> 'path' and o.owner = me) then
      raise exception 'संलग्न फाइल फेला परेन'; end if;
    clean := clean || jsonb_build_array(jsonb_build_object('path', a ->> 'path', 'name', left(coalesce(a ->> 'name', 'फाइल'), 120),
      'size', coalesce((select (o.metadata ->> 'size')::bigint from storage.objects o where o.bucket_id = 'mail' and o.name = a ->> 'path'), 0),
      'type', coalesce((select o.metadata ->> 'mimetype' from storage.objects o where o.bucket_id = 'mail' and o.name = a ->> 'path'), '')));
  end loop;

  insert into mail_messages(thread_id, sender_id, body, attachments) values (t.id, me, body, clean);
  update mail_threads set last_at = now() where id = t.id;
  insert into mail_reads(thread_id, user_id, read_at, hidden) values (t.id, me, now(), false)
    on conflict (thread_id, user_id) do update set read_at = now(), hidden = false;
  -- a new message brings the thread back to the other person's inbox, unread
  insert into mail_reads(thread_id, user_id, read_at, hidden) values (t.id, other, null, false)
    on conflict (thread_id, user_id) do update set hidden = false;
  return t.id;
end $$;

create or replace function public.mail_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x ->> 'last_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', t.id, 'subject', t.subject, 'last_at', t.last_at,
      'other_id', o.id, 'other', coalesce(nullif(o.full_name, ''), split_part(o.email, '@', 1)),
      'snippet', left(m.body, 90), 'mine', m.sender_id = auth.uid(), 'attach', jsonb_array_length(m.attachments) > 0,
      'unread', exists (select 1 from mail_messages u where u.thread_id = t.id and u.sender_id <> auth.uid()
                          and (r.read_at is null or u.created_at > r.read_at))) as x
    from mail_threads t
    join profiles o on o.id = case when t.a_id = auth.uid() then t.b_id else t.a_id end
    left join mail_reads r on r.thread_id = t.id and r.user_id = auth.uid()
    join lateral (select body, sender_id, attachments from mail_messages where thread_id = t.id order by created_at desc limit 1) m on true
    where auth.uid() in (t.a_id, t.b_id) and public.mail_active(auth.uid()) and coalesce(r.hidden, false) = false
    order by t.last_at desc limit 100) s $$;

-- open a thread (marks it read)
create or replace function public.mail_open(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t mail_threads; other profiles;
begin
  select * into t from mail_threads where id = p_id;
  if not found or auth.uid() not in (t.a_id, t.b_id) or not public.mail_active(auth.uid()) then raise exception 'सन्देश फेला परेन'; end if;
  insert into mail_reads(thread_id, user_id, read_at) values (t.id, auth.uid(), now())
    on conflict (thread_id, user_id) do update set read_at = now();
  select * into other from profiles where id = case when t.a_id = auth.uid() then t.b_id else t.a_id end;
  return jsonb_build_object('id', t.id, 'subject', t.subject,
    'other_id', other.id, 'other', coalesce(nullif(other.full_name, ''), split_part(other.email, '@', 1)),
    'can_reply', public.mail_active(other.id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender_id = auth.uid(), 'body', m.body,
        'attachments', m.attachments, 'at', m.created_at) order by m.created_at) from mail_messages m where m.thread_id = t.id), '[]'::jsonb));
end $$;

create or replace function public.mail_unread() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from mail_threads t
  left join mail_reads r on r.thread_id = t.id and r.user_id = auth.uid()
  where auth.uid() in (t.a_id, t.b_id) and public.mail_active(auth.uid()) and coalesce(r.hidden, false) = false
    and exists (select 1 from mail_messages u where u.thread_id = t.id and u.sender_id <> auth.uid() and (r.read_at is null or u.created_at > r.read_at)) $$;

create or replace function public.mail_hide(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_member(p_id) then return; end if;
  insert into mail_reads(thread_id, user_id, read_at, hidden) values (p_id, auth.uid(), now(), true)
    on conflict (thread_id, user_id) do update set hidden = true, read_at = now();
end $$;

revoke all on function public.mail_directory(), public.mail_send(uuid, uuid, text, text, jsonb), public.mail_list(),
  public.mail_open(uuid), public.mail_unread(), public.mail_hide(uuid) from public, anon;
grant execute on function public.mail_directory(), public.mail_send(uuid, uuid, text, text, jsonb), public.mail_list(),
  public.mail_open(uuid), public.mail_unread(), public.mail_hide(uuid) to authenticated;
