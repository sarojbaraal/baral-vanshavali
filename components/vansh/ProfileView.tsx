"use client";
// "प्रोफाईल": the signed-in person's own page — facts, biography (AI-written from recorded facts, editable),
// the lineage from the grandfather, the common family facts, and a printable life-sheet.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BASIS, IDENTITY } from "@/lib/vansh/intro";
import { generateBio } from "@/lib/vansh/aiSummary";
import { chartGoto } from "@/lib/vansh/chartGoto";
import { lineageSvg } from "@/lib/vansh/lineage";
import { descendantsSvg } from "@/lib/vansh/descendants";
import { fanSvg } from "@/lib/vansh/fan";
import { jpgBlob, stamp as today10, svgBlob } from "@/lib/vansh/exporters";
import { lifeSheetHtml, openLifeSheet } from "@/lib/vansh/lifesheet";
import { isBaralByBirth } from "@/lib/vansh/gotra";
import { fatherLine, profileFacts } from "@/lib/vansh/profileFacts";
import { genNo, relsOf } from "@/lib/vansh/relations";
import { ageN, np } from "@/lib/vansh/text";
import { openDoc } from "@/lib/vansh/docs";
import { useVansh } from "./VanshContext";
import { Avatar } from "./ui";
import { MineView } from "./RequestViews";
import { AnchorDialog, PersonForm } from "./PersonDialogs";
import { useTodayLabel } from "./HeroAi";
import { DownloadPreview, useStampMaker, type Prepared } from "./DownloadPreview";

