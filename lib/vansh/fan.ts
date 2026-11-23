// "पुर्खा-चक्र": the ancestor fan chart. The person sits in the middle of a half-circle; each ring outward is one generation
// further up (parents, grandparents … five generations, 2+4+8+16+32 places). The father's side is the left half (green),
// the mother's side the right half (rose). A place with nobody recorded stays an empty, dashed segment.
// With a `stamp` it is a finished poster (title, legend, usage notice, signature) ready to print or save as JPG.
import { faceSrc, type FaceOpts } from "./face";
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { BRAND, NOTICE, wrapChars, type Stamp } from "./notice";
import { np, yr } from "./text";

export interface Fan {
  svg: string;
  width: number;
  height: number;
  /** ancestors drawn, and places in the chart that are still empty */
  known: number;
  empty: number;
}

export interface FanOpts extends FaceOpts {
  gens?: number;
  nm?: (p: VPerson) => string;
  /** adds the title banner's signature + notice, as for a download */
  stamp?: Stamp;
}

const FONT = 'font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, serif"';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);

const R0 = 64;
const RING = [94, 104, 116, 126, 126];
const FATHER = ["#7f9a5a", "#93ad63", "#a9c07a", "#c0d29a", "#d6e2b8"];
const MOTHER = ["#c98099", "#d696ab", "#e2afbf", "#ecc7d2", "#f5dfe5"];
const LABEL = ["१ पुस्ता माथि", "२ पुस्ता माथि", "३ पुस्ता माथि", "४ पुस्ता माथि", "५ पुस्ता माथि"];

const xmlEsc = esc;

