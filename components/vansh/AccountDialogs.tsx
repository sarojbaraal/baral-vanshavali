"use client";
// Dialogs behind the avatar menu: field privacy ("गोपनीयता सेटिङ") and "समस्या रिपोर्ट".
import React, { useEffect, useState } from "react";
import type { VPerson } from "@/lib/vansh/types";
import { useVansh } from "./VanshContext";
import { mailMessage } from "@/lib/vansh/notify";
import { np } from "@/lib/vansh/text";
import { canSee, DEFAULT, type FieldKey, type Level, type Viewer } from "@/lib/vansh/privacy";

type Aud = { family?: number; near?: number; members?: number };
const GROUPS: { t: string; f: { k: FieldKey; l: string }[] }[] = [
  { t: "सम्पर्क", f: [{ k: "phone", l: "फोन नम्बर" }, { k: "address", l: "ठेगाना" }, { k: "facebook", l: "Facebook" }] },
  { t: "व्यक्तिगत", f: [{ k: "birth_bs", l: "जन्ममिति र समय" }, { k: "birth_place", l: "जन्मस्थान" }, { k: "photo_url", l: "फोटो" }] },
  { t: "विवाह", f: [{ k: "marriage_bs", l: "विवाह मिति" }, { k: "divorce_bs", l: "सम्बन्ध विच्छेद मिति" }] },
  { t: "शिक्षा र पेशा", f: [{ k: "education", l: "शिक्षा" }, { k: "occupation", l: "पेशा" }, { k: "organization", l: "कार्यरत संस्था" }] },
];
/** Who the preview pretends to be. Same rules as get_people, so the preview never promises more than the server gives. */
const VIEWERS = [
  { k: "family", l: "परिवारको साधारण सदस्य" },
  { k: "branch", l: "शाखाको साधारण सदस्य" },
  { k: "far", l: "टाढाको साधारण सदस्य" },
  { k: "trusted", l: "विश्वसनीय सदस्य (premium/moderator)" },
] as const;
type LogRow = { kind: string; at: string; by: string | null };
const LOG_KIND: Record<string, string> = {
  steward_set: "सेटिङ बदल्नुभयो",
  steward_grant: "कसैलाई अनुमति दिनुभयो",
  steward_revoke: "कसैको अनुमति फिर्ता लिनुभयो",
};

