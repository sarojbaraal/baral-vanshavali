"use client";
// App shell: header (tabs, user, theme), the active view, profile panel, dialogs, toast, PWA install button.
import Crumbs from "./Crumbs";
import React, { useEffect, useRef, useState } from "react";
import { DownloadDialog } from "./DownloadMenu";
import Link from "next/link";
import { ROLE_L } from "@/lib/vansh/graph";
import { np } from "@/lib/vansh/text";
import type { Role, TabKey } from "@/lib/vansh/types";
import { VanshProvider, useVansh } from "./VanshContext";
import { Avatar, DialogHost, Toast } from "./ui";
import { AuthView, PendingView, PosView, ResetView } from "./AuthViews";
import { MembersView } from "./ListViews";
import SiteNav, { type AccountAction, type AccountInfo } from "@/components/site/SiteNav";
import TreeView from "./TreeView";
import DetailPanel from "./DetailPanel";
import { AdminView } from "./RequestViews";
import ProfileView from "./ProfileView";
import { PrivacyDialog, ReportDialog } from "./AccountDialogs";
import { AccessDialog } from "./FieldAccess";
import OverviewView from "./OverviewView";
import { AnchorDialog, PasswordDialog, PersonForm } from "./PersonDialogs";
import { useDailyEvents, useTodayLabel } from "./HeroAi";

const APP_VER = process.env.NEXT_PUBLIC_APP_VER || "dev";

function InstallButton() {
  const [ev, setEv] = useState<Event & { prompt?: () => void } | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEv(e as Event & { prompt?: () => void });
    };
    addEventListener("beforeinstallprompt", h);
    return () => removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!ev) return null;
  return (
    <button
      id="inst"
      onClick={() => {
        ev.prompt?.();
        setEv(null);
      }}
    >
      📲 एप इन्स्टल गर्नुहोस्
    </button>
  );
}

