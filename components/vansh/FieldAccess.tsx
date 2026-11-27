"use client";
// Phase 4 of privacy v2: ask the owner for hidden fields, and manage requests/grants ("🔑 पहुँच अनुरोध").
import React, { useCallback, useEffect, useState } from "react";
import { useVansh } from "./VanshContext";
import { fieldLabel, grantLabel, REQUEST_STATUS } from "@/lib/vansh/privacy";

type Incoming = { id: string; person_id: string; person: string; requester: string; requester_person: string | null; fields: string[]; note: string | null };
type Outgoing = { id: string; person: string; fields: string[]; status: string; duration: string | null };
type Given = { id: string; person: string; field: string; grantee: string; expires_at: string | null };
type Received = { person: string; field: string; expires_at: string | null };
type Data = { incoming: Incoming[]; outgoing: Outgoing[]; given: Given[]; received: Received[] };

/** Ask the owner of a person for some of the fields that are hidden from you. */
export function FieldRequestDialog({ personId, fields, name }: { personId: string; fields: string[]; name: string }) {
  const { db, closeDialog, toast } = useVansh();
  const [sel, setSel] = useState<string[]>(fields.slice(0, 1));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    setBusy(true);
    const { error } = await db.rpc("request_field_access", { p_person: personId, p_fields: sel, p_note: note });
    setBusy(false);
    if (error) return setErr(error.message);
    toast("✅ अनुरोध पठाइयो — स्वीकृत भएपछि विवरण देखिनेछ");
    closeDialog();
  };
  return (
    <div className="dlw">
      <h3>🔑 विवरण हेर्न अनुमति माग्ने</h3>
      <p className="mut">{name} ले यी विवरण लुकाएका छन्। उनले अनुमति दिए मात्र तपाईंले देख्नुहुन्छ। उनले एक पटक (२४ घण्टा) वा सधैंका लागि दिन सक्छन्, र जहिले पनि फिर्ता लिन सक्छन्।</p>
      <div className="fa-fields" role="group" aria-label="माग्ने विवरण">
        {fields.map((f) => (
          <label key={f} className="chk">
            <input type="checkbox" checked={sel.includes(f)} onChange={(e) => setSel(e.target.checked ? [...sel, f] : sel.filter((x) => x !== f))} />
            <span>{fieldLabel(f)}</span>
          </label>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="किन चाहिएको हो? (जस्तै: पारिवारिक अभिलेखका लागि)" style={{ width: "100%" }} />
      <div className="msg">{err}</div>
      <div className="row">
        <button disabled={busy || !sel.length} onClick={send}>{busy ? "पठाउँदै…" : "अनुरोध पठाउने"}</button>
        <button className="ghost" onClick={closeDialog}>रद्द</button>
      </div>
    </div>
  );
}

/** One place for everything about access: requests to me, what I granted, what I asked, what I received. */
export function AccessDialog() {
  const { db, closeDialog, toast, reload } = useVansh();
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const { data } = await db.rpc("my_field_access");
    setD((data as Data) || { incoming: [], outgoing: [], given: [], received: [] });
  }, [db]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  const act = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key);
    setErr("");
    const { error } = await fn();
    setBusy("");
    if (error) return setErr(error.message);
    toast(ok);
    await load();
    reload();
  };
  if (!d)
    return (
      <div className="dlw">
        <h3>🔑 पहुँच अनुरोध</h3>
        <p className="mut">लोड हुँदैछ…</p>
      </div>
    );
  const none = <p className="mut">केही छैन।</p>;
  return (
    <div className="dlw fa">
      <h3>🔑 पहुँच अनुरोध</h3>
      <div className="msg">{err}</div>

      <h4>मलाई आएका अनुरोध ({d.incoming.length})</h4>
      {d.incoming.length === 0 && none}
      {d.incoming.map((r) => (
        <div key={r.id} className="fa-card">
          <b>{r.requester}{r.requester_person && r.requester_person !== r.requester ? ` (${r.requester_person})` : ""}</b>
          <span className="mut"> ले {r.person} को {r.fields.map(fieldLabel).join(", ")} माग्नुभएको छ</span>
          {r.note && <p className="fa-note">“{r.note}”</p>}
          <div className="row">
            <button disabled={!!busy} onClick={() => act(r.id, () => db.rpc("review_field_request", { p_id: r.id, p_decision: "once" }), "✅ २४ घण्टाका लागि अनुमति दिइयो")}>एक पटक (२४ घण्टा)</button>
            <button disabled={!!busy} onClick={() => act(r.id, () => db.rpc("review_field_request", { p_id: r.id, p_decision: "always" }), "✅ सधैंका लागि अनुमति दिइयो")}>सधैं</button>
            <button className="ghost" disabled={!!busy} onClick={() => act(r.id, () => db.rpc("review_field_request", { p_id: r.id, p_decision: "deny" }), "अनुरोध अस्वीकार गरियो")}>अस्वीकार</button>
            <button className="ghost" disabled={!!busy} title="यो सदस्यले फेरि अनुरोध पठाउन सक्दैन" onClick={() => confirm("यो सदस्यले अब उप्रान्त अनुरोध पठाउन नपाउने बनाउने?") && act(r.id, () => db.rpc("review_field_request", { p_id: r.id, p_decision: "block" }), "सदस्य रोकियो")}>रोक्ने</button>
          </div>
        </div>
      ))}

      <h4>मैले दिएका अनुमति ({d.given.length})</h4>
      {d.given.length === 0 && none}
      {d.given.map((g) => (
        <div key={g.id} className="fa-line">
          <span><b>{g.grantee}</b> → {g.person} · {fieldLabel(g.field)} <em className="mut">({grantLabel(g.expires_at)})</em></span>
          <button className="ghost" disabled={!!busy} onClick={() => act(g.id, () => db.rpc("revoke_field_grant", { p_id: g.id }), "अनुमति फिर्ता लिइयो")}>फिर्ता लिने</button>
        </div>
      ))}

      <h4>मैले पठाएका अनुरोध</h4>
      {d.outgoing.length === 0 && none}
      {d.outgoing.map((o) => (
        <div key={o.id} className="fa-line">
          <span>{o.person} · {o.fields.map(fieldLabel).join(", ")} <em className="mut">— {REQUEST_STATUS[o.status] || o.status}{o.status === "approved" && o.duration === "once" ? " (२४ घण्टा)" : ""}</em></span>
          {o.status === "pending" && (
            <button className="ghost" disabled={!!busy} onClick={() => act(o.id, () => db.rpc("cancel_field_request", { p_id: o.id }), "अनुरोध रद्द गरियो")}>रद्द</button>
          )}
        </div>
      ))}

      <h4>मैले पाएका अनुमति ({d.received.length})</h4>
      {d.received.length === 0 && none}
      {d.received.map((r, i) => (
        <div key={i} className="fa-line">
          <span>{r.person} · {fieldLabel(r.field)} <em className="mut">({grantLabel(r.expires_at)})</em></span>
        </div>
      ))}
      <div className="row"><button className="ghost" onClick={closeDialog}>बन्द</button></div>
    </div>
  );
}
