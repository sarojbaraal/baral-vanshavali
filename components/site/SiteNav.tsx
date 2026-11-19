"use client";
// Top navigation shared by the public pages and the signed-in app, so it looks the same before and after login.
import "./site.css";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export type NavKey = "home" | "lineage" | "history" | "branches" | "contact" | "account" | "none";
type AppTab = "tree" | "fam" | "mine";

const ITEMS: { k: NavKey; l: string; href: string; tab?: AppTab }[] = [
  { k: "home", l: "गृहपृष्ठ", href: "/" },
  { k: "lineage", l: "हाम्रो वंश", href: "/app?tab=tree", tab: "tree" },
  { k: "history", l: "इतिहास", href: "/history" },
  { k: "branches", l: "परिवार शाखाहरु", href: "/app?tab=fam", tab: "fam" },
  { k: "contact", l: "सम्पर्क", href: "/contact" },
];

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="sn-logo">
      <circle cx="24" cy="24" r="24" fill="#313d24" />
      <g fill="none" stroke="#d9b36a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="14.5" r="3.6" />
        <circle cx="14.5" cy="19" r="3" />
        <circle cx="33.5" cy="19" r="3" />
        <path d="M17.5 31c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8" />
        <path d="M9 30.5c0-2.7 2-4.4 4.6-4.4M39 30.5c0-2.7-2-4.4-4.6-4.4" />
        <path d="M11 36.5h26M13 36.5c3 2 7 3 11 3s8-1 11-3" />
      </g>
    </svg>
  );
}

export default function SiteNav({ active, signedIn, onTab }: { active: NavKey; signedIn?: boolean; onTab?: (t: AppTab) => void }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<boolean | null>(null);
  const inKnown = signedIn ?? seen;

  useEffect(() => {
    if (signedIn !== undefined) return;
    let off = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => !off && setSeen(!!data.session))
      .catch(() => !off && setSeen(false));
    return () => {
      off = true;
    };
  }, [signedIn]);

  return (
    <div className="sn" role="banner">
      <a className="sn-skip" href="#main">मुख्य सामग्रीमा जानुहोस्</a>
      <div className="sn-in">
        <Link href="/" className="sn-brand" aria-label="बराल वंशावली — गृहपृष्ठ">
          <Logo />
          <span>
            <b>बराल वंशावली</b>
            <small>हाम्रो इतिहास, हाम्रो पहिचान</small>
          </span>
        </Link>
        <button className="sn-burger" aria-expanded={open} aria-controls="sn-menu" onClick={() => setOpen(!open)}>
          <span className="sn-bars" aria-hidden="true" />
          <span className="sn-sr">मेनु</span>
        </button>
        <nav id="sn-menu" className={`sn-menu${open ? " open" : ""}`} aria-label="मुख्य मेनु">
          {ITEMS.map((it) => (
            <Link
              key={it.k}
              href={it.href}
              aria-current={active === it.k ? "page" : undefined}
              className={active === it.k ? "on" : ""}
              onClick={(e) => {
                setOpen(false);
                if (it.tab && onTab) {
                  e.preventDefault();
                  onTab(it.tab);
                }
              }}
            >
              {it.l}
            </Link>
          ))}
          <Link
            className={`sn-cta${active === "account" ? " on" : ""}`}
            href={inKnown ? "/app?tab=mine" : "/app"}
            aria-current={active === "account" ? "page" : undefined}
            onClick={(e) => {
              setOpen(false);
              if (inKnown && onTab) {
                e.preventDefault();
                onTab("mine");
              }
            }}
          >
            {inKnown ? "मेरो खाता" : "लगइन / दर्ता"}
          </Link>
        </nav>
      </div>
    </div>
  );
}
