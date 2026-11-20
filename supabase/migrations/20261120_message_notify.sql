-- Contact / problem messages are also e-mailed (edge function notify-message). notified_at makes each message mail once.
alter table public.site_messages add column if not exists notified_at timestamptz;

create or replace function public.submit_message(p_kind text, p_name text, p_email text, p_subject text, p_body text,
                                                 p_page text default null, p_hp text default null, p_elapsed int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ip text := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  h text := md5(coalesce(nullif(ip, ''), 'unknown') || coalesce(uid::text, ''));
  b text := btrim(coalesce(p_body, ''));
  mid uuid;
begin
  if p_hp is not null and p_hp <> '' then return jsonb_build_object('ok', true); end if;   -- honeypot: pretend success
  if p_kind not in ('contact','problem') then raise exception 'अमान्य प्रकार'; end if;
  if p_kind = 'problem' and uid is null then raise exception 'समस्या रिपोर्ट गर्न लगइन चाहिन्छ'; end if;
  if char_length(b) < 5 then raise exception 'सन्देश धेरै छोटो छ'; end if;
  if char_length(b) > 4000 then raise exception 'सन्देश धेरै लामो छ (४००० अक्षरसम्म)'; end if;
  if char_length(coalesce(p_name, '')) > 120 or char_length(coalesce(p_subject, '')) > 200 or char_length(coalesce(p_page, '')) > 300 then
    raise exception 'केही खाली ठाउँ धेरै लामो छ';
  end if;
  if p_kind = 'contact' and (p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'सही इमेल ठेगाना राख्नुहोस्'; end if;
  if p_elapsed is not null and p_elapsed < 3000 then raise exception 'कृपया केही सेकेन्डपछि फेरि पठाउनुहोस्'; end if;
  if (select count(*) from site_messages where ip_hash = h and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'धेरै सन्देश पठाइयो; केही बेरपछि फेरि प्रयास गर्नुहोस्';
  end if;
  if (select count(*) from site_messages where created_at > now() - interval '1 day') >= 300 then
    raise exception 'आज धेरै सन्देश आए; भोलि फेरि प्रयास गर्नुहोस्';
  end if;
  insert into site_messages (kind, name, email, subject, body, page, user_id, ip_hash)
  values (p_kind, nullif(btrim(p_name), ''), nullif(btrim(p_email), ''), nullif(btrim(p_subject), ''), b, nullif(p_page, ''), uid, h)
  returning id into mid;
  return jsonb_build_object('ok', true, 'id', mid);
end $$;
revoke all on function public.submit_message(text, text, text, text, text, text, text, int) from public;
grant execute on function public.submit_message(text, text, text, text, text, text, text, int) to anon, authenticated;
