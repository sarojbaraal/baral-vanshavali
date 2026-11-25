"use client";
// Public history of the Baral family: origin, the four surnames, the handwritten proof, and the spread. Open to everyone.
import React, { useState } from "react";
import Link from "next/link";
import { BASIS, BROTHERS, DOCS, FIXES, IDENTITY, LADDER, SOURCES, SPREAD, STAGES, type Basis } from "@/lib/vansh/intro";
import { Lightbox, Route, Scan, Stage, Tag, type Zoom } from "./HistoryParts";

const TOC: [string, string][] = [
  ["h-id", "परिचय"],
  ["h-st", "उत्पत्ति"],
  ["h-br", "चार थर"],
  ["h-pr", "लिखित प्रमाण"],
  ["h-rt", "फैलावट"],
  ["h-dc", "अभिलेख"],
  ["h-sr", "स्रोत"],
];

export default function HistoryPage() {
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [open, setOpen] = useState("बराल");
  const cur = BROTHERS.find((b) => b.sur === open) || BROTHERS[2];
  const rootPaper: Zoom = { src: "/vansh/baral-tree-root.jpg", alt: "घृतकौशिक गोत्रीय बरालको मूल आधार — वंशवृक्ष", w: 1200, h: 2046 };

  return (
    <div className="hist">
      <header className="ph">
        <p className="kick">॥ श्री घृतकौशिकाय नमः ॥</p>
        <h1>बराल वंशको इतिहास</h1>
        <p className="lede">
          हामी कहाँबाट आयौँ, कसरी ‘बराल’ भयौँ र समयक्रमसँगै कता–कता फैलियौँ — यही पुर्ख्यौली यात्रालाई यहाँ ऐतिहासिक हस्तलिखित कागज र वंशावली अभिलेखसँग जोडेर प्रस्तुत गर्ने प्रयास गरिएको छ। पुस्तान्तरण हुँदै आएका मौखिक परम्परा, किम्वदन्ती र ऐतिहासिक प्रमाणहरू स्पष्ट रूपमा छुट्टिन सकून् भनेर प्रत्येक विवरणसँगै त्यसको आधार र स्रोत पनि खुलाइएको छ। विगतका जरा खोज्दै वर्तमान पुस्तालाई आफ्नो पहिचानसँग जोड्ने उद्देश्यले तयार पारिएको यो अभिलेखीय पृष्ठ अध्ययन, संवाद र थप संशोधनका लागि सधैं खुला छ।
        </p>
        <nav className="toc" aria-label="यो पृष्ठका खण्ड">
          {TOC.map(([id, l]) => (
            <a key={id} href={`#${id}`}>{l}</a>
          ))}
        </nav>
      </header>

      <section className="hs" aria-labelledby="h-id">
        <h2 id="h-id">परिचय</h2>
        <dl className="facts">
          {IDENTITY.map((x) => (
            <div key={x.k}>
              <dt>{x.k}</dt>
              <dd>
                <span>{x.v}</span>
                <Tag b={x.b} />
                {x.note && <small>{x.note}</small>}
              </dd>
            </div>
          ))}
        </dl>
        <p className="legend" aria-label="प्रमाणका चिह्न">
          {(Object.keys(BASIS) as Basis[]).map((b) => (
            <span key={b}><Tag b={b} /> <small>{BASIS[b].t}</small></span>
          ))}
        </p>
      </section>

      <section className="hs" id="katha" aria-labelledby="h-st">
        <h2 id="h-st">उत्पत्ति: &lsquo;दुवे&rsquo; देखि &lsquo;बराल&rsquo; सम्म</h2>
        <ol className="spine">
          {STAGES.map((s, i) => (
            <Stage key={s.h} s={s} last={i === STAGES.length - 1} />
          ))}
        </ol>
      </section>

      <section className="hs" aria-labelledby="h-br">
        <h2 id="h-br">एउटै बुबाका चार छोरा</h2>
        <p className="lede">जयविद्याधर पण्डितका चार छोराले चार गाउँको बिर्ता पाए, र गाउँकै नाम थर भयो। कुनै थर थिचेर हेर्नुहोस्।</p>
        <div className="grove" role="tablist" aria-label="चार थर">
          {BROTHERS.map((b) => (
            <button
              key={b.sur}
              role="tab"
              aria-selected={open === b.sur}
              className={`leaf${open === b.sur ? " on" : ""}${b.sur === "बराल" ? " me" : ""}`}
              onClick={() => setOpen(b.sur)}
            >
              <strong>{b.sur}</strong>
              <small>{b.name}</small>
            </button>
          ))}
        </div>
        <div className="leafcard" role="tabpanel" key={cur.sur}>
          <p><b>{cur.sur}</b> — {cur.name}</p>
          <p>📍 {cur.place}</p>
          {cur.note && <p className="mut">{cur.note}</p>}
        </div>
        <p className="mut">
          चारै थरको गोत्र एउटै हो र दाजुभाइको साइनो मानिन्छ। बंगालको सुवर्ण वणिक समुदायमा पनि &lsquo;बराल&rsquo; थर पाइन्छ; तर त्यो थर यो वंशसँग सम्बन्धित होइन।
        </p>
      </section>

      <section className="hs paper" aria-labelledby="h-pr">
        <h2 id="h-pr">कागजमा लेखिएको प्रमाण</h2>
        <p className="lede">
          वि.सं. २०३४ मा काशीमा बसेर पं. शिवराज शर्माले हातले बनाउनुभएको कुलद्रुम (वंशवृक्ष)। माउस घुमाएर सानो अक्षर पढ्न सकिन्छ। यो सक्कल हस्तलिखित कागजको स्क्यान हो।
        </p>
        <div className="two">
          <Scan z={rootPaper} onOpen={setZoom} priority />
          <div>
            <h3>पुस्ता (तलबाट माथि)</h3>
            <ol className="ladder">
              {[...LADDER].reverse().map((x) => (
                <li key={x.n}>
                  <b>{x.n}</b>
                  {x.sub && <small>{x.sub}</small>}
                </li>
              ))}
            </ol>
            <blockquote className="kuladruma-quote">
            <p className="verse">
            <strong>
              वेदाग्निशून्यद्वयवैक्रमेऽब्दके काश्यामिषे मासि सिते हरेर्दिने।<br />
              निर्माय हस्तेन कुलद्रुमः शुभः पट्टीकृतोऽयं शिवराज शर्मणा॥
              </strong>
            </p>

            <p className="meaning">
              <strong>अर्थात</strong><em> विक्रम संवत् २०३४ साल आश्विन शुक्ल एकादशीका दिन
              काशीमा पण्डित शिवराज शर्माले आफ्नै हातले यो शुभ कुलवृक्ष (वंशावली)
              रचना गरी अभिलेख तयार पार्नुभएको हो।</em>
            </p>

            <footer className="quote-note">
              <small>
                वेद (४), अग्नि (३), शून्य (०), द्वय (२) — दायाँबाट बायाँ पढ्दा वि.सं.
                २०३४, आश्विन शुक्ल एकादशी (हरिदिन)।
              </small>
            </footer>
          </blockquote>
          </div>
        </div>
      </section>

      <section className="hs" aria-labelledby="h-rt">
        <h2 id="h-rt">पश्चिमबाट पूर्वतिर</h2>
        <p className="lede">अछामको बारलाबाट सुरु भएर आजसम्म आइपुग्दा बरालहरू मुख्यत: यी ठाउँ हुँदै फैलिएको देखिन्छ।</p>
        <Route />
        <div className="regions">
          {SPREAD.map((s) => (
            <details key={s.h} open>
              <summary>{s.h}</summary>
              <p>{s.p}</p>
              <p className="chips">
                {s.places.map((p) => (
                  <span key={p} className="chip">{p}</span>
                ))}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="hs" aria-labelledby="h-dc">
        <h2 id="h-dc">हाम्रा हस्तलिखित अभिलेख</h2>
        <p className="lede">पुराना कागज स्क्यान गरेर राख्दा आउने पुस्ताले पनि पढ्न पाउँछन्।</p>
        <div className="docs3">
          {DOCS.map((d) => (
            <figure key={d.id} className="doc">
              {d.src ? (
                <Scan z={{ src: d.src, alt: d.title, w: d.w || 1200, h: d.h || 1600 }} onOpen={setZoom} />
              ) : (
                <div className="slot"><span aria-hidden="true">📄</span>फाइल आउन बाँकी</div>
              )}
              <figcaption>
                <b>{d.title}</b>
                <small>{d.desc}</small>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <details className="hs srcs" id="h-sr">
        <summary>पुरानो लेखमा सच्याइएका कुरा तथा जानकारीका स्रोतहरु </summary>
        <h3>सच्याइएका कुरा</h3>
        <ul>
          {FIXES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <h3>स्रोतहरु</h3>
        <ul>
          {SOURCES.map((s) => (
            <li key={s.u}>
              <a href={s.u} target="_blank" rel="noopener noreferrer">{s.t}</a>
            </li>
          ))}
        </ul>
        <p className="mut">यी वेबसाइटले पनि वंशावलीकै आधारमा लेखेका हुन्; निर्णायक प्रमाण होइनन्। मूल पाना र कुल पुरोहितको जानकारी नै अन्तिम आधार हुन्।</p>
      </details>

      <section className="cta-end">
        <h2>आफ्नो वंशबृक्ष हेर्न तयार हुनुहुन्छ?</h2>
        <p>परिवारको वंशवृक्ष र सदस्यको विवरण हेर्न लगइन वा दर्ता गर्नुहोस्।</p>
        <div className="row">
          <Link className="btn" href="/app?tab=tree">वंशावली हेर्नुहोस्</Link>
          <Link className="btn ghost" href="/contact">सम्पर्क गर्नुहोस्</Link>
        </div>
      </section>

      {zoom && <Lightbox z={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}
