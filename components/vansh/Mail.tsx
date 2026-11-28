"use client";
// "✉ सन्देश": messages inside the site between members and staff (admin / moderator), with up to 3 attachments.
// Everything goes through the mail_* RPCs; files live in the private `mail` bucket, one folder per thread.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVansh } from "./VanshContext";
import { np } from "@/lib/vansh/text";

const BUCKET = "mail";
const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type Row = { id: string; subject: string; last_at: string; other: string; snippet: string; mine: boolean; attach: boolean; unread: boolean };
type Att = { path: string; name: string; size: number; type: string };
type Msg = { id: string; mine: boolean; body: string; attachments: Att[]; at: string };
type Thread = { id: string; subject: string; other: string; other_id: string; can_reply: boolean; messages: Msg[] };
type Person = { id: string; name: string; staff: boolean };

const when = (iso: string) => {
  const d = new Date(iso);
  const same = d.toDateString() === new Date().toDateString();
  const t = np(d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
  return same ? t : `${np(d.getDate())}/${np(d.getMonth() + 1)}/${np(d.getFullYear())} ${t}`;
};
const kb = (n: number) => (n >= 1048576 ? `${np((n / 1048576).toFixed(1))} MB` : `${np(Math.max(1, Math.round(n / 1024)))} KB`);
const errText = (m: string) => (/row-level|policy/i.test(m) ? "फाइल राख्ने अनुमति छैन" : /size|large|payload/i.test(m) ? "फाइल धेरै ठूलो छ" : m);

function Attach({ a }: { a: Att }) {
  const { db, toast } = useVansh();
  const open = async () => {
    // open the tab inside the click so the popup blocker allows it, then point it at a short-lived signed link
    const w = window.open("", "_blank");
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(a.path, 300);
    if (error || !data?.signedUrl) {
      w?.close();
      return toast("⚠ फाइल खोल्न सकिएन");
    }
    if (w) {
      w.opener = null;
      w.location.href = data.signedUrl;
    } else window.location.href = data.signedUrl;
  };
  return (
    <button type="button" className="ml-att" onClick={open} title="खोल्ने">
      {a.type === "application/pdf" ? "📄" : "🖼"} {a.name} <small>{kb(a.size)}</small>
    </button>
  );
}

/** The writing form: a new message (to = chosen person) or a reply (thread given). */
function Compose({ thread, onDone, onCancel }: { thread?: Thread; onDone: (id: string) => void; onCancel: () => void }) {
  const { db, toast } = useVansh();
  const [people, setPeople] = useState<Person[]>([]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const idRef = useRef(thread?.id || crypto.randomUUID());

  useEffect(() => {
    if (thread) return;
    db.rpc("mail_directory").then(({ data }) => Array.isArray(data) && setPeople(data as Person[]));
  }, [db, thread]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!TYPES.includes(f.type)) return setErr(`"${f.name}" — फोटो (jpg/png/webp) वा PDF मात्र राख्न मिल्छ`);
      if (f.size > MAX_BYTES) return setErr(`"${f.name}" ५MB भन्दा ठूलो छ`);
      if (f.size === 0) return setErr(`"${f.name}" खाली फाइल हो`);
      next.push(f);
    }
    if (next.length > MAX_FILES) return setErr(`बढीमा ${np(MAX_FILES)} फाइल राख्न मिल्छ`);
    setErr("");
    setFiles(next);
  };

  const send = async () => {
    if (!thread && !to) return setErr("कसलाई पठाउने भनेर छान्नुहोस्");
    if (!body.trim()) return setErr("सन्देश लेख्नुहोस्");
    setBusy(true);
    setErr("");
    const atts: Att[] = [];
    for (const f of files) {
      const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const path = `${idRef.current}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (error) {
        setBusy(false);
        return setErr(`"${f.name}" अपलोड असफल: ${errText(error.message)}`);
      }
      atts.push({ path, name: f.name.slice(0, 120), size: f.size, type: f.type });
    }
    const { data, error } = await db.rpc("mail_send", {
      p_thread: idRef.current,
      p_to: thread ? null : to,
      p_subject: thread ? null : subject,
      p_body: body,
      p_attachments: atts,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    toast("✅ सन्देश पठाइयो");
    onDone((data as string) || idRef.current);
  };

  return (
    <div className="ml-compose">
      {!thread && (
        <>
          <label>
            कसलाई
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">— छान्नुहोस् —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.staff ? " (एडमिन/मोडरेटर)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            विषय
            <input value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="छोटो विषय" />
          </label>
        </>
      )}
      <label>
        {thread ? "उत्तर" : "सन्देश"}
        <textarea value={body} maxLength={5000} rows={thread ? 4 : 7} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="ml-files">
        {files.map((f, i) => (
          <span key={i} className="ml-chip">
            {f.type === "application/pdf" ? "📄" : "🖼"} {f.name} <small>{kb(f.size)}</small>
            <button type="button" aria-label="हटाउने" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
        {files.length < MAX_FILES && (
          <button type="button" className="ghost" onClick={() => pick.current?.click()}>📎 फाइल/फोटो</button>
        )}
        <input ref={pick} type="file" hidden multiple accept={TYPES.join(",")} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      <p className="mut ml-hint">बढीमा {np(MAX_FILES)} फाइल, प्रत्येक ५MB सम्म (फोटो वा PDF)। सन्देश साइटभित्र मात्र रहन्छ, इमेल जाँदैन।</p>
      <div className="msg">{err}</div>
      <div className="row">
        <button disabled={busy} onClick={send}>{busy ? "पठाउँदै…" : "पठाउने"}</button>
        <button className="ghost" disabled={busy} onClick={onCancel}>रद्द</button>
      </div>
    </div>
  );
}

export function MailDialog() {
  const { db, toast } = useVansh();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Thread | null>(null);
  const [mode, setMode] = useState<"list" | "new" | "reply">("list");

  const loadList = useCallback(async () => {
    const { data } = await db.rpc("mail_list");
    setRows(Array.isArray(data) ? (data as Row[]) : []);
  }, [db]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList]);

  const openThread = async (id: string) => {
    const { data, error } = await db.rpc("mail_open", { p_id: id });
    if (error) return toast("⚠ " + error.message);
    setOpen(data as Thread);
    setMode("list");
    loadList();
  };
  const hide = async (id: string) => {
    if (!confirm("यो कुराकानी तपाईंको सूचीबाट हटाउने? अर्को व्यक्तिसँग यो रहिरहन्छ, नयाँ सन्देश आए फेरि देखिन्छ।")) return;
    await db.rpc("mail_hide", { p_id: id });
    setOpen(null);
    loadList();
  };

  if (mode === "new")
    return (
      <div className="dlw ml">
        <h3>✉ नयाँ सन्देश</h3>
        <Compose onCancel={() => setMode("list")} onDone={(id) => { loadList(); openThread(id); }} />
      </div>
    );

  if (open)
    return (
      <div className="dlw ml">
        <h3>✉ {open.subject}</h3>
        <p className="mut">{open.other} सँगको कुराकानी</p>
        <div className="ml-thread">
          {open.messages.map((m) => (
            <div key={m.id} className={"ml-msg" + (m.mine ? " mine" : "")}>
              <div className="ml-meta">{m.mine ? "म" : open.other} · {when(m.at)}</div>
              <p>{m.body}</p>
              {m.attachments.length > 0 && <div className="ml-atts">{m.attachments.map((a) => <Attach key={a.path} a={a} />)}</div>}
            </div>
          ))}
        </div>
        {mode === "reply" ? (
          <Compose thread={open} onCancel={() => setMode("list")} onDone={(id) => openThread(id)} />
        ) : (
          <div className="row">
            {open.can_reply ? <button onClick={() => setMode("reply")}>↩ उत्तर दिने</button> : <span className="mut">यो सदस्यलाई अहिले सन्देश पठाउन मिल्दैन।</span>}
            <button className="ghost" onClick={() => setOpen(null)}>← सूची</button>
            <button className="ghost" onClick={() => hide(open.id)}>सूचीबाट हटाउने</button>
          </div>
        )}
      </div>
    );

  return (
    <div className="dlw ml">
      <h3>✉ सन्देश</h3>
      <div className="row">
        <button onClick={() => setMode("new")}>+ नयाँ सन्देश</button>
      </div>
      {rows === null && <p className="mut">लोड हुँदैछ…</p>}
      {rows?.length === 0 && <p className="mut">कुनै सन्देश छैन। सदस्यले एडमिन वा मोडरेटरलाई सन्देश पठाउन सक्छन्; एडमिन/मोडरेटरले कुनै पनि सदस्यलाई।</p>}
      <div className="ml-list">
        {rows?.map((r) => (
          <button key={r.id} className={"ml-row" + (r.unread ? " unread" : "")} onClick={() => openThread(r.id)}>
            <span className="ml-top">
              <b>{r.other}</b>
              <small>{when(r.last_at)}</small>
            </span>
            <span className="ml-sub">{r.unread && <i className="ml-dot" aria-label="नपढिएको" />}{r.subject}</span>
            <span className="mut ml-snip">{r.mine ? "म: " : ""}{r.snippet}{r.attach ? " 📎" : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
