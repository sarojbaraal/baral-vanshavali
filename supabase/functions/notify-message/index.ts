// supabase/functions/notify-message/index.ts
// E-mails a contact / problem message to the family mailbox through Zoho SMTP. Called by the site right after
// submit_message succeeds with { id }. Public (verify_jwt = false) but harmless: it only sends the stored text of a
// message that is under 15 minutes old and was not mailed yet, once.
//
// Secrets: APP_SPECIFIC_PASSWORD (Zoho app-specific password). Optional: ZOHO_USER (default vanshavali@sarojbaral.com.np),
// ZOHO_HOST (default smtp.zoho.com), NOTIFY_TO (default = ZOHO_USER). SUPABASE_URL / SERVICE_ROLE_KEY are provided.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const oneLine = (s: unknown, n = 120) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, n);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pass = Deno.env.get("APP_SPECIFIC_PASSWORD");
    if (!url || !service) return json({ error: "server setup incomplete" }, 500);
    if (!pass) return json({ error: "APP_SPECIFIC_PASSWORD secret missing" }, 500);
    const user = Deno.env.get("ZOHO_USER") || "vanshavali@sarojbaral.com.np";
    const to = Deno.env.get("NOTIFY_TO") || user;
    const host = Deno.env.get("ZOHO_HOST") || "smtp.zoho.com";

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "");
    if (!UUID.test(id)) return json({ error: "invalid id" }, 400);

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    // claim the message: only one caller can flip notified_at from null, so it is mailed once
    const { data: m } = await db
      .from("site_messages")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", id)
      .is("notified_at", null)
      .gt("created_at", new Date(Date.now() - 15 * 60e3).toISOString())
      .select("kind,name,email,subject,body,page,created_at")
      .maybeSingle();
    if (!m) return json({ ok: true, sent: false });

    const kindL = m.kind === "problem" ? "समस्या रिपोर्ट" : "सम्पर्क सन्देश";
    const subject = `[बराल वंशावली] ${kindL}${m.subject ? ": " + oneLine(m.subject, 80) : ""}`;
    const rows: [string, string][] = [
      ["प्रकार", kindL],
      ["नाम", oneLine(m.name) || "—"],
      ["इमेल", oneLine(m.email) || "—"],
      ["विषय", oneLine(m.subject, 200) || "—"],
      ["पृष्ठ", oneLine(m.page, 300) || "—"],
    ];
    const html =
      `<div style="font-family:Arial,sans-serif;max-width:620px"><h2 style="color:#313d24;margin:0 0 12px">${esc(kindL)}</h2>` +
      `<table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#7d5a1e;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}</table>` +
      `<div style="margin-top:14px;padding:12px 14px;background:#f5f0e6;border-left:3px solid #b58a42;white-space:pre-wrap">${esc(m.body)}</div>` +
      `<p style="color:#66655a;font-size:13px;margin-top:14px">यो सन्देश एपको इनबक्समा पनि छ (एडमिन → सन्देश)।</p></div>`;
    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + "\n\n" + m.body;

    const client = new SMTPClient({ connection: { hostname: host, port: 465, tls: true, auth: { username: user, password: pass } } });
    try {
      const replyTo = m.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email) ? m.email : undefined;
      await client.send({ from: user, to, subject, content: text, html, ...(replyTo ? { replyTo } : {}) });
    } catch (e) {
      console.error("smtp", (e as Error).message);
      await db.from("site_messages").update({ notified_at: null }).eq("id", id); // allow a retry
      return json({ ok: false, sent: false, error: "mail failed" }, 502);
    } finally {
      try { await client.close(); } catch { /* ignore */ }
    }
    return json({ ok: true, sent: true });
  } catch (e) {
    console.error("notify-message", (e as Error).message);
    return json({ error: "failed" }, 500);
  }
});
