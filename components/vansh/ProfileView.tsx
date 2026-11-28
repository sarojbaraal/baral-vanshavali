"use client";
// "प्रोफाईल": the signed-in person's own page — facts, biography (AI-written from recorded facts, editable),
// the lineage from the grandfather, the common family facts, and a printable life-sheet.
import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BASIS, IDENTITY } from "@/lib/vansh/intro";
import { generateBio } from "@/lib/vansh/aiSummary";
import { chartGoto } from "@/lib/vansh/chartGoto";
import { lineageSvg } from "@/lib/vansh/lineage";
import { descendantsSvg } from "@/lib/vansh/descendants";
import { fanSvg } from "@/lib/vansh/fan";
import { loadPhotos, pdfBlob, stamp as today10, svgBlob } from "@/lib/vansh/exporters";
import { getSiteAvatars, subscribeSiteAvatars, type SiteAvatars } from "@/lib/vansh/avatars";
import { lifeSheetHtml, openLifeSheet } from "@/lib/vansh/lifesheet";
import { muralSvg } from "@/lib/vansh/mural";
import { isBaralByBirth } from "@/lib/vansh/gotra";
import { fatherLine, profileFacts } from "@/lib/vansh/profileFacts";
import { genNo, relsOf } from "@/lib/vansh/relations";
import { np } from "@/lib/vansh/text";
import { ageLabel, deceasedLine } from "@/lib/vansh/bs";
import { openDoc } from "@/lib/vansh/docs";
import { useVansh } from "./VanshContext";
import { Avatar } from "./ui";
import { MineView } from "./RequestViews";
import { AnchorDialog, PersonForm } from "./PersonDialogs";
import { useTodayLabel } from "./HeroAi";
import { DownloadPreview, useStampMaker, type Prepared } from "./DownloadPreview";
import { ChartMenu, ZoomPill } from "./ChartMenu";
import { FieldRequestDialog } from "./FieldAccess";
import { autoBio } from "@/lib/vansh/aiSummary";

// profiles already tried in this browser session (the server also limits to one try per person per hour)
const triedBio = new Set<string>();

