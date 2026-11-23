import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vanshavali.sarojbaral.com.np";

// the family data lives behind login; only the public pages are for search engines
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/history", "/contact"], disallow: ["/app", "/auth", "/api"] }, sitemap: SITE + "/sitemap.xml" };
}
