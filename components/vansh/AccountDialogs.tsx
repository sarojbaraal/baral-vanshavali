"use client";
// Dialogs behind the avatar menu: field privacy ("गोपनीयता सेटिङ") and "समस्या रिपोर्ट".
import React, { useState } from "react";
import type { VPerson } from "@/lib/vansh/types";
import { useVansh } from "./VanshContext";
import { mailMessage } from "@/lib/vansh/notify";

type Level = "all" | "near" | "me";
const FIELDS: { k: "phone" | "birth_bs" | "address" | "photo_url"; l: string }[] = [
  { k: "phone", l: "फोन नम्बर" },
  { k: "birth_bs", l: "जन्ममिति" },
  { k: "address", l: "ठेगाना" },
  { k: "photo_url", l: "फोटो" },
];
const LEVELS: [Level, string][] = [
  ["all", "भूमिकाअनुसार सबै सदस्य"],
  ["near", "नजिकका नाता र शाखा मात्र"],
  ["me", "म र एडमिन मात्र"],
];

export function PrivacyDialog() {
  const { db, me, g, closeDialog, toast, reload } = useVansh();
  const p: VPerson | undefined = me?.position_person_id ? g.byId[me.position_person_id] : undefined;
  const [v, setV] = useState<Record<string, Level>>(() => ({ ...(p?.privacy || {}) }) as Record<string, Level>);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await db.rpc("set_my_privacy", { p_privacy: v });
    setBusy(false);
    if (error) return setErr(error.message);
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
  return (
    <>
      <h3>🔒 गोपनीयता सेटिङ</h3>
      <p className="mut">
        तपाईंको विवरण कसले देख्न सक्छ भन्ने छान्नुहोस्। एडमिन र तपाईं आफूले सधैँ देख्नुहुन्छ। नाम र नाता भने वंशवृक्षमै रहन्छन्।
      </p>
      {FIELDS.map((f) => (
        <label key={f.k}>
          {f.l}
          <select value={v[f.k] || "all"} onChange={(e) => setV({ ...v, [f.k]: e.target.value as Level })}>
            {LEVELS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
      ))}
      <p className="mut" style={{ fontSize: ".85rem" }}>
        &ldquo;भूमिकाअनुसार सबै सदस्य&rdquo; भनेको साइटको सामान्य नियम हो: साधारण सदस्यले अरूको फोन/ठेगाना देख्दैनन्, र १८ वर्षमुनिकाको जन्ममिति/फोटो नजिकका नातामा मात्र सीमित हुन्छ।
      </p>
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
