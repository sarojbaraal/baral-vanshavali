import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://baraltree.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/history", "/contact"].map((p) => ({ url: SITE + p, changeFrequency: "monthly" as const }));
}
