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
  { h: "वंशवृक्ष चार्ट", p: "पुरा पुस्ताको वंशवृक्ष चार्ट यहाँ राखिएको छ। दर्ता भएपछि सदस्यले आफ्नो पुस्ताअनुसार रूख हेर्न, खोज्न, र आफ्नो स्थानसम्म पुग्न सकिन्छ।" },
  { h: "परिवार र शाखा", p: "बुबा-आमा, जीवनसाथी, छोराछोरी, दिदिभिनाजु, भान्जाभान्जी, मावली र अन्य नाताको सूची एकै ठाउँमा देखिन्छ।" },
  { h: "सच्याउन अनुरोध", p: "गलत वा छुटेको विवरण देखे सच्याउन वा थप्न अनुरोध पठाउन सकिनेछ; त्यसलाई एडमिनले जाँचेर स्वीकार गरेपछि वेबसाईटमा देखिन्छ।" },
  { h: "फोटो र अन्य कागजात", p: "आफ्नो फोटो र हस्तलिखित कृति वा अन्य कागजात आफ्नो प्रोफाइलमा पुस्तान्तरणको लागि अनन्तकाल सम्म सुरक्षित राख्न मिल्ने।" },
  { h: "चार्ट डाउनलोड", p: "आफ्नो शाखाको वंशवृक्षको भित्ते चार्ट र वंशावली प्रिन्ट वा डाउनलोड गर्न मिल्नेछ।" },
  { h: "इन्टरनेट नचाहिने", p: "एप इन्स्टल गरेपछि पछिल्लो डाटा अफलाइन हुदा पनि हेर्न, सम्पादन गर्न र थप्न मिल्ने, अनलाईन भएपछी संचित र सम्पादन गरिएका डेटा आफैं सर्भरमा जाने।" },
];

function Band({ cls }: { cls: string }) {
  return (
        <div className={"band " + cls} aria-label="यो साइटका चार आधार">
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
  );
}

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
              दायाँपटि देखिएका अनुहार काल्पनिक हुन्, वास्तविक पुर्खा वा सदस्यका होइनन्।
            </p>
          </div>
          <figure className="hero-art">
            <Image
              src="/home/hero.webp"
              alt="काल्पनिक चित्र: पुस्ताअनुसार सजाइएका पुराना फोटोका फ्रेम, पछाडि फैलिएको रूख, र तल खुला वंशावली-पुस्तक"
              width={906}
              height={772}
              priority
              unoptimized
            />
            <span className="ai-badge">यहाँ देखिएका ब्यक्तिहरु काल्पनिक हुन्</span>
          </figure>
        </div>
        </MemberHero>
        <Band cls="band-top" />
      </section>

      <MemberDash />

      <section className="sec glimpse" aria-labelledby="g-h">
        <div className="sec-in">
          <div className="g-copy">
            <h2 id="g-h">इतिहासको एक झलक</h2>
            <p className="lede">
              महर्षि विश्वामित्रको कुल परम्पराअन्तर्गत घृतकौशिक गोत्र, त्रिप्रवर, शुक्ल यजुर्वेद र आपस्तम्ब सूत्रसँग जोडिएका बराल पुर्खाहरू कन्नौज र कुमाउँ हुँदै जुम्लाको सिञ्जा क्षेत्रमा प्रवेश गरी शास्त्रीय विद्वत्ता र राजपुरोहितको परम्परामा विकसित भए । मध्यकालमा अछामको &lsquo;बारला&rsquo; गाउँ बिर्ता पाएपछि बराल थरको सुरुवात भयो। त्यही पश्चिम नेपालको उद्गम थलोबाट बसाइँ सर्दै कास्की, लमजुङ, सिन्धुली र धनकुटा हुँदै ताप्लेजुङ, तराई तथा प्रवाससम्म बराल समुदायको बसोबास विस्तार भयो। अन्ततः वि.सं. २०३४ मा पण्डित शिवराज बराल (शर्मा) ले काशीमा तयार पार्नुभएको प्रथम लिखित वंशवृक्षले यो सम्पूर्ण ऐतिहासिक विरासतलाई भावी पुस्तासम्म जोगाइराख्ने बलियो आधार प्रदान गरेको छ।
            </p>
            <ul className="mini">
              <li><b>गोत्र:</b> घृतकौशिक गोत्र (कौशिक/विश्वामित्र ऋषि परम्परा), त्रिप्रवर: विश्वामित्र, देवरात, औदल </li>
              <li><b>वेद र शाखा</b> शुक्ल यजुर्वेद (वाजसनेयी शाखा) माध्यान्दिन </li>
              <li><b>साझा गोत्र भएका थर:</b> बराल, नेपाल, खनाल, सुतार कार्की</li>
              <li><b>कुलदेवता:</b> मष्टदेवता, विन्ध्यवासिनी तथा परम्परागत कुलदेवता</li>
              <li><b>पुस्ता:</b>चौधौँ शताब्दीका अनुक्राम दुवेदेखि सुरु, </li>
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
            <span className="real-badge">हस्तलिखित</span>
            <figcaption>वि.सं. २०३४, काशी — पं. शिवराज शर्मा</figcaption>
          </figure>
        </div>
      </section>

      <section className="sec members" data-pub aria-labelledby="m-h">
        <div className="sec-in col">
          <h2 id="m-h">सदस्यका लागि के छ?</h2>
          <p className="lede">इतिहास सबैका लागि खुला छ। परिवारको व्यक्तिगत विवरण भने लगइन गरेका सदस्यले आफ्नो भूमिकाअनुसार देख्छन्।</p>
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

      {/* for signed-in members the four pillars matter less than their own family, so they sit at the end */}
      <Band cls="band-end" />
    </PageShell>
  );
}
