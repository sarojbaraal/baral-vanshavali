import type { Metadata, Viewport } from "next";
import "./home.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://baraltree.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "बराल वंशावली — हाम्रो इतिहास, हाम्रो पहिचान", template: "%s | बराल वंशावली" },
  description: "घृतकौशिक गोत्रीय बराल वंशको इतिहास, उत्पत्ति र फैलावट, र परिवारको वंशवृक्ष।",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  openGraph: {
    title: "बराल वंशावली",
    description: "हाम्रो इतिहास, हाम्रो पहिचान",
    images: [{ url: "/home/hero.jpg", width: 906, height: 780, alt: "AI ले बनाएको कल्पनाचित्र" }],
    locale: "ne_NP",
    type: "website",
  },
};
export const viewport: Viewport = { themeColor: "#313d24", width: "device-width", initialScale: 1 };

export default function HomeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ne">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@400;500;600;700;800&family=Tiro+Devanagari+Hindi&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
