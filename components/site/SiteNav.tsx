"use client";
// The one navigation bar of the site: same on public pages and inside the app. Signed-out visitors get the public menu;
// signed-in members get the member menu, a role switch and an avatar menu with their account actions.
import "./site.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAuthHint } from "@/lib/vansh/authHint";
import { createClient } from "@/utils/supabase/client";
import { myRoles, ROLE_L } from "@/lib/vansh/graph";
import type { VProfile } from "@/lib/vansh/types";

export type NavKey = "home" | "history" | "profile" | "lineage" | "members" | "contact" | "admin" | "none";
export type AppTab = "me" | "fam" | "tree" | "mem" | "admin";
export type AccountAction = "profile" | "add" | "kin" | "download" | "privacy" | "report" | "password" | "logout";

export interface AccountInfo {
  name: string;
  /** photo / default figure, drawn inside the round avatar button */
  avatar: React.ReactNode;
  roles: { key: string; label: string }[];
  act: string | null;
  onRole?: (key: string) => void;
  /** acting role is admin or moderator: shows the एडमिन item */
  staff: boolean;
  oauthOnly?: boolean;
  version?: string;
  onAction: (a: AccountAction) => void;
}

type Item = { k: NavKey; l: string; href: string; tab?: AppTab };

// signed out: the public pages and the tree gate. Signed in: five places, one question each —
// home (what is new), the tree (who are we), members (who is who), history, profile (who am I). "सम्पर्क" lives in the footer and the account menu.
const OUT: Item[] = [
  { k: "home", l: "गृहपृष्ठ", href: "/" },
  { k: "lineage", l: "वंशवृक्ष", href: "/app?tab=tree", tab: "tree" },
  { k: "history", l: "इतिहास", href: "/history" },
  { k: "contact", l: "सम्पर्क", href: "/contact" },
];
const IN: Item[] = [
  { k: "home", l: "गृहपृष्ठ", href: "/" },
  { k: "lineage", l: "वंशवृक्ष", href: "/app?tab=tree", tab: "tree" },
  { k: "members", l: "सदस्य", href: "/app?tab=fam", tab: "fam" },
  { k: "history", l: "इतिहास", href: "/history" },
  { k: "profile", l: "प्रोफाईल", href: "/app?tab=me", tab: "me" },
];
const ADMIN: Item = { k: "admin", l: "एडमिन", href: "/app?tab=admin", tab: "admin" };

const MENU: { a: AccountAction; l: string; icon: string; sep?: boolean }[] = [
  { a: "profile", l: "प्रोफाईल", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" },
  { a: "privacy", l: "गोपनीयता सेटिङ", icon: "M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5z", sep: true },
  { a: "report", l: "समस्या रिपोर्ट", icon: "M12 3l10 18H2zM12 10v5M12 18v.5" },
];

export function Logo({ size = 48 }: { size?: number }) {
  // the approved Baral heritage badge (public/logo.png)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" width={size} height={size} alt="" aria-hidden="true" className="sn-logo" decoding="async" />;
}

/** On public pages the app is not mounted, so read the session and profile here. */
function usePublicAccount(enabled: boolean): AccountInfo | null | undefined {
  const router = useRouter();
  const [act, setAct] = useState<string | null>(null);
  const [raw, setRaw] = useState<{ name: string; roles: string[] } | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let off = false;
    const db = createClient();
    db.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) return !off && setRaw(null);
        const { data: pr } = await db.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
        const p = pr as VProfile | null;
        const rs = myRoles(p);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem("vv_role");
        } catch {}
        if (off) return;
        setAct(saved && (rs as string[]).includes(saved) ? saved : rs[0] || null);
        setRaw({ name: p?.full_name || data.session.user.email || "", roles: rs });
      })
      .catch(() => !off && setRaw(null));
    return () => {
      off = true;
    };
  }, [enabled]);

  return useMemo<AccountInfo | null | undefined>(() => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const initial = Array.from(raw.name.trim())[0] || "•";
    return {
      name: raw.name,
      avatar: <span className="sn-ini">{initial}</span>,
      roles: raw.roles.map((r) => ({ key: r, label: ROLE_L[r as keyof typeof ROLE_L] || r })),
      act,
      staff: act === "admin" || act === "moderator",
      onRole: (k) => {
        setAct(k);
        try {
          localStorage.setItem("vv_role", k);
        } catch {}
      },
      onAction: (a) => {
        if (a === "logout") {
          createClient().auth.signOut().then(() => router.refresh());
          setRaw(null);
        } else router.push(a === "profile" ? "/app?tab=me" : `/app?do=${a}`);
      },
    };
  }, [raw, act, router]);
}