export default function ProfileView({ pid }: { pid?: string }) {
  const { db, me, g, gPrint, perms, toast, reload, openDialog, closeDialog, setTab, pick, openProfile, closeProfile } = useVansh();
  const today = useTodayLabel();
  // pid → someone's page opened from the side panel / lists; without it, the signed-in person's own page.
  // Same layout either way; the server has already removed whatever this viewer may not see.
  const ownId = me?.position_person_id || undefined;
  const p = (pid ? g.byId[pid] : ownId ? g.byId[ownId] : undefined) as typeof g.people[number] | undefined;
  const other = !!pid && pid !== ownId;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [zoom, setZoom] = useState(0.8);

  const site = useSyncExternalStore(subscribeSiteAvatars, getSiteAvatars, () => ({}) as SiteAvatars);
  const chart = useMemo(() => (p ? lineageSvg(g, p, { selfLabel: other ? "यही व्यक्ति" : "म", nm: perms.nm }) : null), [g, p, perms.nm, other]);

  const royal = useMemo(() => (p ? muralSvg(g, p, { nm: perms.nm, avatars: site }) : null), [g, p, perms.nm, site]);
  const desc = useMemo(() => (p ? descendantsSvg(g, p, { nm: perms.nm, avatars: site }) : null), [g, p, perms.nm, site]);
  const fan = useMemo(() => (p ? fanSvg(g, p, { nm: perms.nm, avatars: site }) : null), [g, p, perms.nm, site]);
  const mkStamp = useStampMaker();
  const [fanBusy, setFanBusy] = useState("");

  // first view: the whole chart fits the screen (never larger than 80%)
  const descW = desc?.width || 0;
  useEffect(() => {
    if (descW) setZoom(Math.max(0.35, Math.min(0.8, (Math.min(window.innerWidth, 1100) - 64) / descW)));
  }, [descW]);

  // a profile with no biography gets one written automatically the first time it is opened
  const autoId = p && !p.is_locked && !p.bio?.trim() && !p.bio_draft?.trim() ? p.id : null;
  useEffect(() => {
    if (!autoId || triedBio.has(autoId) || !me) return;
    triedBio.add(autoId);
    autoBio(db, autoId).then((ok) => { if (ok) void reload(); }).catch(() => {});
  }, [autoId, db, me, reload]);

  if (!p && other)
    return (
      <div className="prof">
        <section className="card prof-empty">
          <h2>यो प्रोफाइल देखिएन</h2>
          <p>यो व्यक्ति सूचीमा छैन वा तपाईंलाई देखाउन मिल्दैन।</p>
          <button onClick={closeProfile}>← फर्कनुहोस्</button>
        </section>
      </div>
    );
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

  const facts = profileFacts(g, p, { showEmail: !other, nm: perms.nm });
  const gen = genNo(g, p.id);
  const family = relsOf(g, p).filter((x) => perms.can(x.q.id));
  const age = ageLabel(p);
  const kin = fatherLine(g, p, perms.nm);
  const baral = isBaralByBirth(g, p);

  const write = async () => {
    setBusy(true);
    try {
      const asDraft = await generateBio(db, p.id);
      await reload();
      toast(asDraft ? "✅ तपाईंको जीवनी जस्ताको तस्तै छ — नयाँ मस्यौदा तल राखिएको छ" : "✅ जीवनी तयार भयो");
    } catch (e) {
      toast("⚠ " + (e as Error).message);
    }
    setBusy(false);
  };
  const resolveDraft = async (action: "append" | "replace" | "discard") => {
    setBusy(true);
    const { error } = await db.rpc("resolve_bio_draft", { p_person: p.id, p_action: action });
    setBusy(false);
    if (error) return toast("⚠ " + error.message);
    await reload();
    toast(action === "discard" ? "मस्यौदा हटाइयो" : "✅ जीवनी अद्यावधिक भयो");
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
    const mural = muralSvg(gPrint, pp, { nm: perms.nm, avatars: site });
    const html = lifeSheetHtml({
      name: perms.nm(pp),
      photoUrl: pp.photo_url || (pp.gender === "F" ? site.F : site.M),
      initial: Array.from(pp.name.trim())[0] || "•",
      line: fatherLine(gPrint, pp, perms.nm),
      facts: profileFacts(gPrint, pp, { showEmail: true, nm: perms.nm }),
      bio: pp.bio || "",
      bioAi: !!pp.bio_ai,
      chart: lineageSvg(gPrint, pp, { selfLabel: "म", nm: perms.nm }).svg,
      mural: mural && mural.ids.length > 1 ? mural.svg : undefined,
      today,
      baral,
    });
    if (!openLifeSheet(html)) toast("⚠ नयाँ विन्डो खुल्न दिइएन; ब्राउजरमा पप-अप अनुमति दिनुहोस्");
  };
  // every chart download: the site's default avatar (or the person's photo) is embedded, so the file stands alone;
  // PDF / SVG only, previewed before saving, with the usage notice and signature on the poster-type charts
  const saveChart = async (kind: "royal" | "desc" | "fan", fmt: "pdf" | "svg") => {
    const pp = gPrint.byId[p.id];
    if (!pp) return toast("⚠ लुकाइएको सदस्यको चार्ट डाउनलोड हुँदैन");
    if (perms.act === "general") return toast("⚠ डाउनलोडको अनुमति छैन");
    setFanBusy(kind);
    try {
      const st = await mkStamp(`${kind}|${pp.id}|${fmt}`);
      const photos = await loadPhotos(gPrint.people.filter((x) => x.photo_url), perms.can);
      const o = { nm: perms.nm, photos, avatars: site };
      const out = kind === "royal" ? muralSvg(gPrint, pp, { ...o, stamp: st }) : kind === "desc" ? descendantsSvg(gPrint, pp, o) : fanSvg(gPrint, pp, { ...o, stamp: st });
      const n = "ids" in out ? out.ids.length : "count" in out ? out.count : out.known;
      db.rpc("log_print", { p_scope: `${kind}-${fmt}|${perms.act}|${n}` }).then(() => {}, () => {});
      const blob = fmt === "pdf" ? await pdfBlob(out.svg, out.width, out.height) : svgBlob(out.svg);
      const names = { royal: "vanshavriksha", desc: "vanshavistar", fan: "purkha-chakra" } as const;
      const data: Prepared = {
        blob,
        fileName: `${names[kind]}-${today10()}.${fmt}`,
        images: [{ src: URL.createObjectURL(svgBlob(out.svg)) }],
        note: `${np(n)} सदस्य · हस्ताक्षर ID ${st.id}`,
      };
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
            {age && p.is_living !== false && <span>उमेर {age}</span>}
            <span>{p.is_living === false ? "दिवङ्गत" + (deceasedLine(p) ? ": " + deceasedLine(p) : "") : "जीवित"}</span>
          </p>
        </div>
        <div className="prof-act">
          {other && <button className="ghost" onClick={closeProfile}>← फर्कनुहोस्</button>}
          {(!other || perms.canEdit(p.id)) && <button onClick={() => openDialog(<PersonForm action="update" p={p} />, true)}>✏ विवरण सच्याउने</button>}
          {!other && <button className="ghost" onClick={print}>🖨 छाप्ने पाना</button>}
          <button className="ghost" onClick={seeInTree}>🌳 वृक्षमा हेर्ने</button>
          {!other && <button className="ghost" onClick={() => openDialog(<AnchorDialog />)}>🧭 आफ्नो स्थान</button>}
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
                {p.bio_ai ? "रेकर्डमा भएका तथ्यबाट लेखिएको हो, गलत भए आफैँ सच्याउनुहोस्।" : "✍ आफैँले लेखेको / सच्याएको। लेखेको जानकारी आफै मेटिदैन।"}
                {!p.bio_ai && (p.bio_facts?.length ?? 0) > 0 && ` यसबाट ${p.bio_facts!.length} तथ्य सिकिएको छ र अर्को मस्यौदामा प्रयोग गरिनेछ।`}
              </p>
              {!other && p.bio_draft && (
                <div className="bio-draft">
                  <b>नयाँ मस्यौदा</b>
                  <div className="bio">{p.bio_draft.split(/\n{2,}/).map((x, i) => <p key={i}>{x}</p>)}</div>
                  <div className="row">
                    <button disabled={busy} onClick={() => resolveDraft("append")}>आफ्नो जीवनीमा थप्ने</button>
                    <button className="ghost" disabled={busy} onClick={() => resolveDraft("replace")}>यसैले बदल्ने</button>
                    <button className="ghost" disabled={busy} onClick={() => resolveDraft("discard")}>हटाउने</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mut">
              {other ? "जीवनी अहिलेसम्म लेखिएको छैन।" : "जीवनी अहिलेसम्म लेखिएको छैन। रेकर्डमा भएको विवरण (जन्म, परिवार, शिक्षा, पेशा) बाट जीवनी लेखिन्छ।"}
            </p>
          )}
          {!editing && !other && (
            <div className="row">
              <button disabled={busy} onClick={write}>{busy ? "लेख्दै…" : p.bio ? (p.bio_ai ? "फेरि लेख्ने" : "मस्यौदा बनाउने") : "बाट जीवनी लेख्ने"}</button>
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
                <dd className={f.locked ? "lockd" : undefined} title={f.locked ? "यो विवरण मालिकले वा साइटको नियमले लुकाएको छ" : undefined}>{f.v}
                  {f.locked && f.key && other && me?.position_person_id && (
                    <button type="button" className="fa-ask" onClick={() => openDialog(<FieldRequestDialog personId={p.id} fields={[f.key!]} name={p.name} />)}>
                      अनुमति माग्ने
                    </button>
                  )}
                </dd>
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
          {perms.act !== "general" && royal && royal.ids.length > 1 && <ChartMenu busy={fanBusy === "royal" ? "royal" : ""} onPick={(f) => saveChart("royal", f)} />}
        </div>
        {royal && royal.ids.length > 1 ? (
          <div className="lineage royal" dangerouslySetInnerHTML={{ __html: royal.svg }} />
        ) : (
          <div className="lineage" dangerouslySetInnerHTML={{ __html: chart?.svg || "" }} />
        )}
        <p className="mut">बुबा-आमाको नाम रेकर्डमा भए मात्र माथिल्ला पुस्ता देखिन्छन्। नपुगेको विवरण थप्न &ldquo;विवरण सच्याउने&rdquo; प्रयोग गर्नुहोस्।</p>
      </section>

      <section className="card">
        <div className="prof-bar">
          <h3>{other ? "परिवार" : "मेरो परिवार"}</h3>
          {!other && <button className="ghost" onClick={() => openDialog(<PersonForm action="add" />, true)}>+ सदस्य थप्ने</button>}
        </div>
        {family.length ? (
          <div className="kin-grid">
            {family.map(({ q, l }) => (
              <button key={q.id} className={`kin g${q.gender || "O"} ${q.is_living === false ? "dead" : ""}`} onClick={() => (other ? openProfile(q.id) : pick(q.id))}>
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
            <h3>वंश-विस्तार <span className="mut">· {desc.root.id === p.id ? (other ? "यहाँदेखि तल" : "तपाईंदेखि तल") : "हजुरबुबादेखि तलका सबै सदस्य"}</span></h3>
            <span className="chart-tools">
              <ZoomPill zoom={zoom} set={setZoom} />
              {perms.act !== "general" && <ChartMenu busy={fanBusy === "desc" ? "desc" : ""} onPick={(f) => saveChart("desc", f)} />}
            </span>
          </div>
          <div className="desc-wrap">
            <div className="desc" style={{ width: desc.width * zoom }} dangerouslySetInnerHTML={{ __html: desc.svg }} />
          </div>
          <p className="mut">सुनौलो बाटोले {other ? "यहाँसम्मको" : "तपाईंसम्मको"} वंश-क्रम देखाउँछ। दायाँ-बायाँ सार्न स्क्रोल गर्नुहोस्, सानो/ठूलो गर्न + − थिच्नुहोस्; ⬇ बाट PDF वा SVG लिन सकिन्छ।</p>
        </section>
      )}

      {fan && fan.known > 0 && (
        <section className="card fan-card">
          <div className="prof-bar">
            <h3>पुर्खा-चक्र <span className="mut">· ५ पुस्तासम्मका पुर्खा</span></h3>
            {perms.act !== "general" && <ChartMenu busy={fanBusy === "fan" ? "fan" : ""} onPick={(f) => saveChart("fan", f)} />}
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
          <p className="mut">{other ? "साइटमा देखाइएको गोत्र, वेद र प्रवर बराल थरको हो। यो व्यक्ति अर्को थरमा जन्मिएकाले गोत्र र प्रवर फरक हुन सक्छ; यहाँ अनुमान गरेर राखिएको छैन।" : "साइटमा देखाइएको गोत्र, वेद र प्रवर बराल थरको हो। तपाईं अर्को थरमा जन्मनुभएकाले तपाईंको गोत्र र प्रवर फरक हुन सक्छ; यहाँ अनुमान गरेर राखिएको छैन।"}</p>
        </section>
      )}

      {!other && (
        <>
          <h3 className="prof-h">मेरा अनुरोध</h3>
          <MineView />
        </>
      )}
    </div>
  );
}
