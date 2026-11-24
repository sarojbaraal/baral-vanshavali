"use client";
// Home page, signed-in members: "पारिवारिक तथ्यांक". Pick a tile and the chart below follows it; pick a bar and the
// people behind it are listed. (The story and the coming occasions sit in the hero, next to the member's own tree.)
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { createGraph } from "@/lib/vansh/graph";
import { genNo } from "@/lib/vansh/relations";
import { bsYear, np, yr } from "@/lib/vansh/text";
import type { VPerson } from "@/lib/vansh/types";
import { useMember } from "./useMember";

type Subset = "all" | "live" | "dead" | "men" | "women";
type Dim = "gen" | "age";

const TILES: { k: Subset; l: string; dim?: Dim }[] = [
  { k: "all", l: "कुल सदस्य" },
  { k: "live", l: "जीवित" },
  { k: "dead", l: "दिवङ्गत" },
  { k: "men", l: "पुरुष" },
  { k: "women", l: "महिला" },
];
const SUBSET_NAME: Record<Subset, string> = { all: "सबै सदस्य", live: "जीवित सदस्य", dead: "दिवङ्गत सदस्य", men: "पुरुष सदस्य", women: "महिला सदस्य" };
const AGE_LABELS = ["०–९", "१०–१९", "२०–२९", "३०–३९", "४०–४९", "५०–५९", "६०–६९", "७०–७९", "८०+"];

interface Group { key: string; label: string; ppl: VPerson[] }

