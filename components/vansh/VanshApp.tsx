"use client";
// App shell: header (tabs, user, theme), the active view, profile panel, dialogs, toast, PWA install button.
import React, { useEffect, useState } from "react";
import { DownloadDialog } from "./DownloadMenu";
import Link from "next/link";
import { ROLE_L } from "@/lib/vansh/graph";
import { np } from "@/lib/vansh/text";
import type { Role, TabKey } from "@/lib/vansh/types";
import { VanshProvider, useVansh } from "./VanshContext";
import { DialogHost, Toast } from "./ui";
import { AuthView, PendingView, PosView, ResetView } from "./AuthViews";
import { FamView, MemView } from "./ListViews";
import SiteNav from "@/components/site/SiteNav";
import TreeView from "./TreeView";
import DetailPanel from "./DetailPanel";
import { AdminView, MineView } from "./RequestViews";
import OverviewView from "./OverviewView";
import { PasswordDialog } from "./PersonDialogs";
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
  const { db, phase, me, act, roles, setAct, tab, setTab, sel, perms, treeApi, people, openDialog, online, outbox, syncNow, discardOutbox, previewAs, setPreviewAs, g } = useVansh();
  const [wide, setWide] = useState(true);
  const [hdrH, setHdrH] = useState(72);

  useEffect(() => {
    const f = () => {
      setWide(innerWidth > 640);
      const r = document.querySelector(".appbar")?.getBoundingClientRect();
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

  // "हाम्रो वंश", "परिवार शाखाहरु" and "मेरो खाता" live in the shared top navigation; only the extra views are here
  const tabs: [TabKey, string][] = [
    ["mem", "सदस्य"],
    ...(perms.isStaff ? ([["admin", "एडमिन"]] as [TabKey, string][]) : []),
  ];

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
      fam: <FamView />,
      tree: <TreeView />,
      mem: <MemView />,
      mine: <MineView />,
      admin: <AdminView />,
      ov: <OverviewView />,
    }[eff];

  return (
    <>
      <SiteNav
        active={eff === "tree" ? "lineage" : eff === "fam" || eff === "ov" ? "branches" : eff === "mine" ? "account" : "none"}
        signedIn={inApp}
        onTab={inApp ? (t) => setTab(t) : undefined}
      />
      {(inApp || showWho) && (
      <div className="appbar">
        <nav id="tabs" aria-label="मुख्य मेनु">
          {inApp &&
            tabs.map(([k, l]) => (
              <button key={k} className={eff === k || (k === "fam" && eff === "ov") ? "on" : ""} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
        </nav>
        <div id="who">
          {showWho && (
            <>
              <span className="wn">{dispName}</span>
              {roles.length > 1 ? (
                <select aria-label="भूमिका छान्नुहोस्" value={act || ""} onChange={(e) => setAct(e.target.value as Role)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{ROLE_L[r]}</option>
                  ))}
                </select>
              ) : (
                <span className="tag">{(act && ROLE_L[act]) || "पर्खाइमा"}</span>
              )}
              {oauthOnly && (
                <button className="ghost" id="pwb" title="इमेल/पासवर्ड जोड्ने" aria-label="इमेल/पासवर्ड जोड्ने" onClick={() => openDialog(<PasswordDialog />)}>🔑</button>
              )}
              <button className="ghost" id="out" onClick={() => db.auth.signOut()}>बाहिर</button>
            </>
          )}
        </div>
        <span id="ver" tabIndex={0} aria-label="संस्करण" data-t={`आज ${todayTxt}${perms.isAdm ? ` · Build: ${APP_VER}` : ` · ${APP_VER}`}`}>
          ⓘ
        </span>
      </div>
      )}
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
        {phase === "loading" ? null : <>{banner}{body}</>}
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
