"use client";
// Home hero for signed-in members: instead of the AI picture, their own small family tree (grandparents → parents →
// them with siblings, spouse and children), set on a framed sheet of paper, with a few facts about them.
// Signed-out visitors, and members without a place in the tree, keep the public hero passed in as children.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { createGraph, myRoles } from "@/lib/vansh/graph";
import { familyEvents, whenLabel } from "@/lib/vansh/events";
import { lineageSvg } from "@/lib/vansh/lineage";
import { fatherLine } from "@/lib/vansh/profileFacts";
import { genNo } from "@/lib/vansh/relations";
import { np } from "@/lib/vansh/text";
import type { VPerson, VProfile } from "@/lib/vansh/types";

interface Loaded {
  name: string;
  people: VPerson[];
  meId: string | null;
}

export default function MemberHero({ children }: { children: React.ReactNode }) {
  const [d, setD] = useState<Loaded | null>(null);

  useEffect(() => {
    let off = false;
    const db = createClient();
    db.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) return;
        const { data: pr } = await db.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
        const p = pr as VProfile | null;
        if (!p || p.suspended_at) return;
        const rs = myRoles(p) as string[];
        let saved: string | null = null;
        try {
          saved = localStorage.getItem("vv_role");
        } catch {}
        const role = saved && rs.includes(saved) ? saved : rs[0] || null;
        const { data: ppl, error } = await db.rpc("get_people", { p_role: role, p_as_person: null });
        if (off || error) return;
        setD({ name: p.full_name || "", people: (ppl as VPerson[]) || [], meId: p.position_person_id || null });
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  const g = useMemo(() => (d ? createGraph(d.people) : null), [d]);
  const me = d && g && d.meId ? g.byId[d.meId] : undefined;
  const tree = useMemo(
    () => (g && me ? lineageSvg(g, me, { selfLabel: "तपाईं", maternal: false, maxSibs: 2, maxKids: 3, noLabels: true }) : null),
    [g, me]
  );
  const today = useMemo(() => {
    if (!d || !me) return null;
    return familyEvents(d.people, { can: (id) => !d.people.find((x) => x.id === id)?.is_locked, meId: me.id }).own;
  }, [d, me]);

  if (!d || !g) return <>{children}</>;
  if (!me || !tree) {
    return (
      <div className="hero-in mh">
        <div className="hero-copy">
          <p className="orn"><span aria-hidden="true" /> नमस्ते <span aria-hidden="true" /></p>
          <h1 id="hero-h">{d.name || "स्वागत छ"}</h1>
          <p className="rule" aria-hidden="true"><i /></p>
          <p className="intro">वंशवृक्षमा आफू को हुनुहुन्छ भनेर छानेपछि यहाँ तपाईंकै परिवारको वृक्ष र विवरण देखिनेछ।</p>
          <div className="row">
            <Link className="btn" href="/app?do=kin">आफ्नो स्थान छान्नुहोस्</Link>
            <Link className="btn ghost" href="/app?tab=tree">वंशावली हेर्नुहोस्</Link>
          </div>
        </div>
      </div>
    );
  }

  const line = fatherLine(g, me, (x) => x.name, 4);
  const gen = genNo(g, me.id);
  const kids = g.kidsOf(me).length;
  const sibs = g.sibsOf(me).filter((s) => s.id !== me.id).length;
  const open = d.people.filter((x) => !x.is_locked).length;
  const more = [tree.moreSibs ? `${np(tree.moreSibs)} दाजुभाइ/दिदीबहिनी` : "", tree.moreKids ? `${np(tree.moreKids)} सन्तान` : ""].filter(Boolean);

  return (
    <div className="hero-in mh">
      <div className="hero-copy">
        <p className="orn"><span aria-hidden="true" /> नमस्ते <span aria-hidden="true" /></p>
        <h1 id="hero-h">{me.name}</h1>
        <p className="rule" aria-hidden="true"><i /></p>
        {line.length > 1 && <p className="mh-line">{line.slice().reverse().join(" → ")}</p>}
        <ul className="mh-facts">
          {gen > 0 && <li><b>{np(gen)}</b> औँ पुस्ता</li>}
          <li><b>{np(sibs)}</b> दाजुभाइ/दिदीबहिनी</li>
          <li><b>{np(kids)}</b> सन्तान</li>
          <li><b>{np(open)}</b> सदस्य तपाईंले हेर्न मिल्ने</li>
        </ul>
        {today && today.days >= 0 && today.days <= 30 && (
          <p className="mh-note">🎂 तपाईंको जन्मदिन {whenLabel(today.days)}{today.detail ? ` · ${today.detail}` : ""}</p>
        )}
        <div className="row">
          <Link className="btn" href="/app?tab=me">मेरो प्रोफाईल</Link>
          <Link className="btn ghost" href="/app?tab=tree">वृक्षमा मेरो स्थान</Link>
        </div>
      </div>
      <figure className="hero-tree" aria-label="तपाईंको परिवारको वृक्ष">
        <div className="ht-sheet" dangerouslySetInnerHTML={{ __html: tree.svg }} />
        <figcaption>
          तपाईंको वृक्ष{more.length ? ` · थप ${more.join(" र ")} पूरा वृक्षमा` : ""}
          <Link href="/app?tab=me">पूरा हेर्ने</Link>
        </figcaption>
      </figure>
    </div>
  );
}
