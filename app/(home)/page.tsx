import Image from "next/image";
import Link from "next/link";
import PageShell from "@/components/site/PageShell";
import MemberHero from "@/components/site/MemberHero";
import MemberDash from "@/components/site/MemberDash";
import { tornPath } from "./torn";

// Four promises under the hero. Wording sticks to what the site really does.
const PROMISES: { h: string; p: string; icon: React.ReactNode }[] = [
  {
    h: "प्रमाणको स्तरसहित",
    p: "इतिहासका हरेक दाबीमा हस्तलिखित कागज, बाहिरी स्रोत वा परम्परा — कुन आधार हो भनेर लेखिएको छ।",
    icon: (
      <>
        <path d="M24 6 8 12v11c0 10 7 16 16 19 9-3 16-9 16-19V12L24 6z" />
        <path d="m17 24 5 5 9-10" />
      </>
    ),
  },
  {
    h: "परिवारलाई जोड्ने पुल",
    p: "टाढा परेका नातालाई वंशवृक्षमा फेरि भेट्ने र जोड्ने माध्यम।",
    icon: (
      <>
        <circle cx="17" cy="16" r="5" />
        <circle cx="32" cy="18" r="4" />
        <path d="M8 38c0-6 4-10 9-10s9 4 9 10M28 38c0-4 2-7 6-7s6 3 6 7" />
      </>
    ),
  },
  {
    h: "इतिहासको संरक्षण",
    p: "हस्तलिखित वंशवृक्ष स्क्यान गरेर राखिएको छ, आगामी पुस्ताले पढ्न पाउने गरी।",
    icon: (
      <>
        <path d="M6 12c6-3 12-3 18 1 6-4 12-4 18-1v26c-6-3-12-3-18 1-6-4-12-4-18-1V12z" />
        <path d="M24 13v26" />
      </>
    ),
  },
  {
    h: "जहाँ भए पनि, सधैँ संगै",
    p: "देश-विदेशका बराल परिवार एकै ठाउँमा। इन्टरनेट नभए पनि एपमा हेर्न मिल्छ।",
    icon: (
      <>
        <circle cx="24" cy="24" r="17" />
        <path d="M7 24h34M24 7c-6 5-6 29 0 34M24 7c6 5 6 29 0 34" />
      </>
    ),
  },
];

const FEATURES: { h: string; p: string }[] = [
  { h: "वंशवृक्ष चार्ट", p: "पुस्ताअनुसार रूख हेर्ने, खोज्ने, आफ्नो हाँगासम्म पुग्ने।" },
  { h: "परिवार र शाखा", p: "बुबा-आमा, जोडी, सन्तान र नाताको सूची एकै ठाउँमा।" },
  { h: "सच्याउन अनुरोध", p: "गलत वा छुटेको विवरण देखे अनुरोध पठाउने; एडमिनले जाँचेर स्वीकार गर्छन्।" },
  { h: "फोटो र PDF कागजात", p: "आफ्नो फोटो र हस्तलिखित कृतिका PDF राख्न मिल्ने।" },
  { h: "चार्ट डाउनलोड", p: "आफ्नो शाखाको चार्ट प्रिन्ट वा डाउनलोड गर्ने।" },
  { h: "इन्टरनेट नभए पनि", p: "एप इन्स्टल गरेपछि पछिल्लो डाटा अफलाइन हेर्न मिल्छ।" },
];

