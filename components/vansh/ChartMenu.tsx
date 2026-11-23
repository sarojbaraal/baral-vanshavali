"use client";
// One small ⬇ button per chart; it opens a short list (PDF / SVG). Replaces the row of download buttons.
import React, { useEffect, useRef } from "react";

export function ChartMenu({ busy, onPick, label = "डाउनलोड" }: { busy?: string; onPick: (fmt: "pdf" | "svg") => void; label?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const pick = (f: "pdf" | "svg") => {
    if (ref.current) ref.current.open = false;
    onPick(f);
  };
  return (
    <details className="cmenu" ref={ref}>
      <summary aria-label={label} title={label} aria-busy={!!busy}>{busy ? "…" : "⬇"}</summary>
      <div className="cmenu-pop" role="menu">
        <button type="button" role="menuitem" disabled={!!busy} onClick={() => pick("pdf")}>PDF</button>
        <button type="button" role="menuitem" disabled={!!busy} onClick={() => pick("svg")}>SVG</button>
      </div>
    </details>
  );
}

/** A small − 80% + control. */
export function ZoomPill({ zoom, set, min = 0.35, max = 1.6 }: { zoom: number; set: (z: number) => void; min?: number; max?: number }) {
  return (
    <span className="zpill" role="group" aria-label="चार्ट आकार">
      <button type="button" aria-label="सानो" onClick={() => set(Math.max(min, +(zoom - 0.15).toFixed(2)))}>−</button>
      <output>{Math.round(zoom * 100)}%</output>
      <button type="button" aria-label="ठूलो" onClick={() => set(Math.min(max, +(zoom + 0.15).toFixed(2)))}>+</button>
    </span>
  );
}
