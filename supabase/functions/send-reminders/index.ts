// supabase/functions/send-reminders/index.ts
// Daily (pg_cron, 07:00 Nepal time): e-mails members who switched on "अनुस्मारक" about today's and tomorrow's birthdays and
// wedding anniversaries in their OWN close family (themselves, spouse, parents, siblings, children). Details a person
// hid from everyone but themselves (privacy.birth_bs = "me") are skipped. reminder_log makes each event go out once,
// so calling this function again the same day sends nothing new.
// Secrets: APP_SPECIFIC_PASSWORD (Zoho); optional ZOHO_USER, ZOHO_HOST, SITE_URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { adToBs } from "npm:@sbmdkl/nepali-date-converter@2.0.5";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const DEVA = "०१२३४५६७८९";
const np = (n: unknown) => String(n).replace(/\d/g, (d) => DEVA[+d]);
const na = (s: unknown) => String(s ?? "").replace(/[०-९]/g, (d) => String(DEVA.indexOf(d)));
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const z = (n: number) => String(n).padStart(2, "0");

interface P { id: string; name: string; gender: string | null; is_living: boolean | null; birth_bs: string | null; marriage_bs: string | null; spouse_id: string | null; more_spouse_ids: string[] | null; father_id: string | null; mother_id: string | null; privacy: Record<string, string> | null }
const md = (s: string | null) => { const [y, m, d] = na(s).split("-").map((x) => parseInt(x, 10) || 0); return { y, m, d }; };

// the date in Nepal (UTC+05:45), as an AD "YYYY-MM-DD" plus its BS date
function day(offset: number) {
  const t = new Date(Date.now() + (5 * 60 + 45) * 60e3 + offset * 864e5);
  const ad = `${t.getUTCFullYear()}-${z(t.getUTCMonth() + 1)}-${z(t.getUTCDate())}`;
  let bs: { y: number; m: number; d: number } | null = null;
  try { const [y, m, d] = String(adToBs(ad)).split("-").map(Number); bs = { y, m, d }; } catch { /* outside the table */ }
  return { ad, bs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pass = Deno.env.get("APP_SPECIFIC_PASSWORD");
    if (!url || !service || !pass) return json({ error: "setup incomplete" }, 500);
    const user = Deno.env.get("ZOHO_USER") || "vanshavali@sarojbaral.com.np";
    const host = Deno.env.get("ZOHO_HOST") || "smtp.zoho.com";
    const site = (Deno.env.get("SITE_URL") || "https://vanshavali.sarojbaral.com.np").replace(/\/$/, "");
    const days = [day(0), day(1)];
    if (!days[0].bs || !days[1].bs) return json({ ok: true, sent: 0, note: "date outside table" });

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: profs } = await db.from("profiles").select("id,email,full_name,position_person_id").eq("email_reminders", true).is("suspended_at", null).not("position_person_id", "is", null).not("email", "is", null);
    if (!profs?.length) return json({ ok: true, sent: 0 });

    let client: SMTPClient | null = null;
    let sent = 0;
    for (const pr of profs) {
      const { data: meRow } = await db.from("people").select("*").eq("id", pr.position_person_id).eq("hidden", false).maybeSingle();
      const me = meRow as P | null;
      if (!me) continue;
      const near = new Map<string, P>([[me.id, me]]);
      const add = (rows: unknown) => ((rows as P[]) || []).forEach((r) => near.set(r.id, r));
      const ids = [me.father_id, me.mother_id, me.spouse_id, ...(me.more_spouse_ids || [])].filter(Boolean) as string[];
      if (ids.length) add((await db.from("people").select("*").in("id", ids).eq("hidden", false)).data);
      add((await db.from("people").select("*").or(`father_id.eq.${me.id},mother_id.eq.${me.id}`).eq("hidden", false)).data);
      const sib = [me.father_id && `father_id.eq.${me.father_id}`, me.mother_id && `mother_id.eq.${me.mother_id}`].filter(Boolean).join(",");
      if (sib) add((await db.from("people").select("*").or(sib).eq("hidden", false)).data);

      const lines: { key: string; pid: string; kind: string; on: string; text: string }[] = [];
      days.forEach((dd, i) => {
        const when = i === 0 ? "आज" : "भोलि";
        near.forEach((p) => {
          if (p.is_living === false) return;
          if (p.birth_bs && p.privacy?.birth_bs !== "me" || p.id === me.id) {
            const b = md(p.birth_bs);
            if (b.m && b.d && b.m === dd.bs!.m && b.d === dd.bs!.d) {
              const age = b.y ? dd.bs!.y - b.y : 0;
              lines.push({ key: `b${p.id}${dd.ad}`, pid: p.id, kind: "birthday", on: dd.ad, text: `${when} ${p.id === me.id ? "तपाईंको" : p.name + " को"} जन्मदिन${age > 0 && age < 130 ? ` (${np(age)} वर्ष पुग्दै)` : ""}` });
            }
          }
        });
        const sp = me.spouse_id ? near.get(me.spouse_id) : undefined;
        const ms = md(me.marriage_bs || sp?.marriage_bs || null);
        if (sp?.is_living !== false && ms.m && ms.d && ms.m === dd.bs!.m && ms.d === dd.bs!.d) {
          const yrs = ms.y ? dd.bs!.y - ms.y : 0;
          lines.push({ key: `a${me.id}${dd.ad}`, pid: me.id, kind: "anniversary", on: dd.ad, text: `${when} तपाईं र ${sp?.name || "जीवनसाथी"} को विवाह वर्षगाँठ${yrs > 0 && yrs < 100 ? ` (${np(yrs)} औं)` : ""}` });
        }
      });
      if (!lines.length) continue;

      // keep only events not mailed to this member before
      const fresh: typeof lines = [];
      for (const l of lines) {
        const { error } = await db.from("reminder_log").insert({ profile_id: pr.id, person_id: l.pid, kind: l.kind, on_date: l.on });
        if (!error) fresh.push(l);
      }
      if (!fresh.length) continue;

      client ??= new SMTPClient({ connection: { hostname: host, port: 465, tls: true, auth: { username: user, password: pass } } });
      const subject = `[बराल वंशावली] ${fresh.some((l) => l.text.startsWith("आज")) ? "आजका" : "भोलिका"} अवसर`;
      const html =
        `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#313d24">नमस्ते${pr.full_name ? " " + esc(pr.full_name) : ""}</h2><ul style="line-height:1.9">${fresh.map((l) => `<li>${esc(l.text)}</li>`).join("")}</ul>` +
        `<p><a href="${site}/app?tab=fam" style="color:#7d5a1e">परिवार हेर्नुहोस्</a></p>` +
        `<p style="color:#66655a;font-size:13px">यो अनुस्मारक तपाईंले रोजेकाले आएको हो। बन्द गर्न <a href="${site}/app?do=privacy">गोपनीयता सेटिङ</a> खोल्नुहोस्।</p></div>`;
      try {
        await client.send({ from: user, to: pr.email, subject, content: fresh.map((l) => l.text).join("\n"), html });
        sent++;
      } catch (e) {
        console.error("smtp", (e as Error).message);
        for (const l of fresh) await db.from("reminder_log").delete().match({ profile_id: pr.id, person_id: l.pid, kind: l.kind, on_date: l.on }); // retry tomorrow's run / next call
      }
    }
    try { await client?.close(); } catch { /* ignore */ }
    return json({ ok: true, sent });
  } catch (e) {
    console.error("send-reminders", (e as Error).message);
    return json({ error: "failed" }, 500);
  }
});