/** `personId` set = a steward (admin, or a moderator of the person's branch) looking after a member who has no login. */
export function PrivacyDialog({ personId }: { personId?: string } = {}) {
  const { db, me, g, closeDialog, toast, reload } = useVansh();
  const steward = !!personId;
  const p: VPerson | undefined = steward ? g.byId[personId!] : me?.position_person_id ? g.byId[me.position_person_id] : undefined;
  const [v, setV] = useState<Record<string, Level>>(() => ({ ...(steward ? {} : p?.privacy || {}) }) as Record<string, Level>);
  const [st, setSt] = useState<"loading" | "ok" | "claimed" | "no">(steward ? "loading" : "ok");
  const [log, setLog] = useState<LogRow[]>([]);
  const [rem, setRem] = useState(!!me?.email_reminders);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [aud, setAud] = useState<Aud>({});
  const [viewer, setViewer] = useState<Viewer>("far");
  useEffect(() => {
    let alive = true;
    if (steward) {
      db.rpc("steward_privacy", { p_person: personId }).then(({ data }: { data: { can?: boolean; claimed?: boolean; privacy?: Record<string, Level> } | null }) => {
        if (!alive) return;
        if (!data?.can) return setSt(data?.claimed ? "claimed" : "no");
        setV({ ...(data.privacy || {}) });
        setSt("ok");
      });
      db.rpc("privacy_audience", { p_person: personId }).then(({ data }: { data: Aud | null }) => alive && data && setAud(data));
    } else {
      db.rpc("privacy_audience", {}).then(({ data }: { data: Aud | null }) => alive && data && setAud(data));
      db.rpc("my_privacy_log").then(({ data }: { data: LogRow[] | null }) => alive && Array.isArray(data) && setLog(data));
    }
    return () => {
      alive = false;
    };
  }, [db, steward, personId]);
  const save = async () => {
    setBusy(true);
    const { error } = steward ? await db.rpc("set_person_privacy", { p_person: personId, p_privacy: v }) : await db.rpc("set_my_privacy", { p_privacy: v });
    const r2 = error || steward ? null : await db.rpc("set_email_reminders", { p_on: rem });
    setBusy(false);
    if (error || r2?.error) return setErr((error || r2?.error)!.message);
    toast("✅ गोपनीयता सेटिङ सुरक्षित भयो");
    closeDialog();
    reload();
  };
  if (!p)
    return (
      <>
        <h3>🔒 गोपनीयता सेटिङ</h3>
        <p className="mut">यो सेटिङ आफ्नो विवरणमा लाग्छ। पहिले वंशवृक्षमा आफ्नो स्थान छान्नुहोस्।</p>
        <div className="row"><button className="ghost" onClick={closeDialog}>बन्द</button></div>
      </>
    );
  if (steward && st !== "ok")
    return (
      <>
        <h3>🔒 {p.name} को गोपनीयता</h3>
        <p className="mut">
          {st === "loading" ? "लोड हुँदैछ…" : st === "claimed" ? "यो सदस्यले आफ्नै खाता लिइसकेका छन्, त्यसैले उनले आफैँ नियन्त्रण गर्छन्।" : "यो व्यक्तिको गोपनीयता बदल्ने अधिकार तपाईंलाई छैन (एडमिन, वा आफ्नै शाखाको मोडरेटरले मात्र)।"}
        </p>
        <div className="row"><button className="ghost" onClick={closeDialog}>बन्द</button></div>
      </>
    );
  const n = (x?: number) => (typeof x === "number" ? ` · ${np(String(x))} जना` : "");
  const levels: [Level, string][] = [
    ["all", "सबै सदस्य"],
    ["near", `शाखा र परिवार${n(aud.near)}`],
    ["family", `परिवार मात्र${n(aud.family)}`],
    ["me", "म र एडमिन मात्र"],
  ];
  const eff = (k: FieldKey): Level => v[k] || DEFAULT[k] || "all";
  const set = (k: FieldKey, l: Level) => setV((o) => ({ ...o, [k]: l }));
  return (
    <>
      <h3 className={steward ? "pvt" : undefined}>{steward ? `🔒 ${p.name} को गोपनीयता` : "🔒 गोपनीयता सेटिङ"}</h3>
      {steward && (
        <p className="mut" role="note">
          यो सदस्यको आफ्नै लगइन छैन, त्यसैले तपाईंले प्रबन्धकका रूपमा सेटिङ राख्दै हुनुहुन्छ। उनले पछि खाता लिए यो परिवर्तन उनले देख्नेछन् र आफैँ बदल्न सक्नेछन्।
        </p>
      )}
      {!steward && log.length > 0 && (
        <div className="fa-card" role="note">
          <b>तपाईंको तर्फबाट अरूले गरेका परिवर्तन</b>
          {log.slice(0, 5).map((l, i) => (
            <div key={i} className="mut">{l.by || "एडमिन"} — {LOG_KIND[l.kind] || l.kind} · {new Date(l.at).toLocaleDateString("ne-NP")}</div>
          ))}
        </div>
      )}
      {!steward && (
        <p className="mut">
          वंशावलीको उद्देश्य जानकारी बाँड्नु हो, त्यसैले धेरै विवरण पूर्वनिर्धारित रूपमा खुला छन्। जुन विवरण कसले देख्छ भन्ने तपाईं छान्न सक्नुहुन्छ। एडमिन र तपाईं आफूले सधैँ देख्नुहुन्छ। नाम र नाता वंशवृक्षमै रहन्छन्।
        </p>
      )}
      <p className="mut" style={{ fontSize: ".85rem" }}>
        &ldquo;शाखा&rdquo; भनेको {steward ? "यो सदस्यका" : "तपाईंका"} बुबा र आमा दुवैतर्फको हजुरबुबाबाट तलका सबै सन्तान र उनीहरूका जीवनसाथी हुन्।
      </p>
      {GROUPS.map((gr) => (
        <fieldset key={gr.t} className="pvg">
          <legend>{gr.t}</legend>
          {gr.f.map((f) => (
            <label key={f.k}>
              {f.l}
              <select value={eff(f.k)} onChange={(e) => set(f.k, e.target.value as Level)}>
                {levels.map(([k, l]) => (
                  <option key={k} value={k}>{l}{!v[f.k] && DEFAULT[f.k] === k ? " (पूर्वनिर्धारित)" : ""}</option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ))}
      <p className="mut" style={{ fontSize: ".85rem" }}>
        फोन र ठेगाना नछान्दा साधारण सदस्यले देख्दैनन्; छानेपछि छानिएको घेराभित्रका सबै सदस्यले देख्छन्। १८ वर्षमुनिकाको जन्ममिति/फोटो नजिकका नातामा मात्र सीमित रहन्छ।
      </p>
      <div className="pvv" aria-live="polite">
        <b>👁 अरूले कसरी देख्छन्</b>
        <div className="pvseg" role="tablist">
          {VIEWERS.map((x) => (
            <button key={x.k} type="button" role="tab" aria-selected={viewer === x.k} className={viewer === x.k ? "on" : ""} onClick={() => setViewer(x.k)}>{x.l}</button>
          ))}
        </div>
        <ul>
          {GROUPS.flatMap((gr) => gr.f).map((f) => {
            const ok = canSee(f.k, v[f.k], viewer);
            return (
              <li key={f.k} className={ok ? "" : "lockd"}>
                <span>{f.l}</span>
                <em>{ok ? "देखिन्छ" : "🔒 गोप्य"}</em>
              </li>
            );
          })}
        </ul>
      </div>
      {!steward && <label className="chk">
        <input type="checkbox" checked={rem} onChange={(e) => setRem(e.target.checked)} />
        <span>📧 जन्मदिन/वर्षगाँठ अनुस्मारक {me?.email ? `(${me.email})` : ""} मा पठाउनुहोस्<small className="mut" style={{ display: "block" }}>तपाईं, जीवनसाथी, बुबाआमा, दाजुभाइ-दिदीबहिनी र सन्तानका मात्र; बिहान ७ बजे, आजको र भोलिको।</small></span>
      </label>}
      <div className="msg">{err}</div>
      <div className="row">
        <button disabled={busy} onClick={save}>सुरक्षित गर्ने</button>
        <button className="ghost" onClick={closeDialog}>रद्द</button>
      </div>
    </>
  );
}

export function ReportDialog() {
  const { db, me, closeDialog, toast } = useVansh();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened] = useState(() => Date.now());
  const send = async () => {
    if (body.trim().length < 5) return setErr("समस्या केही शब्दमा लेख्नुहोस्।");
    setBusy(true);
    const { data, error } = await db.rpc("submit_message", {
      p_kind: "problem",
      p_name: me?.full_name || "",
      p_email: me?.email || "",
      p_subject: subject,
      p_body: body,
      p_page: location.pathname + location.search,
      p_hp: "",
      p_elapsed: Date.now() - opened,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    mailMessage(db, data);
    toast("✅ रिपोर्ट पठाइयो, धन्यवाद");
    closeDialog();
  };
  return (
    <>
      <h3>⚠ समस्या रिपोर्ट</h3>
      <p className="mut">साइटमा देखिएको गल्ती, काम नगर्ने बटन वा गलत विवरण लेख्नुहोस्। तपाईंको खाता र हालको पृष्ठ आफैँ संलग्न हुन्छ।</p>
      <label>
        विषय (ऐच्छिक)
        <input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label>
        के भयो?
        <textarea rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="msg">{err}</div>
      <div className="row">
        <button disabled={busy} onClick={send}>पठाउने</button>
        <button className="ghost" onClick={closeDialog}>रद्द</button>
      </div>
    </>
  );
}