export default function ProfileView() {
  const { db, me, g, gPrint, perms, toast, reload, openDialog, closeDialog, setTab, pick } = useVansh();
  const today = useTodayLabel();
  const p = me?.position_person_id ? g.byId[me.position_person_id] : undefined;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [zoom, setZoom] = useState(0.8);

  const chart = useMemo(() => (p ? lineageSvg(g, p, { selfLabel: "म", nm: perms.nm }) : null), [g, p, perms.nm]);

  const desc = useMemo(() => (p ? descendantsSvg(g, p, { nm: perms.nm }) : null), [g, p, perms.nm]);
  const fan = useMemo(() => (p ? fanSvg(g, p, { nm: perms.nm }) : null), [g, p, perms.nm]);
  const mkStamp = useStampMaker();
  const [fanBusy, setFanBusy] = useState("");

  // first view: the whole chart fits the screen (never larger than 80%)
  const descW = desc?.width || 0;
  useEffect(() => {
    if (descW) setZoom(Math.max(0.35, Math.min(0.8, (Math.min(window.innerWidth, 1100) - 64) / descW)));
  }, [descW]);

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
  const family = relsOf(g, p).filter((x) => perms.can(x.q.id));
  const age = ageN(p.birth_bs, p.death_bs);
  const kin = fatherLine(g, p, perms.nm);
  const baral = isBaralByBirth(g, p);

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
    // printed from the graph without hidden people: a hidden relative is not named anywhere on the sheet
    const pp = gPrint.byId[p.id];
    if (p.hidden || !pp) return toast("⚠ लुकाइएको सदस्यको पाना छापिँदैन");
    const html = lifeSheetHtml({
      name: perms.nm(pp),
      photoUrl: pp.photo_url,
      initial: Array.from(pp.name.trim())[0] || "•",
      line: fatherLine(gPrint, pp, perms.nm),
      facts: profileFacts(gPrint, pp, { showEmail: true, nm: perms.nm }),
      bio: pp.bio || "",
      bioAi: !!pp.bio_ai,
      chart: lineageSvg(gPrint, pp, { selfLabel: "म", nm: perms.nm }).svg,
      today,
      baral,
    });
    if (!openLifeSheet(html)) toast("⚠ नयाँ विन्डो खुल्न दिइएन; ब्राउजरमा पप-अप अनुमति दिनुहोस्");
  };
  const saveDesc = () => {
    const pp = gPrint.byId[p.id];
    if (!pp) return toast("⚠ लुकाइएको सदस्यको चार्ट डाउनलोड हुँदैन");
    const out = descendantsSvg(gPrint, pp, { nm: perms.nm });
    const url = URL.createObjectURL(new Blob([out.svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vanshavistar.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // the fan chart as a finished poster (title, legend, usage notice and signature): preview first, then save
  const saveFan = async (kind: "jpg" | "svg") => {
    const pp = gPrint.byId[p.id];
    if (!pp) return toast("⚠ लुकाइएको सदस्यको चार्ट डाउनलोड हुँदैन");
    setFanBusy(kind);
    try {
      const st = await mkStamp(`fan|${pp.id}|${kind}`);
      const out = fanSvg(gPrint, pp, { nm: perms.nm, stamp: st });
      db.rpc("log_print", { p_scope: `fan-${kind}|${perms.act}|${out.known}` }).then(() => {}, () => {});
      const blob = kind === "jpg" ? await jpgBlob(out.svg, out.width - 40, out.height - 40) : svgBlob(out.svg);
      const data: Prepared = { blob, fileName: `purkha-chakra-${today10()}.${kind}`, images: [{ src: URL.createObjectURL(blob) }], note: `${np(out.known)} पुर्खा · हस्ताक्षर ID ${st.id}` };
      openDialog(<DownloadPreview data={data} onCancel={closeDialog} />);
    } catch (e) {
      toast("⚠ " + ((e as Error).message || "चित्र बनाउन सकिएन"));
    } finally {
      setFanBusy("");
    }
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
          <button className="ghost" onClick={() => openDialog(<AnchorDialog />)}>🧭 आफ्नो स्थान</button>
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
          <h3>मेरो परिवार</h3>
          <button className="ghost" onClick={() => openDialog(<PersonForm action="add" />, true)}>+ सदस्य थप्ने</button>
        </div>
        {family.length ? (
          <div className="kin-grid">
            {family.map(({ q, l }) => (
              <button key={q.id} className={`kin g${q.gender || "O"} ${q.is_living === false ? "dead" : ""}`} onClick={() => pick(q.id)}>
                <span className="kin-av"><Avatar g={q.gender} photo={q.photo_url} live={q.is_living} /></span>
                <b>{perms.nm(q)}</b>
                <small>{l}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="mut">बुबा-आमा, जीवनसाथी, दाजुभाइ-दिदीबहिनी वा सन्तान अहिलेसम्म जोडिएका छैनन्।</p>
        )}
      </section>

      {desc && desc.count > 1 && (
        <section className="card desc-card">
          <div className="prof-bar">
            <h3>वंश-विस्तार <span className="mut">· {desc.root.id === p.id ? "तपाईंदेखि तल" : "हजुरबुबादेखि तलका सबै सदस्य"}</span></h3>
            <div className="desc-tools" role="group" aria-label="चार्ट आकार">
              <button className="ghost" aria-label="सानो" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.15).toFixed(2)))}>−</button>
              <span>{np(Math.round(zoom * 100))}%</span>
              <button className="ghost" aria-label="ठूलो" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}>+</button>
              <button className="ghost" onClick={saveDesc}>⬇ SVG</button>
            </div>
          </div>
          <div className="desc-wrap">
            <div className="desc" style={{ width: desc.width * zoom }} dangerouslySetInnerHTML={{ __html: desc.svg }} />
          </div>
          <p className="mut">सुनौलो बाटोले तपाईंसम्मको वंश-क्रम देखाउँछ। दायाँ-बायाँ सार्न स्क्रोल गर्नुहोस्, सानो/ठूलो गर्न + − थिच्नुहोस्।</p>
        </section>
      )}

      {fan && fan.known > 0 && (
        <section className="card fan-card">
          <div className="prof-bar">
            <h3>पुर्खा-चक्र <span className="mut">· ५ पुस्तासम्मका पुर्खा</span></h3>
            {perms.act !== "general" && (
              <div className="desc-tools">
                <button className="ghost" disabled={!!fanBusy} onClick={() => saveFan("jpg")}>{fanBusy === "jpg" ? "बन्दैछ…" : "🖼 पोस्टर (JPG)"}</button>
                <button className="ghost" disabled={!!fanBusy} onClick={() => saveFan("svg")}>{fanBusy === "svg" ? "बन्दैछ…" : "⬇ SVG"}</button>
              </div>
            )}
          </div>
          <div className="fan-wrap" dangerouslySetInnerHTML={{ __html: fan.svg }} />
          <p className="mut">बायाँ भाग बुबाको पक्ष, दायाँ भाग आमाको पक्ष। भित्रबाट बाहिर एक-एक पुस्ता माथि जान्छ; खाली ठाउँ अहिलेसम्म दर्ता नभएका पुर्खा हुन्।</p>
        </section>
      )}

      {baral ? (
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
      ) : (
        <section className="card">
          <div className="prof-bar">
            <h3>गोत्र र प्रवर</h3>
            <Link href="/history">बराल वंशको इतिहास</Link>
          </div>
          <p className="mut">साइटमा देखाइएको गोत्र, वेद र प्रवर बराल थरको हो। तपाईं अर्को थरमा जन्मनुभएकाले तपाईंको गोत्र र प्रवर फरक हुन सक्छ; यहाँ अनुमान गरेर राखिएको छैन।</p>
        </section>
      )}

      <h3 className="prof-h">मेरा अनुरोध</h3>
      <MineView />
    </div>
  );
}