export function fanSvg(g: Graph, me: VPerson, o: FanOpts = {}): Fan {
  const gens = Math.max(1, Math.min(o.gens ?? 5, 5));
  const nm = (p: VPerson) => (o.nm ? o.nm(p) : p.name);
  const radii = [R0];
  for (let k = 0; k < gens; k++) radii.push(radii[k] + RING[k]);
  const ROUT = radii[gens];
  const PAD = 44;
  const TOPH = 120;
  const cx = ROUT + PAD;
  const cy = TOPH + ROUT;
  const width = 2 * (ROUT + PAD);
  const lines = o.stamp ? wrapChars(NOTICE, Math.floor(width / 7.4)) : [];
  const footH = o.stamp ? 40 + (lines.length + 1) * 17 : 0;
  const height = cy + 200 + footH;

  const pt = (r: number, phi: number) => `${(cx + r * Math.cos(phi)).toFixed(1)} ${(cy - r * Math.sin(phi)).toFixed(1)}`;
  const sector = (r1: number, r2: number, p1: number, p2: number) =>
    `M${pt(r1, p1)} L${pt(r2, p1)} A${r2} ${r2} 0 0 1 ${pt(r2, p2)} L${pt(r1, p2)} A${r1} ${r1} 0 0 0 ${pt(r1, p1)}Z`;

  // who stands in place i of generation k (1-based): the bits of i, most significant first, say father (0) or mother (1)
  const ancestor = (k: number, i: number): VPerson | undefined => {
    let p: VPerson | undefined = me;
    for (let b = k - 1; b >= 0 && p; b--) {
      const id: string | null | undefined = (i >> b) & 1 ? p.mother_id : p.father_id;
      p = id ? g.byId[id] : undefined;
    }
    return p;
  };

  let known = 0;
  let empty = 0;
  let segs = "";
  let texts = "";
  for (let k = 1; k <= gens; k++) {
    const n = 2 ** k;
    const r1 = radii[k - 1];
    const r2 = radii[k];
    for (let i = 0; i < n; i++) {
      const p1 = Math.PI - (i / n) * Math.PI;
      const p2 = Math.PI - ((i + 1) / n) * Math.PI;
      const paternal = i < n / 2;
      const a = ancestor(k, i);
      if (a) {
        known++;
        segs += `<path d="${sector(r1, r2, p1, p2)}" fill="${(paternal ? FATHER : MOTHER)[k - 1]}" stroke="#fffdf8" stroke-width="2.2" stroke-linejoin="round"/>`;
        const mid = (p1 + p2) / 2;
        const rm = (r1 + r2) / 2;
        let rot = (-mid * 180) / Math.PI;
        if (mid > Math.PI / 2) rot += 180;
        const gone = a.is_living === false;
        const fs = k === 1 ? 15 : k === 2 ? 14 : k === 3 ? 13 : k === 4 ? 12 : 10.5;
        const maxc = k === 1 ? 11 : k === 2 ? 14 : 13;
        const span = (() => {
          const b = yr(a.birth_bs);
          const d = yr(a.death_bs);
          return b && d ? `${np(b)}–${np(d)}` : b ? `${gone ? "" : "जन्म "}${np(b)}` : d ? `मृ. ${np(d)}` : "";
        })();
        texts +=
          `<g transform="translate(${pt(rm, mid)}) rotate(${rot.toFixed(1)})" text-anchor="middle" fill="#2b2a20" ${FONT}>` +
          `<text y="${k <= 3 && span ? -2 : 4}" font-size="${fs}" font-weight="700">${esc((gone && k <= 3 ? "स्व. " : "") + cut(nm(a), maxc))}</text>` +
          (k <= 3 && span ? `<text y="${fs + 1}" font-size="${(fs * 0.78).toFixed(1)}" fill="#5b4a2a">${esc(span)}</text>` : "") +
          `</g>`;
      } else {
        empty++;
        segs += `<path d="${sector(r1, r2, p1, p2)}" fill="#f6efdc" fill-opacity=".55" stroke="#d9c9a0" stroke-width="1" stroke-dasharray="3 4" stroke-linejoin="round"/>`;
      }
    }
  }

  // centre: the person
  const meSrc = faceSrc(me, o);
  const ini = esc(Array.from(nm(me).trim())[0] || "•");
  const centre =
    `<circle cx="${cx}" cy="${cy}" r="${R0 + 6}" fill="#fffdf8" stroke="#d98a1e" stroke-width="3.4"/>` +
    (meSrc
      ? `<clipPath id="fcm"><circle cx="${cx}" cy="${cy}" r="${R0 - 6}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${R0 - 6}" fill="${me.gender === "F" ? "#f4e3e8" : "#e6ecdf"}"/><image href="${esc(meSrc)}" x="${cx - R0 + 6}" y="${cy - R0 + 6}" width="${2 * (R0 - 6)}" height="${2 * (R0 - 6)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#fcm)"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${R0 - 6}" fill="${me.gender === "F" ? "#a4506a" : "#44563a"}"/>` +
        `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="40" font-weight="700" fill="#fff" ${FONT}>${ini}</text>`);

  // generation labels along the baseline, and the person's name under the centre
  let base = `<line x1="${cx - ROUT - 6}" y1="${cy}" x2="${cx + ROUT + 6}" y2="${cy}" stroke="#b58a42" stroke-width="1.2" opacity=".55"/>`;
  for (let k = 1; k <= gens; k++) {
    const rm = (radii[k - 1] + radii[k]) / 2;
    base += `<text x="${cx + rm}" y="${cy + 22}" text-anchor="middle" font-size="12.5" fill="#7d5a1e" ${FONT}>${LABEL[k - 1]}</text>`;
    base += `<text x="${cx - rm}" y="${cy + 22}" text-anchor="middle" font-size="12.5" fill="#7d5a1e" ${FONT}>${LABEL[k - 1]}</text>`;
  }
  base += `<text x="${cx}" y="${cy + 108}" text-anchor="middle" font-size="26" font-weight="700" fill="#2b2a20" ${FONT}>${esc(cut(nm(me), 26))}</text>`;
  base += `<text x="${cx}" y="${cy + 134}" text-anchor="middle" font-size="14" fill="#7d5a1e" ${FONT}>${np(known)} पुर्खा दर्ता · ${np(empty)} ठाउँ खाली</text>`;

  // legend
  const ly = cy + 160;
  const legend =
    `<rect x="${cx - 250}" y="${ly}" width="22" height="14" rx="4" fill="${FATHER[1]}"/><text x="${cx - 222}" y="${ly + 12}" font-size="13" fill="#2b2a20" ${FONT}> बायाँ — बुबाको पक्ष</text>` +
    `<rect x="${cx + 40}" y="${ly}" width="22" height="14" rx="4" fill="${MOTHER[1]}"/><text x="${cx + 68}" y="${ly + 12}" font-size="13" fill="#2b2a20" ${FONT}> दायाँ — आमाको पक्ष</text>`;

  // title
  const title =
    `<text x="${cx}" y="58" text-anchor="middle" font-size="34" font-weight="700" fill="#3b4b2c" ${FONT}>${esc(cut(nm(me), 24))} का पुर्खा</text>` +
    `<path d="M${cx - 90} 74 h180" stroke="#b58a42" stroke-width="1.4"/><path d="M${cx} 68 l5 6 l-5 6 l-5 -6z" fill="#b58a42"/>` +
    `<text x="${cx}" y="102" text-anchor="middle" font-size="15" fill="#7d5a1e" ${FONT}>पुर्खा-चक्र · ${np(gens)} पुस्तासम्म</text>`;

  // frame + wash
  const frame =
    `<rect width="${width}" height="${height}" fill="url(#fpaper)"/><rect width="${width}" height="${height}" fill="url(#fw1)"/><rect width="${width}" height="${height}" fill="url(#fw2)"/>` +
    `<rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="22" fill="none" stroke="#b58a42" stroke-width="2" opacity=".85"/>` +
    `<rect x="19" y="19" width="${width - 38}" height="${height - 38}" rx="16" fill="none" stroke="#b58a42" stroke-width=".8" opacity=".5"/>`;

  let foot = "";
  if (o.stamp) {
    const y0 = cy + 204;
    foot =
      `<line x1="40" y1="${y0 - 14}" x2="${width - 40}" y2="${y0 - 14}" stroke="#c9a45c"/>` +
      [...lines, o.stamp.line].map((l, i) => `<text x="44" y="${y0 + i * 17}" font-size="12" fill="#5b4a2a" ${FONT}>${xmlEsc(l)}</text>`).join("");
  }

  const defs =
    `<defs><linearGradient id="fpaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf9ef"/><stop offset="1" stop-color="#f3ead3"/></linearGradient>` +
    `<radialGradient id="fw1" cx="0%" cy="0%" r="70%"><stop offset="0" stop-color="#9db878" stop-opacity=".3"/><stop offset="1" stop-color="#9db878" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="fw2" cx="100%" cy="0%" r="70%"><stop offset="0" stop-color="#e3a3b4" stop-opacity=".28"/><stop offset="1" stop-color="#e3a3b4" stop-opacity="0"/></radialGradient></defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(me))} को पुर्खा-चक्र">` +
    (o.stamp ? `<metadata>${xmlEsc(BRAND + " | " + o.stamp.line)}</metadata>` : "") +
    defs + frame + title + segs + texts + centre + base + legend + foot +
    `</svg>`;
  return { svg, width, height, known, empty };
}