function Shell() {
  const { db, phase, me, act, roles, setAct, tab, setTab, profId, sel, perms, treeApi, people, openDialog, online, outbox, syncNow, discardOutbox, previewAs, setPreviewAs, g } = useVansh();
  const [wide, setWide] = useState(true);
  const [hdrH, setHdrH] = useState(72);

  useEffect(() => {
    const f = () => {
      setWide(innerWidth > 640);
      const r = document.querySelector(".sn")?.getBoundingClientRect();
      setHdrH(Math.max(0, Math.round(r?.bottom ?? 52)) + 6);
    };
    f();
    addEventListener("resize", f);
    addEventListener("scroll", f, { passive: true });
    return () => {
      removeEventListener("resize", f);
      removeEventListener("scroll", f);
    };
  }, [phase]);

  // "मुख्य डाउनलोड मेनुमा जाने" (शाखा प्रिन्ट) works from any tab
  useEffect(() => {
    const h = () => openDialog(<DownloadDialog />);
    window.addEventListener("vv-open-download", h);
    return () => window.removeEventListener("vv-open-download", h);
  }, [openDialog]);

  // register the service worker (offline shell)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // first visit: the files this page already loaded are handed to the worker so the next start works offline
        const urls = [location.pathname, ...performance.getEntriesByType("resource").map((x) => x.name).filter((n) => n.startsWith(location.origin))];
        reg.active?.postMessage({ type: "cache", urls });
      })
      .catch(() => {});
  }, []);

  const inApp = phase === "app";
  // Ctrl/⌘+K jumps to the search box of the current view
  useEffect(() => {
    if (!inApp) return;
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        const el = ["q", "fq", "mq"].map((i) => document.getElementById(i) as HTMLInputElement | null).find((x) => x && x.offsetParent);
        if (el) { e.preventDefault(); el.focus(); el.select(); }
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [inApp]);
  useDailyEvents(inApp);
  const todayTxt = useTodayLabel();
  const eff: TabKey =
    ((tab === "admin" || tab === "ov") && !perms.isStaff) ? "fam" : tab;
  const panelOpen = inApp && !!sel && !!people.length;
  const pushed = panelOpen && wide;

  useEffect(() => {
    document.body.classList.toggle("det-open", pushed);
    return () => document.body.classList.remove("det-open");
  }, [pushed]);


  const dispName = (me?.position_person_id && people.find((p) => p.id === me.position_person_id)?.name) || me?.full_name || me?.email || "";
  const [oauthOnly, setOauthOnly] = useState(false);
  useEffect(() => {
    if (phase !== "app") return;
    db.auth.getUser().then(({ data }) => {
      const u = data.user;
      const ids = (u?.identities || []).map((i) => i.provider);
      setOauthOnly(!!u && ids.length > 0 && !ids.includes("email"));
    });
  }, [db, phase]);
  const showWho = phase === "app" || phase === "pos" || phase === "pending";

  const banner = previewAs ? (
    <div className="card" role="status" style={{ margin: ".5rem 0", borderColor: "var(--mg)" }}>
      🔎 पूर्वावलोकन: <b>{g.byId[previewAs]?.name}</b> ले देख्ने दृश्य (भूमिका: {act}) — केवल हेर्न मात्र।{" "}
      <button className="ghost" onClick={() => setPreviewAs(null)}>बन्द गर्ने</button>
    </div>
  ) : null;
  const meP = me?.position_person_id ? g.byId[me.position_person_id] : undefined;
  const account: AccountInfo | null = showWho
    ? {
        name: dispName,
        avatar: <Avatar g={meP?.gender} photo={meP?.photo_url} />,
        roles: roles.map((r) => ({ key: r, label: ROLE_L[r] })),
        act,
        onRole: (k) => setAct(k as Role),
        staff: perms.isStaff,
        oauthOnly,
        version: `आज ${todayTxt}${perms.isAdm ? ` · Build: ${APP_VER}` : ` · ${APP_VER}`}`,
        onAction: (a) => {
          if (a === "profile") setTab("me");
          else if (a === "add") openDialog(<PersonForm action="add" />, true);
          else if (a === "kin") openDialog(<AnchorDialog />);
          else if (a === "download") openDialog(<DownloadDialog />);
          else if (a === "privacy") openDialog(<PrivacyDialog />);
          else if (a === "access") openDialog(<AccessDialog />);
          else if (a === "report") openDialog(<ReportDialog />);
          else if (a === "password") openDialog(<PasswordDialog />);
          else if (a === "logout") db.auth.signOut();
        },
      }
    : null;
  const doRef = useRef<string | null>(null);
  useEffect(() => {
    if (!inApp || doRef.current) return;
    const u = new URL(location.href);
    const d = u.searchParams.get("do");
    if (!d) return;
    doRef.current = d;
    u.searchParams.delete("do");
    history.replaceState(null, "", u.pathname + u.search);
    account?.onAction(d as AccountAction);
  });

  let body: React.ReactNode = null;
  if (phase === "auth")
    body = (
      <>
        <div className="card gate" role="note">
          🔒 वंशवृक्ष र परिवारको विवरण हेर्न लगइन वा दर्ता गर्नुहोस्। <Link href="/history">इतिहास</Link> भने सबैका लागि खुला छ।
        </div>
        <AuthView />
      </>
    );
  else if (phase === "reset") body = <ResetView />;
  else if (phase === "pos") body = <PosView />;
  else if (phase === "pending") body = <PendingView />;
  else if (inApp)
    body = {
      fam: <MembersView />,
      tree: <TreeView />,
      mem: <MembersView />,
      me: <ProfileView />,
      mine: <ProfileView />,
      pf: <ProfileView pid={profId || undefined} />,
      admin: <AdminView />,
      ov: <OverviewView />,
    }[eff];

  return (
    <>
      <SiteNav
        active={
          eff === "tree" ? "lineage" : eff === "fam" || eff === "mem" || eff === "pf" ? "members" : eff === "me" || eff === "mine" ? "profile"
          : eff === "admin" ? "admin" : "none"
        }
        account={account}
        pending={phase === "loading"}
        onTab={inApp ? (t) => setTab(t) : undefined}
      />
      {inApp && (!online || outbox.length > 0) && (
        <div className="offb" role="status">
          {!online && <div>📴 इन्टरनेट छैन — पछिल्लो सुरक्षित डाटा देखाइँदैछ। हेर्ने, खोज्ने, थप्ने र सच्याउने सबै चल्छ; परिवर्तन इन्टरनेट आएपछि आफैँ सर्भरमा जान्छ।</div>}
          {outbox.filter((i) => !i.error).length > 0 && (
            <div>
              ⏳ पठाउन बाँकी: {np(outbox.filter((i) => !i.error).length)} परिवर्तन
              {online && <button className="ghost" onClick={() => syncNow()}>अहिले पठाउने</button>}
            </div>
          )}
          {outbox.filter((i) => i.error).map((i) => (
            <div key={i.id} className="offe">
              ⚠ पठाउन सकिएन ({new Date(i.ts).toLocaleString("ne-NP")}): {i.error}
              <button className="ghost" onClick={() => discardOutbox(i.id)}>हटाउने</button>
            </div>
          ))}
        </div>
      )}
      <main id="app" className={inApp && eff === "tree" ? "wide" : ""} style={pushed ? { marginLeft: "calc(var(--det-w, 460px) + 18px)", marginRight: 0 } : undefined}>
        {phase === "loading" ? null : <>{banner}{inApp && <Crumbs tab={eff} />}{body}</>}
      </main>
      {panelOpen && (
        <div style={pushed ? ({ ["--det-top" as string]: `${hdrH}px` } as React.CSSProperties) : undefined}>
          <DetailPanel
            top={pushed ? hdrH : undefined}
            depthOf={eff === "tree" ? (id) => treeApi.current?.depthOf(id) : undefined}
            onGo={eff === "tree" ? (id) => treeApi.current?.reveal(id) : undefined}
            onPrint={eff === "tree" ? (id) => treeApi.current?.print(id) : undefined}
          />
        </div>
      )}
      <DialogHost />
      <Toast />
      <InstallButton />
    </>
  );
}

export default function VanshApp() {
  return (
    <VanshProvider>
      <Shell />
    </VanshProvider>
  );
}
