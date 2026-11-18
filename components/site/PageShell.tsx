import React from "react";
import SiteNav, { type NavKey } from "./SiteNav";
import SiteFooter from "./SiteFooter";

/** Navigation + page + footer for the public pages. */
export default function PageShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  return (
    <div className="hm">
      <SiteNav active={active} />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