export default function MemberDash() {
  const { d } = useMember();
  const [sub, setSub] = useState<Subset>("all");
  const [dim, setDim] = useState<Dim>("gen");
  const [sel, setSel] = useState<string | null>(null);

  const g = useMemo(() => (d ? createGraph(d.people) : null), [d]);
  const open = useMemo(() => (d ? d.people.filter((x) => !x.is_locked) : []), [d]);
  const gens = useMemo(() => {
    const m: Record<string, number> = {};
    if (g) open.forEach((x) => (m[x.id] = genNo(g, x.id)));
    return m;
  }, [g, open]);

  const subset = useMemo(() => {
    const f: Record<Subset, (p: VPerson) => boolean> = {
      all: () => true,
      live: (p) => p.is_living !== false,
      dead: (p) => p.is_living === false,
      men: (p) => p.gender === "M",
      women: (p) => p.gender === "F",
    };
    return open.filter(f[sub]);
  }, [open, sub]);

  const groups: Group[] = useMemo(() => {
    if (dim === "gen") {
      const m = new Map<number, VPerson[]>();
      subset.forEach((p) => m.set(gens[p.id], [...(m.get(gens[p.id]) || []), p]));
      return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([n, ppl]) => ({ key: "g" + n, label: np(n), ppl }));
    }
    const now = bsYear();
    const B: VPerson[][] = AGE_LABELS.map(() => []);
    const unk: VPerson[] = [];
    subset.forEach((p) => {
      const b = parseInt(yr(p.birth_bs));
      const e = p.is_living !== false ? now : parseInt(yr(p.death_bs));
      if (!b || !e || e < b) unk.push(p);
      else B[Math.min(8, Math.floor((e - b) / 10))].push(p);
    });
    const out = B.map((ppl, i) => ({ key: "a" + i, label: AGE_LABELS[i], ppl }));
    if (unk.length) out.push({ key: "au", label: "?", ppl: unk });
    return out;
  }, [subset, dim, gens]);

  if (!d || !g) return null;

  const total = open.length;
  const live = open.filter((x) => x.is_living !== false).length;
  const nGens = Math.max(0, ...Object.values(gens));
  const count: Record<Subset, number> = {
    all: total, live, dead: total - live,
    men: open.filter((x) => x.gender === "M").length,
    women: open.filter((x) => x.gender === "F").length,
  };
  const max = Math.max(1, ...groups.map((x) => x.ppl.length));
  const picked = groups.find((x) => x.key === sel) || null;
  const stay = () => {
    try { sessionStorage.setItem("vv_back", "/#stats|" + Date.now()); } catch {}
  };

  return (
    <section className="sec dash" id="stats" aria-labelledby="dash-h">
      <div className="sec-in">
        <div className="stat">
          <div className="stat-h">
            <h2 id="dash-h">पारिवारिक तथ्यांक</h2>
            {d.staff && <Link href="/app?tab=ov" onClick={stay}>विस्तृत तथ्यांक</Link>}
          </div>
          <ul className="stat-tiles" role="group" aria-label="तथ्यांक छान्नुहोस्">
            {TILES.map((t) => (
              <li key={t.k}>
                <button type="button" className={sub === t.k ? "on" : ""} aria-pressed={sub === t.k} onClick={() => { setSub(t.k); setSel(null); }}>
                  <b>{np(count[t.k])}</b>
                  <span>{t.l}</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className={dim === "gen" && sub === "all" ? "on" : ""} aria-pressed={dim === "gen" && sub === "all"} onClick={() => { setSub("all"); setDim("gen"); setSel(null); }}>
                <b>{np(nGens)}</b>
                <span>पुस्ता</span>
              </button>
            </li>
          </ul>

          <div className="sx-head">
            <h3>{SUBSET_NAME[sub]} · {dim === "gen" ? "पुस्ताअनुसार" : "उमेरअनुसार (वर्ष)"}</h3>
            <div className="sx-seg" role="group" aria-label="कसरी बाँडेर हेर्ने">
              <button type="button" className={dim === "gen" ? "on" : ""} aria-pressed={dim === "gen"} onClick={() => { setDim("gen"); setSel(null); }}>पुस्ता</button>
              <button type="button" className={dim === "age" ? "on" : ""} aria-pressed={dim === "age"} onClick={() => { setDim("age"); setSel(null); }}>उमेर</button>
            </div>
          </div>
          {groups.length ? (
            <div className="gbars" role="group" aria-label={`${SUBSET_NAME[sub]}को वितरण`}>
              {groups.map((x) => {
                const m = x.ppl.filter((p) => p.gender === "M").length;
                const f = x.ppl.filter((p) => p.gender === "F").length;
                const o = x.ppl.length - m - f;
                const h = Math.max(6, (x.ppl.length / max) * 100);
                return (
                  <button
                    key={x.key}
                    type="button"
                    className={"gbar" + (sel === x.key ? " on" : "")}
                    aria-pressed={sel === x.key}
                    title={`${dim === "gen" ? np(x.label) + " औँ पुस्ता" : x.label + " वर्ष"}: ${np(x.ppl.length)} (पुरुष ${np(m)}, महिला ${np(f)})`}
                    onClick={() => setSel(sel === x.key ? null : x.key)}
                  >
                    <em>{np(x.ppl.length)}</em>
                    <span className="gcol" style={{ height: `${h}%` }}>
                      <i className="m" style={{ flexGrow: m }} />
                      <i className="f" style={{ flexGrow: f }} />
                      {o > 0 && <i className="o" style={{ flexGrow: o }} />}
                    </span>
                    <span className="gl">{x.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mut">देखाउन सदस्य छैनन्।</p>
          )}
          <p className="split-l"><span><s className="m" />पुरुष</span><span><s className="f" />महिला</span><span className="mut">{picked ? "" : "कुनै स्तम्भ थिच्दा सदस्यको नाम देखिन्छ"}</span></p>

          {picked && (
            <div className="sx-list" aria-live="polite">
              <h4>
                {dim === "gen" ? `${picked.label} औँ पुस्ता` : `${picked.label} वर्ष`} · {np(picked.ppl.length)} जना
                <button type="button" className="sx-x" onClick={() => setSel(null)} aria-label="बन्द गर्नुहोस्">×</button>
              </h4>
              <ul>
                {picked.ppl.slice().sort(g.byBirth).slice(0, 30).map((p) => (
                  <li key={p.id} className={p.gender === "F" ? "f" : p.gender === "M" ? "m" : ""}>
                    <b>{p.name}</b>
                    <small>{yr(p.birth_bs) ? np(yr(p.birth_bs)) : ""}{p.is_living === false ? " · दिवङ्गत" : ""}</small>
                  </li>
                ))}
              </ul>
              {picked.ppl.length > 30 && <small className="mut">+{np(picked.ppl.length - 30)} जना — सबै हेर्न <Link href="/app?tab=fam">सदस्य सूची</Link> खोल्नुहोस्</small>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
