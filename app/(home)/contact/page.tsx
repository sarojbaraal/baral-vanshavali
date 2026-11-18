import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/site/PageShell";
import { CONTACT_EMAIL } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  title: "सम्पर्क",
  description: "बराल वंशावलीबारे प्रश्न, सुधार वा सहयोगका लागि सम्पर्क।",
};

const REASONS = [
  "इतिहासमा सुधार वा थप जानकारी पठाउन",
  "वंशावलीमा आफ्नो परिवार जोड्न वा खाताको समस्याबारे सोध्न",
  "पुराना हस्तलिखित कागज, फोटो वा कृति उपलब्ध गराउन",
];

export default function ContactPage() {
  return (
    <PageShell active="contact">
      <div className="hist contact">
        <header className="ph">
          <h1>सम्पर्क</h1>
          <p className="lede">वंशावलीबारे प्रश्न, सुधार वा सहयोगका लागि इमेल पठाउनुहोस्।</p>
        </header>
        <section className="hs">
          <h2>इमेल</h2>
          <p className="mailbig">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <h3>यी कामका लागि लेख्न सकिन्छ</h3>
          <ul className="plain">
            {REASONS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mut">इमेलमा आफ्नो नाम, बुबाको नाम र ठेगाना लेख्दिनुभयो भने सही व्यक्तिसँग जोड्न सजिलो हुन्छ। अरू सम्पर्क विवरण चाँडै यहाँ थपिनेछ।</p>
          <p className="mut">
            लगइन गरिसकेका सदस्यले आफ्नो परिवारको विवरण सच्याउन <Link href="/app?tab=mine">&ldquo;अनुरोध&rdquo;</Link> मार्फत पठाउन सक्छन्।
          </p>
        </section>
      </div>
    </PageShell>
  );
}
