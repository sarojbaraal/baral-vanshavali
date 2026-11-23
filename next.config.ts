import type { NextConfig } from "next";

// Build stamp shown (on hover) at the top-right of the app: V<HHmm>_<DD><Mon>, Nepal time.
function buildStamp(): string {
  const d = new Date(Date.now() + (5 * 60 + 45) * 60_000); // UTC+05:45
  const p = (n: number) => String(n).padStart(2, "0");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `V${p(d.getUTCHours())}${p(d.getUTCMinutes())}_${p(d.getUTCDate())}${mon}`;
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VER: buildStamp() },
  // Old Next.js auth pages wrote to `profiles` directly (now blocked by design); the app at "/" handles sign-in/up.
  async redirects() {
    // the old vercel.app addresses always goes to the real domain (so shared links, print footers and stamps show one address)
    const canonical = {
      source: "/:path*",
      has: [{ type: "host" as const, value: "(baral-vanshavali|baraltree)\\.vercel\\.app" }],
      destination: "https://vanshavali.sarojbaral.com.np/:path*",
      permanent: true,
    };
    return [
      canonical,
      ...["login", "signup", "forgot-password"].map((p) => ({
        source: `/auth/${p}`,
        destination: "/",
        permanent: false,
      })),
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
