"use client";
// The two panels a signed-in member sees at the top of the home page, next to their family tree:
// "तपाईंको कथा" (the  story) and "आगामी अवसर" (birthdays, anniversaries, shraddha in the coming week).
import React, { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { generateSelfStory } from "@/lib/vansh/aiSummary";
import { familyEvents, whenLabel, type FamilyEvent } from "@/lib/vansh/events";
import { createGraph } from "@/lib/vansh/graph";
import { np } from "@/lib/vansh/text";
import { useMember } from "./useMember";

const ICON = { birthday: "🎂", shraddha: "🪔", anniversary: "💍" } as const;

const line = (e: FamilyEvent) =>
  e.kind === "birthday"
    ? e.own ? "तपाईंको जन्मदिन" : `${e.person.name} · जन्मदिन`
    : e.kind === "shraddha" ? `${e.person.name} को श्राद्ध` : `${e.person.name}${e.spouse ? " र " + e.spouse.name : ""} · ${e.detail}`;

export function HeroStory() {
  const { d, reload } = useMember();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const me = useMemo(() => (d && d.meId ? createGraph(d.people).byId[d.meId] : undefined), [d]);
  if (!me) return null;
  const story = me.ai_summary_self || "";
  const make = async () => {
    setBusy(true);
    setErr("");
    try {
      await generateSelfStory(createClient(), me.id);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <figure className="hp-story">
      <figcaption>तपाईंको कथा</figcaption>
      <blockquote className={open ? "open" : ""}>
        {story || "तपाईंको परिवार र विवरण हेरेर तपाईंकै बारेमा छोटो कथा लेखिन्छ। नभएको कुरा थप्दैन।"}
      </blockquote>
      {story.length > 170 && (
        <button type="button" className="hp-more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "कम देखाउने" : "पूरा पढ्ने"}
        </button>
      )}
      {!!me.ai_tags?.length && !!story && <p className="hp-tags">{me.ai_tags.map((t) => <span key={t}>#{t}</span>)}</p>}
      <button type="button" className="hp-act" disabled={busy} onClick={make}>
        {busy ? "लेख्दै…" : story ? "↻ फेरि लेख्ने" : "✨ मेरो कथा लेख्ने"}
      </button>
      {err && <small role="alert" className="hp-err">{err}</small>}
    </figure>
  );
}

export function HeroOccasions() {
  const { d } = useMember();
  const events = useMemo(
    () => (d ? familyEvents(d.people, { can: (id) => !d.people.find((x) => x.id === id)?.is_locked, meId: d.meId }) : null),
    [d]
  );
  if (!events) return null;
  const up = events.upcoming.slice(0, 4);
  const ownSoon = events.own && !up.some((u) => u.person.id === events.own!.person.id && u.kind === "birthday") ? events.own : null;
  const extra = events.upcoming.length - up.length;
  return (
    <section className="hp-occ" aria-label="आगामी अवसर">
      <h3>आगामी अवसर</h3>
      {ownSoon && (
        <p className="hp-row own"><i>{ICON.birthday}</i><span><b>तपाईंको जन्मदिन</b><small>{whenLabel(ownSoon.days)}</small></span></p>
      )}
      {up.map((e) => (
        <p key={e.kind + e.person.id} className={`hp-row ${e.days === 0 ? "today" : ""}`}>
          <i>{ICON[e.kind]}</i>
          <span><b>{line(e)}</b><small>{whenLabel(e.days)}{e.kind === "shraddha" ? " · अनुमानित" : ""}</small></span>
        </p>
      ))}
      {!up.length && !ownSoon && <p className="mut">आगामी ७ दिनमा कुनै अवसर छैन।</p>}
      {extra > 0 && <small className="hp-more-n">+{np(extra)} थप अवसर</small>}
    </section>
  );
}