export default function HomePage() {
  return (
    <PageShell active="home">
      <section className="hero" aria-labelledby="hero-h">
        <MemberHero>
        <div className="hero-in">
          <div className="hero-copy">
            <p className="orn">
              <span aria-hidden="true" /> हाम्रो इतिहास, हाम्रो पहिचान <span aria-hidden="true" />
            </p>
            <h1 id="hero-h">
              बराल
              <br />
              वंशावली
            </h1>
            <p className="rule" aria-hidden="true"><i /></p>
            <p className="intro">
              हाम्रो पुर्खाहरुले निर्माण गर्नुभएको पहिचान, संस्कार र परम्पराको सम्पूर्ण विवरणलाई संरक्षण गर्दै आगामी पुस्तासम्म पुर्‍याउने हाम्रो सामूहिक प्रयास।
            </p>
            <div className="row">
              <Link className="btn" href="/app?tab=tree">वंशावली हेर्नुहोस्</Link>
              <Link className="btn ghost" href="/history">हाम्रा पुस्ताहरु बुझ्नुहोस्</Link>
            </div>
            <p className="ai-note">
              दायाँको चित्र AI ले बनाएको कल्पनाचित्र हो। त्यहाँका अनुहार वास्तविक पुर्खा वा सदस्य होइनन्।
            </p>
          </div>
          <figure className="hero-art">
            <Image
              src="/home/hero.webp"
              alt="AI ले बनाएको कल्पनाचित्र: पुस्ताअनुसार सजाइएका पुराना फोटोका फ्रेम, पछाडि फैलिएको रूख, र तल खुला वंशावली-पुस्तक"
              width={906}
              height={772}
              priority
              unoptimized
            />
            <span className="ai-badge">AI ले बनाएको चित्र</span>
          </figure>
        </div>
        </MemberHero>
        <div className="band" aria-label="यो साइटका चार आधार">
          <svg className="torn" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
            <path d={tornPath(1440, 80, 40, 18, 16, 11)} fill="#313d24" opacity=".35" transform="translate(0 -5)" />
            <path d={tornPath(1440, 80, 40, 16, 14, 3)} fill="#313d24" />
          </svg>
          <ul className="promises">
            {PROMISES.map((x) => (
              <li key={x.h}>
                <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="#d9b36a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {x.icon}
                </svg>
                <div>
                  <h2>{x.h}</h2>
                  <p>{x.p}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MemberDash />

      <section className="sec glimpse" aria-labelledby="g-h">
        <div className="sec-in">
          <div className="g-copy">
            <h2 id="g-h">इतिहासको एक झलक</h2>
            <p className="lede">
              बराल घृतकौशिक गोत्रका हुन्। थरको नाम अछामको &lsquo;बारला&rsquo; गाउँको बिर्ताबाट चलेको भन्ने वंशावली स्रोतको कथन छ, र त्यहाँबाट पश्चिमबाट पूर्वतिर बसाइँ सर्दै कास्की, लमजुङ, सिन्धुली हुँदै ताप्लेजुङ, तराई र भारतसम्म फैलिएको देखिन्छ।
            </p>
            <ul className="mini">
              <li><b>गोत्र</b> घृतकौशिक, चार थर (बराल, नेपाल, खनाल, सुतार कार्की) को साझा गोत्र</li>
              <li><b>लिखित प्रमाण</b> वि.सं. २०३४ मा काशीमा बनाइएको हस्तलिखित कुलद्रुम</li>
              <li><b>पुस्ता</b> कागजअनुसार चौधौँ शताब्दीका अनुक्राम दुवेदेखि सुरु</li>
            </ul>
            <Link className="btn" href="/history">पूरा इतिहास पढ्नुहोस्</Link>
          </div>
          <figure className="g-art">
            <Image
              src="/vansh/baral-tree-root.jpg"
              alt="घृतकौशिक गोत्रीय बरालको मूल आधार — वि.सं. २०३४ को असली हस्तलिखित वंशवृक्ष"
              width={1200}
              height={2046}
              unoptimized
            />
            <span className="real-badge">असली हस्तलिखित स्क्यान</span>
            <figcaption>वि.सं. २०३४, काशी — पं. शिवराज शर्मा</figcaption>
          </figure>
        </div>
      </section>

      <section className="sec members" aria-labelledby="m-h">
        <div className="sec-in col">
          <h2 id="m-h">सदस्यका लागि के छ</h2>
          <p className="lede">इतिहास सबैका लागि खुला छ। परिवारको व्यक्तिगत विवरण भने लगइन गरेका सदस्यले मात्र, आफ्नो भूमिकाअनुसार देख्छन्।</p>
          <ul className="feat">
            {FEATURES.map((f) => (
              <li key={f.h}>
                <h3>{f.h}</h3>
                <p>{f.p}</p>
              </li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn" href="/app">लगइन / दर्ता गर्नुहोस्</Link>
            <Link className="btn ghost" href="/contact">प्रश्न छ? सम्पर्क गर्नुहोस्</Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
