"use client";
// Public contact form: the message is stored in Supabase (site_messages) and read by admins inside the app.
import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { mailMessage } from "@/lib/vansh/notify";

const TOPICS = ["सामान्य जिज्ञासा", "आफ्नो परिवार वंशावलीमा जोड्न", "विवरण सच्याउन", "इतिहास वा स्रोतबारे", "कागज, फोटो वा कृति पठाउन", "अन्य"];

export default function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", topic: TOPICS[0], body: "", website: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setState("busy");
    const db = createClient();
    const { data, error } = await db.rpc("submit_message", {
      p_kind: "contact",
      p_name: f.name,
      p_email: f.email,
      p_subject: f.topic,
      p_body: f.body,
      p_page: "/contact",
      p_hp: f.website,
      p_elapsed: opened.current ? Date.now() - opened.current : null,
    });
    if (error) {
      setErr(error.message);
      setState("idle");
    } else {
      mailMessage(db, data);
      setState("done");
    }
  };

  if (state === "done")
    return (
      <div className="cf-done" role="status">
        <h3>सन्देश पठाइयो</h3>
        <p>धन्यवाद। तपाईंले दिएको इमेलमा हामी जवाफ दिन्छौं।</p>
      </div>
    );
  return (
    <form className="cf" onSubmit={submit} noValidate>
      <div className="cf-row">
        <label>
          नाम
          <input value={f.name} onChange={set("name")} maxLength={120} autoComplete="name" required />
        </label>
        <label>
          इमेल
          <input type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
        </label>
      </div>
      <label>
        विषय
        <select value={f.topic} onChange={set("topic")}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        सन्देश
        <textarea rows={6} value={f.body} onChange={set("body")} maxLength={4000} required />
      </label>
      {/* honeypot: people never see or fill this */}
      <div className="cf-hp" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
        </label>
      </div>
      <p className="cf-err" role="alert">{err}</p>
      <button className="btn" type="submit" disabled={state === "busy"}>
        {state === "busy" ? "पठाउँदै…" : "सन्देश पठाउनुहोस्"}
      </button>
    </form>
  );
}
