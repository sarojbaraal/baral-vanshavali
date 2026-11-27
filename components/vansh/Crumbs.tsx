"use client";
// Breadcrumb: shown only where the reader is "deep" (a selected person, statistics, admin, profile).
// Ancestor chips are lineage (father line), styled differently from the section links.
import Link from "next/link";
import { useMemo } from "react";
import { useVansh } from "./VanshContext";
import type { TabKey } from "@/lib/vansh/types";

const SECTION: Record<TabKey, string> = {
  tree: "वंशवृक्ष",
  fam: "सदस्यहरू",
  mem: "सदस्यहरू",
  me: "मेरो प्रोफाइल",
  mine: "मेरो प्रोफाइल",
  ov: "पारिवारिक तथ्यांक",
  pf: "प्रोफाइल",
  admin: "प्रशासन",
};
const MAX_ANC = 3;

export default function Crumbs({ tab }: { tab: TabKey }) {
  const { g, sel: selected, setTab, pick, unpick, profId, openProfile, closeProfile } = useVansh();
  const isPf = tab === "pf";
  const sel = isPf ? profId : selected;
  const lineage = useMemo(() => {
    const out: string[] = [];
    let cur = sel ? g.byId[sel] : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift(cur.id);
      const nxt: string | null | undefined = cur.father_id || cur.mother_id;
      cur = nxt ? g.byId[nxt] : undefined;
    }
    return out;
  }, [g.byId, sel]);

  const person = sel ? g.byId[sel] : undefined;
  const deep = !!person || tab === "ov" || tab === "admin" || tab === "me" || tab === "mine";
  if (!deep) return null;

  const anc = lineage.slice(0, -1);
  const shown = anc.slice(-MAX_ANC);
  const cut = anc.length > shown.length;

  return (
    <nav className="crumbs" aria-label="तपाईं यहाँ हुनुहुन्छ">
      <ol>
        <li><Link href="/">गृह</Link></li>
        <li>
          {person ? (
            <button type="button" onClick={() => (isPf ? closeProfile() : (unpick(), setTab(tab)))}>{isPf ? "सदस्यहरू" : SECTION[tab]}</button>
          ) : (
            <span aria-current="page">{SECTION[tab]}</span>
          )}
        </li>
        {person && cut && <li className="lin"><span title="अझ माथिका पुर्खा" aria-hidden="true">…</span></li>}
        {person && shown.map((id) => (
          <li key={id} className="lin">
            <button type="button" title="पुर्खा" onClick={() => (isPf ? openProfile(id) : pick(id))}>{g.byId[id]?.name}</button>
          </li>
        ))}
        {person && <li className="cur"><span aria-current="page">{person.name}{isPf ? " · प्रोफाइल" : ""}</span></li>}
      </ol>
    </nav>
  );
}
