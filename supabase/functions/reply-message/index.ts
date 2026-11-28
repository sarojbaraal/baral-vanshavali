// supabase/functions/reply-message/index.ts
// An admin or moderator answers a contact / problem message from the dashboard: { message_id, body }.
// The reply is e-mailed to the sender through the same Zoho SMTP account as notify-message (Reply-To = the family
// mailbox, so the sender's answer reaches the family inbox), saved in site_message_replies, and the message is marked done.
//
// Secrets: APP_SPECIFIC_PASSWORD. Optional: ZOHO_USER (default vanshavali@sarojbaral.com.np), ZOHO_HOST (default smtp.zoho.com).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const oneLine = (s: unknown, n = 120) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);
const DAILY = 30;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST मात्र" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pass = Deno.env.get("APP_SPECIFIC_PASSWORD");
    if (!url || !service) return json({ error: "सर्भर सेटअप अधुरो छ।" }, 500);
    if (!pass) return json({ error: "इमेल सेवा (APP_SPECIFIC_PASSWORD) सेट गरिएको छैन।" }, 500);
    const user = Deno.env.get("ZOHO_USER") || "vanshavali@sarojbaral.com.np";
    const host = Deno.env.get("ZOHO_HOST") || "smtp.zoho.com";

    const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: "लगइन आवश्यक छ।" }, 401);
    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: au, error: ae } = await db.auth.getUser(token);
    if (ae || !au.user) return json({ error: "सेसन अमान्य वा सकिएको छ।" }, 401);
    const { data: prof } = await db.from("profiles").select("full_name,email,role,roles,suspended_at").eq("id", au.user.id).maybeSingle();
    const roles = [prof?.role, ...(Array.isArray(prof?.roles) ? prof.roles : [])];
    if (!prof || prof.suspended_at || !(roles.includes("admin") || roles.includes("moderator"))) return json({ error: "एडमिन वा मोडरेटरले मात्र जवाफ दिन सक्छ।" }, 403);

    const body = await req.json().catch(() => ({}));
    const id = String(body?.message_id || "");
    const text = String(body?.body || "").replace(/\r/g, "").trim();
    if (!UUID.test(id)) return json({ error: "सन्देश अमान्य छ।" }, 400);
    if (text.length < 1 || text.length > 5000) return json({ error: "जवाफ १ देखि ५००० अक्षरको हुनुपर्छ।" }, 400);

    const { data: m } = await db.from("site_messages").select("kind,name,email,subject,body,created_at").eq("id", id).maybeSingle();
    if (!m) return json({ error: "सन्देश फेला परेन।" }, 404);
    if (!m.email || !EMAIL.test(m.email)) return json({ error: "यो सन्देशमा जवाफ दिन मिल्ने इमेल ठेगाना छैन।" }, 400);

    const { count } = await db.from("site_message_replies").select("id", { count: "exact", head: true })
      .eq("sender_id", au.user.id).gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
    if ((count ?? 0) >= DAILY) return json({ error: "आजको जवाफ सीमा पुग्यो, भोलि फेरि प्रयास गर्नुहोस्।" }, 429);

    const who = oneLine(prof.full_name || prof.email?.split("@")[0] || "बराल वंशावली", 60);
    const subject = "Re: " + (oneLine(m.subject, 120) || "बराल वंशावली");
    const quoted = String(m.body).split("\n").map((l) => "> " + l).join("\n");
    const content = `${text}\n\n— ${who}, बराल वंशावली\n\n--- तपाईंको सन्देश ---\n${quoted}`;
    const html =
      `<div style="font-family:Arial,sans-serif;max-width:620px"><div style="white-space:pre-wrap">${esc(text)}</div>` +
      `<p style="margin-top:16px;color:#313d24">— ${esc(who)}, बराल वंशावली</p>` +
      `<div style="margin-top:16px;padding:10px 14px;background:#f5f0e6;border-left:3px solid #b58a42;color:#555;white-space:pre-wrap"><small>तपाईंको सन्देश</small><br>${esc(m.body)}</div></div>`;

    let status: "sent" | "failed" = "sent";
    const client = new SMTPClient({ connection: { hostname: host, port: 465, tls: true, auth: { username: user, password: pass } } });
    try {
      await client.send({ from: user, to: m.email, subject, content, html, replyTo: user });
    } catch (e) {
      console.error("smtp", (e as Error).message);
      status = "failed";
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }
    await db.from("site_message_replies").insert({ message_id: id, sender_id: au.user.id, body: text, status });
    if (status === "failed") return json({ error: "इमेल पठाउन सकिएन, केही बेरपछि फेरि प्रयास गर्नुहोस्।" }, 502);
    await db.from("site_messages").update({ status: "done" }).eq("id", id);
    return json({ success: true });
  } catch (e) {
    console.error("reply-message", (e as Error).message);
    return json({ error: "जवाफ पठाउन सकिएन।" }, 500);
  }
});
