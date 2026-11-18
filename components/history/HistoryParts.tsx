"use client";
// Reusable pieces of the history page: proof tags, scroll reveal, scan viewer with a magnifier, story spine, west-east route.
import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BASIS, ROUTE, STAGES, type Basis } from "@/lib/vansh/intro";

export const Tag = ({ b }: { b: Basis }) => (
  <span className={`bs bs-${b}`} title={BASIS[b].t}>
    {BASIS[b].l}
  </span>
);

/** Adds `on` once the element has scrolled into view. */
export function useSeen<T extends HTMLElement>(margin = "-12% 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, on] as const;
}

export interface Zoom {
  src: string;
  alt: string;
  w: number;
  h: number;
}

/** Full-screen view of a scan (Esc or tap to close, scroll to pan). */
export function Lightbox({ z, onClose }: { z: Zoom; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={z.alt} onClick={onClose}>
      <button className="ghost lbx" aria-label="बन्द गर्ने" onClick={onClose}>✕</button>
      <div className="lbs" onClick={(e) => e.stopPropagation()}>
        <Image src={z.src} alt={z.alt} width={z.w} height={z.h} unoptimized className="lbi" />
      </div>
    </div>
  );
}

export const LENS = 150;
export const ZOOM = 2.6;

/** A scan with a mouse magnifier (the handwriting is small). Tap or Enter opens the full-screen view. */
export function Scan({ z, onOpen, priority }: { z: Zoom; onOpen: (z: Zoom) => void; priority?: boolean }) {
  const box = useRef<HTMLButtonElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const move = useCallback(
    (e: React.PointerEvent) => {
      const b = box.current;
      const l = lens.current;
      if (!b || !l || e.pointerType !== "mouse") return;
      const r = b.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      l.style.opacity = "1";
      l.style.transform = `translate(${x - LENS / 2}px, ${y - LENS / 2}px)`;
      l.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
      l.style.backgroundPosition = `${LENS / 2 - x * ZOOM}px ${LENS / 2 - y * ZOOM}px`;
    },
    []
  );
  return (
    <button
      ref={box}
      className="scan"
      onClick={() => onOpen(z)}
      onPointerMove={move}
      onPointerLeave={() => lens.current && (lens.current.style.opacity = "0")}
      aria-label={`${z.alt} — ठूलो गरी हेर्ने`}
    >
      <Image src={z.src} alt={z.alt} width={z.w} height={z.h} unoptimized priority={priority} />
      <span ref={lens} className="lens" aria-hidden="true" style={{ backgroundImage: `url(${z.src})`, width: LENS, height: LENS }} />
      <em>🔍 ठूलो गर्न थिच्नुहोस्</em>
    </button>
  );
}

export function Stage({ s, last }: { s: (typeof STAGES)[number]; last: boolean }) {
  const [ref, on] = useSeen<HTMLLIElement>("-25% 0px -25% 0px");
  return (
    <li ref={ref} className={`stage${on ? " on" : ""}${last ? " last" : ""}`}>
      <span className="node" aria-hidden="true" />
      <p className="era">{s.era}</p>
      <h3>{s.h}</h3>
      <p className="body">{s.p}</p>
      <Tag b={s.b} />
    </li>
  );
}

export function Route() {
  const [ref, on] = useSeen<HTMLDivElement>("-10% 0px -10% 0px");
  return (
    <div ref={ref} className={`route${on ? " on" : ""}`} role="img" aria-label="पश्चिमबाट पूर्वतर्फ: अछाम, कास्की-लमजुङ, सिन्धुली-ओखलढुङ्गा, ताप्लेजुङ-इलाम, तराई र भारत">
      <div className="rt">
        <svg viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M20 70 C 160 20, 260 110, 400 64 S 640 20, 760 70 S 920 100, 980 56" pathLength="1" />
        </svg>
        {ROUTE.map((r, i) => (
          <div key={r.name} className="stop" style={{ left: `${r.x}%`, transitionDelay: `${0.25 + i * 0.22}s` }}>
            <i />
            <b>{r.name}</b>
            <small>{r.sub}</small>
          </div>
        ))}
        <span className="cmp w">पश्चिम</span>
        <span className="cmp e">पूर्व</span>
      </div>
    </div>
  );
}