function AccountMenu({ acc }: { acc: AccountInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const go = (a: AccountAction) => {
    setOpen(false);
    acc.onAction(a);
  };
  return (
    <div className="sn-acc" ref={ref}>
      <button className="sn-avbtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={acc.name}>
        <span className="sn-av">{acc.avatar}</span>
        <svg className="sn-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sn-sr">खाता मेनु</span>
      </button>
      {open && (
        <div className="sn-pop" role="menu" aria-label="खाता मेनु">
          <div className="sn-who">
            <b>{acc.name}</b>
            <small>{(acc.act && ROLE_L[acc.act as keyof typeof ROLE_L]) || "पर्खाइमा"}</small>
          </div>
          {MENU.map((m) => (
            <React.Fragment key={m.a}>
              {m.sep && <hr />}
              <button role="menuitem" onClick={() => go(m.a)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={m.icon} />
                </svg>
                {m.l}
              </button>
            </React.Fragment>
          ))}
          <Link role="menuitem" href="/contact" className="sn-mi" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v14H4zM4 7l8 6 8-6" />
            </svg>
            सम्पर्क
          </Link>
          <hr />
          <button role="menuitem" onClick={() => go("password")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="15" r="4" />
              <path d="M11 12l9-9M16 7l3 3" />
            </svg>
            पासवर्ड परिवर्तन
          </button>
          <button role="menuitem" className="out" onClick={() => go("logout")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
            </svg>
            लगआउट
          </button>
          {acc.version && <small className="sn-ver">{acc.version}</small>}
        </div>
      )}
    </div>
  );
}

export default function SiteNav({
  active,
  account,
  onTab,
  pending,
}: {
  active: NavKey;
  /** the app is still reading the session: show the bar without guest or member items */
  pending?: boolean;
  /** in the app: the account (null = signed out); on public pages leave undefined and it is looked up */
  account?: AccountInfo | null;
  onTab?: (t: AppTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const pub = usePublicAccount(account === undefined);
  const acc = account === undefined ? pub : account;
  const items = acc ? (acc.staff ? [...IN, ADMIN] : IN) : OUT;
  const wait = !!pending || (account === undefined && pub === undefined);
  useEffect(() => {
    if (!pending && (account === null || pub === null)) clearAuthHint();
  }, [account, pub, pending]);

  return (
    <div className={`sn${wait ? " sn-wait" : ""}`} role="banner">
      <a className="sn-skip" href="#main">मुख्य सामग्रीमा जानुहोस्</a>
      <div className="sn-in">
        <Link href="/" className="sn-brand" aria-label="बराल वंशावली — गृहपृष्ठ">
          <Logo />
          <span>
            <b>बराल वंशावली</b>
            <small>हाम्रो इतिहास, हाम्रो पहिचान</small>
          </span>
        </Link>
        <nav id="sn-menu" className={`sn-menu${open ? " open" : ""}`} aria-label="मुख्य मेनु">
          {items.map((it) => (
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
          {acc && (
            <div className="sn-role">
              {acc.roles.length > 1 ? (
                <select aria-label="भूमिका छान्नुहोस्" value={acc.act || ""} onChange={(e) => acc.onRole?.(e.target.value)}>
                  {acc.roles.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <span className="sn-tag">{acc.roles[0]?.label || "पर्खाइमा"}</span>
              )}
            </div>
          )}
          {acc === null && (
            <Link className="sn-cta" href="/app" onClick={() => setOpen(false)}>
              लगइन / दर्ता
            </Link>
          )}
        </nav>
        <div className="sn-end">
          {acc && (
            <button className="sn-add" onClick={() => acc.onAction("add")} title="सदस्य थप्ने">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>सदस्य थप्ने</span>
            </button>
          )}
          {acc && <AccountMenu acc={acc} />}
          <button className="sn-burger" aria-expanded={open} aria-controls="sn-menu" onClick={() => setOpen(!open)}>
            <span className="sn-bars" aria-hidden="true" />
            <span className="sn-sr">मेनु</span>
          </button>
        </div>
      </div>
    </div>
  );
}
