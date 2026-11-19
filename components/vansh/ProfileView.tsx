"use client";
// "प्रोफाईल": the signed-in person's own page — facts, biography (AI-written from recorded facts, editable),
// the lineage from the grandfather, the common family facts, and a printable life-sheet.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { BASIS, IDENTITY } from "@/lib/vansh/intro";
import { generateBio } from "@/lib/vansh/aiSummary";
import { chartGoto } from "@/lib/vansh/chartGoto";
import { lineageSvg } from "@/lib/vansh/lineage";
import { lifeSheetHtml, openLifeSheet } from "@/lib/vansh/lifesheet";
import { fatherLine, profileFacts } from "@/lib/vansh/profileFacts";
import { genNo } from "@/lib/vansh/relations";
import { ageN, np } from "@/lib/vansh/text";
import { openDoc } from "@/lib/vansh/docs";
import { useVansh } from "./VanshContext";
import { Avatar } from "./ui";
import { MineView } from "./RequestViews";
import { AnchorDialog, PersonForm } from "./PersonDialogs";
import { useTodayLabel } from "./HeroAi";

export default function ProfileView() {
  const { db, me, g, perms, toast, reload, openDialog, setTab } = useVansh();
  const today = useTodayLabel();
  const p = me?.position_person_id ? g.byId[me.position_person_id] : undefined;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const chart = useMemo(() => (p ? lineageSvg(g, p, { selfLabel: "म", nm: perms.nm }) : null), [g, p, perms.nm]);

  if (!p)
    return (
      <div className="prof">
        <section className="card prof-empty">
          <h2>आफ्नो स्थान छान्नुहोस्</h2>
          <p>वंशवृक्षमा आफू को हुनुहुन्छ भनेर छानेपछि यहाँ तपाईंको प्रोफाईल, जीवनी र हजुरबुबादेखिको वंशवृक्ष बन्छ।</p>
          <button onClick={() => openDialog(<AnchorDialog />)}>आफ्नो स्थान छान्ने</button>
        </section>
        <h3 className="prof-h">मेरा अनुरोध</h3>
        <MineView />
      </div>
    );

  const facts = profileFacts(g, p, { showEmail: true, nm: perms.nm });
  const gen = genNo(g, p.id);
  const age = ageN(p.birth_bs, p.death_bs);
  const kin = fatherLine(g, p, perms.nm);

  const write = async () => {
    setBusy(true);
    try {
      await generateBio(db, p.id);
      await reload();
      toast("✅ जीवनी तयार भयो");
    } catch (e) {
      toast("⚠ " + (e as Error).message);
    }
    setBusy(false);
  };
  const saveDraft = async () => {
    setBusy(true);
    const { error } = await db.rpc("set_bio", { p_person: p.id, p_bio: draft });
    setBusy(false);
    if (error) return toast("⚠ " + error.message);
    setEditing(false);
    await reload();
    toast("✅ जीवनी सुरक्षित भयो");
  };
  const print = () => {
    const html = lifeSheetHtml({
      name: perms.nm(p),
      photoUrl: p.photo_url,
      initial: Array.from(p.name.trim())[0] || "•",
      line: kin,
      facts,
      bio: p.bio || "",
      bioAi: !!p.bio_ai,
      chart: lineageSvg(g, p, { selfLabel: "म", nm: perms.nm }).svg,
      today,
    });
    if (!openLifeSheet(html)) toast("⚠ नयाँ विन्डो खुल्न दिइएन; ब्राउजरमा पप-अप अनुमति दिनुहोस्");
  };
  const seeInTree = () => {
    chartGoto.id = p.id;
    setTab("tree");
  };

  return (
    <div className="prof">
      <section className="prof-hero">
        <span className="prof-av"><Avatar g={p.gender} photo={p.photo_url} /></span>
        <div className="prof-id">
          <h2>{p.is_living === false ? "स्व. " : ""}{p.name}</h2>
          <p className="prof-kin">{kin.length > 1 ? kin.join(" → ") : "वंश-क्रम पूरा भइसकेको छैन"}</p>
          <p className="prof-chips">
            {gen > 0 && <span>{np(gen)} औँ पुस्ता</span>}
            {age !== null && p.is_living !== false && <span>उमेर {np(age)} वर्ष</span>}
            <span>{p.is_living === false ? "दिवङ्गत" : "जीवित"}</span>
          </p>
        </div>
        <div className="prof-act">
          <button onClick={() => openDialog(<PersonForm action="update" p={p} />, true)}>✏ विवरण सच्याउने</button>
          <button className="ghost" onClick={print}>🖨 छाप्ने पाना</button>
          <button className="ghost" onClick={seeInTree}>🌳 वृक्षमा हेर्ने</button>
        </div>
      </section>

      <div className="prof-grid">
        <section className="card">
          <h3>जीवनी</h3>
          {editing ? (
            <>
              <textarea rows={12} value={draft} maxLength={4000} onChange={(e) => setDraft(e.target.value)} />
              <div className="row">
                <button disabled={busy} onClick={saveDraft}>सुरक्षित गर्ने</button>
                <button className="ghost" onClick={() => setEditing(false)}>रद्द</button>
              </div>
            </>
          ) : p.bio ? (
            <>
              <div className="bio">{p.bio.split(/\n{2,}/).map((x, i) => <p key={i}>{x}</p>)}</div>
              <p className="mut bio-src">
                {p.bio_ai ? "🤖 रेकर्डमा भएका तथ्यबाट AI ले लेखेको। गलत भए आफैँ सच्याउनुहोस्।" : "✍ आफैँले लेखेको / सच्याएको।"}
              </p>
            </>
          ) : (
            <p className="mut">
              जीवनी अहिलेसम्म लेखिएको छैन। AI ले रेकर्डमा भएको विवरण (जन्म, परिवार, शिक्षा, पेशा) बाट लेखिदिन्छ; नभएको कुरा थप्दैन। विवरण जति पूरा, जीवनी उति राम्रो।
            </p>
          )}
          {!editing && (
            <div className="row">
              <button disabled={busy} onClick={write}>{busy ? "लेख्दै…" : p.bio ? "🤖 AI बाट फेरि लेख्ने" : "🤖 AI बाट जीवनी लेख्ने"}</button>
              <button className="ghost" onClick={() => { setDraft(p.bio || ""); setEditing(true); }}>{p.bio ? "आफैँ सच्याउने" : "आफैँ लेख्ने"}</button>
            </div>
          )}
        </section>

        <section className="card">
          <h3>विवरण</h3>
          <dl className="facts">
            {facts.map((f) => (
              <React.Fragment key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </React.Fragment>
            ))}
          </dl>
          {!facts.length && <p className="mut">थप विवरण राखिएको छैन।</p>}
          {!!p.documents?.length && (
            <p className="dl">
              {p.documents.map((d) => (
                <button key={d.path} type="button" className="ghost" onClick={async () => { const e = await openDoc(db, d.path); if (e) toast(e); }}>📄 {d.name}</button>
              ))}
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="prof-bar">
          <h3>हजुरबुबादेखिको वंशवृक्ष</h3>
          <button className="ghost" onClick={print}>🖨 कलात्मक पाना छाप्ने</button>
        </div>
        <div className="lineage" dangerouslySetInnerHTML={{ __html: chart?.svg || "" }} />
        <p className="mut">बुबा-आमाको नाम रेकर्डमा भए मात्र माथिल्ला पुस्ता देखिन्छन्। नपुगेको विवरण थप्न &ldquo;विवरण सच्याउने&rdquo; प्रयोग गर्नुहोस्।</p>
      </section>

      <section className="card">
        <div className="prof-bar">
          <h3>साझा वंश-जानकारी</h3>
          <Link href="/history">पूरा इतिहास पढ्नुहोस्</Link>
        </div>
        <dl className="facts">
          {IDENTITY.filter((x) => ["गोत्र", "वेद", "प्रवर", "थरको स्रोत"].includes(x.k)).map((x) => (
            <React.Fragment key={x.k}>
              <dt>{x.k}</dt>
              <dd>
                {x.v} <span className="ev" title={BASIS[x.b].t}>{BASIS[x.b].l}</span>
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </section>

      <h3 className="prof-h">मेरा अनुरोध</h3>
      <MineView />
    </div>
  );
}
