"use client";
// Home hero for signed-in members: instead of the AI picture, their own small family tree (grandparents → parents →
// them with siblings, spouse and children), set on a framed sheet of paper, with a few facts about them.
// Signed-out visitors, and members without a place in the tree, keep the public hero passed in as children.
import React, { useMemo } from "react";
import Link from "next/link";
import { createGraph } from "@/lib/vansh/graph";
import { useMember } from "./useMember";
import { HeroOccasions, HeroStory } from "./HeroPanels";
import { treeArtSvg } from "@/lib/vansh/treeArt";
import { fatherLine } from "@/lib/vansh/profileFacts";
import { genNo } from "@/lib/vansh/relations";
import { np } from "@/lib/vansh/text";

export default function MemberHero({ children }: { children: React.ReactNode }) {
  const { d } = useMember();

  const g = useMemo(() => (d ? createGraph(d.people) : null), [d]);
  const me = d && g && d.meId ? g.byId[d.meId] : undefined;
  const tree = useMemo(
    () => (g && me ? treeArtSvg(g, me, { maxSibs: 3, maxKids: 4 }) : null),
    [g, me]
  );
  // until the session is known a signed-in member's page keeps the public hero's space but not its look (html[data-auth])
  if (!d || !g) return <div className="mh-wait">{children}</div>;
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
          <div className="hp-grid"><HeroOccasions /></div>
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
        <div className="hp-grid">
          <HeroStory />
          <HeroOccasions />
        </div>
        <div className="row">
          <Link className="btn" href="/app?tab=me">मेरो प्रोफाईल</Link>
          <Link className="btn ghost" href="/app?tab=tree">वृक्षमा मेरो स्थान</Link>
        </div>
      </div>
      <figure className="hero-tree" aria-label="तपाईंको परिवारको वृक्ष">
        <div className="ht-sheet" dangerouslySetInnerHTML={{ __html: tree.svg }} />
        <figcaption>
          जरा: हजुरबुबा-हजुरआमा · काण्ड: बुबा-आमा · हाँगा: तपाईं र दाजुभाइ · पात: सन्तान{more.length ? ` · थप ${more.join(" र ")} पूरा वृक्षमा` : ""}
          <Link href="/app?tab=me">पूरा हेर्ने</Link>
        </figcaption>
      </figure>
    </div>
  );
}
