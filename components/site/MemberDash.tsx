"use client";
// Home page, signed-in members: "तपाईंको कथा" (AI story), the coming occasions and "पारिवारिक तथ्यांक" (family statistics).
// This is the one place for these; the app's family tabs no longer repeat them.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { generateSelfStory } from "@/lib/vansh/aiSummary";
import { familyEvents, whenLabel, type FamilyEvent } from "@/lib/vansh/events";
import { createGraph } from "@/lib/vansh/graph";
import { genNo } from "@/lib/vansh/relations";
import { np } from "@/lib/vansh/text";
import { useMember } from "./useMember";

const ICON = { birthday: "🎂", shraddha: "🪔", anniversary: "💍" } as const;

const line = (e: FamilyEvent) =>
  e.kind === "birthday"
    ? e.own ? "तपाईंको जन्मदिन" : `${e.person.name} · जन्मदिन`
    : e.kind === "shraddha" ? `${e.person.name} को श्राद्ध` : `${e.person.name}${e.spouse ? " र " + e.spouse.name : ""} · ${e.detail}`;

export default function MemberDash() {
  const { d, reload } = useMember();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const g = useMemo(() => (d ? createGraph(d.people) : null), [d]);
  const me = d && g && d.meId ? g.byId[d.meId] : undefined;
  const events = useMemo(
    () => (d ? familyEvents(d.people, { can: (id) => !d.people.find((x) => x.id === id)?.is_locked, meId: d.meId }) : null),
    [d]
  );
  const stats = useMemo(() => {
    if (!d || !g) return null;
    const open = d.people.filter((x) => !x.is_locked);
    const byGen: Record<number, number> = {};
    open.forEach((x) => {
      const n = genNo(g, x.id);
      byGen[n] = (byGen[n] || 0) + 1;
    });
    const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);
    return {
      total: open.length,
      live: open.filter((x) => x.is_living !== false).length,
      men: open.filter((x) => x.gender === "M").length,
      women: open.filter((x) => x.gender === "F").length,
      gens: gens.length ? Math.max(...gens) : 0,
      byGen: gens.map((n) => [n, byGen[n]] as const),
    };
  }, [d, g]);

  if (!d || !g || !stats) return null;

  const make = async () => {
    if (!me) return;
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

  const up = events?.upcoming.slice(0, 5) || [];
  const ownSoon = events?.own && !up.some((u) => u.person.id === events.own!.person.id && u.kind === "birthday") ? events.own : null;
  const max = Math.max(1, ...stats.byGen.map((x) => x[1]));
  const dead = stats.total - stats.live;
  const pct = (n: number) => `${(n / Math.max(1, stats.men + stats.women)) * 100}%`;

  return (
    <section className="sec dash" aria-labelledby="dash-h">
      <div className="sec-in">
        <h2 id="dash-h">तपाईंको परिवार, एक नजरमा</h2>
        <div className="dash-top">
          {me && (
            <figure className="story2">
              <span className="story2-q" aria-hidden="true">“</span>
              <figcaption>तपाईंको कथा</figcaption>
              <blockquote>{me.ai_summary_self || "AI ले तपाईंको परिवार र विवरण हेरेर तपाईंकै बारेमा छोटो कथा लेखिदिन्छ। नभएको कुरा थप्दैन।"}</blockquote>
              {!!me.ai_tags?.length && !!me.ai_summary_self && (
                <p className="story2-t">{me.ai_tags.map((t) => <span key={t}>#{t}</span>)}</p>
              )}
              <button className="btn ghost" disabled={busy} onClick={make}>
                {busy ? "लेख्दै…" : me.ai_summary_self ? "↻ फेरि लेख्ने" : "✨ मेरो कथा लेख्ने"}
              </button>
              {err && <small role="alert" className="dash-err">{err}</small>}
            </figure>
          )}
          <div className="occ">
            <h3>आगामी अवसर</h3>
            {ownSoon && (
              <p className="occ-row own"><i>{ICON.birthday}</i><span><b>तपाईंको जन्मदिन</b><small>{whenLabel(ownSoon.days)}</small></span></p>
            )}
            {up.length ? (
              up.map((e) => (
                <p key={e.kind + e.person.id} className={`occ-row ${e.days === 0 ? "today" : ""}`}>
                  <i>{ICON[e.kind]}</i>
                  <span><b>{line(e)}</b><small>{whenLabel(e.days)}{e.kind === "shraddha" ? " · अनुमानित" : ""}</small></span>
                </p>
              ))
            ) : !ownSoon ? (
              <p className="mut">आगामी ७ दिनमा कुनै अवसर छैन।</p>
            ) : null}
            {(events?.upcoming.length || 0) > 5 && <small>+{np((events?.upcoming.length || 0) - 5)} थप अवसर</small>}
          </div>
        </div>

        <div className="stat">
          <div className="stat-h">
            <h3>पारिवारिक तथ्यांक</h3>
            {d.staff && <Link href="/app?tab=ov">विस्तृत तथ्यांक</Link>}
          </div>
          <ul className="stat-tiles">
            <li><b>{np(stats.total)}</b><span>कुल सदस्य</span></li>
            <li><b>{np(stats.live)}</b><span>जीवित</span></li>
            <li><b>{np(dead)}</b><span>दिवङ्गत</span></li>
            <li><b>{np(stats.gens)}</b><span>पुस्ता</span></li>
          </ul>
          <div className="stat-cols">
            <div>
              <h4>पुस्ताअनुसार सदस्य</h4>
              <div className="gbars" role="img" aria-label="पुस्ताअनुसार सदस्य सङ्ख्या">
                {stats.byGen.map(([n, c]) => (
                  <div key={n} className="gbar" title={`${np(n)} औँ पुस्ता: ${np(c)}`}>
                    <em>{np(c)}</em>
                    <i style={{ height: `${Math.max(6, (c / max) * 100)}%` }} />
                    <span>{np(n)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4>लिङ्ग अनुपात</h4>
              <div className="split" role="img" aria-label={`पुरुष ${stats.men}, महिला ${stats.women}`}>
                <i className="m" style={{ width: pct(stats.men) }} />
                <i className="f" style={{ width: pct(stats.women) }} />
              </div>
              <p className="split-l"><span><s className="m" />पुरुष {np(stats.men)}</span><span><s className="f" />महिला {np(stats.women)}</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
