import Link from "next/link";
import "./site.css";
import { Logo } from "./SiteNav";

export const CONTACT_EMAIL = "vanshavali@sarojbaral.com.np";

export default function SiteFooter() {
  return (
    <footer className="sf">
      <div className="sf-in">
        <div className="sf-brand">
          <Logo size={44} />
          <p>
            <b>बराल वंशावली</b>
            <span>पुर्खाको पहिचान, संस्कार र परम्परा आगामी पुस्तासम्म।</span>
          </p>
        </div>
        <nav aria-label="फुटर मेनु" className="sf-links">
          <Link href="/history">इतिहास</Link>
          <Link href="/app?tab=tree">हाम्रो वंश</Link>
          <Link href="/app?tab=fam">परिवार शाखाहरु</Link>
          <Link href="/contact">सम्पर्क</Link>
        </nav>
        <p className="sf-mail">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
      <p className="sf-note">
        गृहपृष्ठको हिरो चित्र AI ले बनाएको कल्पनाचित्र हो; त्यहाँका अनुहार वास्तविक पुर्खा वा सदस्य होइनन्। इतिहास खण्डका हस्तलिखित कागज भने असली स्क्यान हुन्।
      </p>
    </footer>
  );
}
