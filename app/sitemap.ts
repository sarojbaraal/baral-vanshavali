import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vanshavali.sarojbaral.com.np";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/history", "/contact"].map((p) => ({ url: SITE + p, changeFrequency: "monthly" as const }));
}
