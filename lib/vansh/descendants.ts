// "वंश-विस्तार": every descendant of the grandfather (the father's father; the father, or the person themself when
// the record stops earlier), drawn as an SVG on a night-green parchment with curved gold branches, generation
// bands and a faint mandala behind the root. The path from the root to the viewer is lit.
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { np, yr } from "./text";

export interface Descendants {
  svg: string;
  width: number;
  height: number;
  /** how many people are drawn (spouses included) and how many generations */
  count: number;
  gens: number;
  root: VPerson;
}

export interface DescOpts {
  nm?: (p: VPerson) => string;
}

const SLOT = 108; // width of one person
const R = 29; // medallion radius
const ROW = 168; // generation pitch
const TOP = 96;
const FONT = 'font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, serif"';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);

/** The person the chart starts from: the paternal grandfather, else the nearest ancestor up that line. */
export function descendantsRoot(g: Graph, p: VPerson): VPerson {
  const f = p.father_id ? g.byId[p.father_id] : undefined;
  const gf = f?.father_id ? g.byId[f.father_id] : undefined;
  return gf || f || p;
}

interface U {
  p: VPerson;
  spouses: VPerson[];
  kids: U[];
  depth: number;
  w: number;
  x: number;
  y: number;
  lit: boolean;
}

export function descendantsSvg(g: Graph, me: VPerson, o: DescOpts = {}): Descendants {
  const nm = (x: VPerson) => (o.nm ? o.nm(x) : x.name);
  const root = descendantsRoot(g, me);
  const seen = new Set<string>();
  let count = 0;
  let maxDepth = 0;

  const build = (p: VPerson, depth: number): U => {
    seen.add(p.id);
    const spouses = g.spousesOf(p).map((id) => g.byId[id]).filter((s): s is VPerson => !!s && !seen.has(s.id));
    spouses.forEach((s) => seen.add(s.id));
    count += 1 + spouses.length;
    maxDepth = Math.max(maxDepth, depth);
    const kids = depth > 12 ? [] : g.kidsOf(p).filter((k) => !seen.has(k.id)).sort(g.byBirth).map((k) => build(k, depth + 1));
    const own = (1 + spouses.length) * SLOT;
    const w = Math.max(own, kids.reduce((s, k) => s + k.w, 0));
    return { p, spouses, kids, depth, w, x: 0, y: TOP + depth * ROW, lit: false };
  };
  const tree = build(root, 0);

  // light the road from the root down to the viewer
  const mark = (u: U): boolean => {
    const hit = u.p.id === me.id || u.spouses.some((s) => s.id === me.id);
    const below = u.kids.map(mark).some(Boolean);
    u.lit = hit || below;
    return u.lit;
  };
  mark(tree);

  const place = (u: U, left: number) => {
    u.x = left + u.w / 2;
    let c = left + (u.w - u.kids.reduce((s, k) => s + k.w, 0)) / 2;
    u.kids.forEach((k) => {
      place(k, c);
      c += k.w;
    });
  };
  place(tree, 0);

  const PAD = 70;
  const width = Math.max(tree.w + PAD * 2, 520);
  const gens = maxDepth + 1;
  const height = TOP + maxDepth * ROW + 150;
  const sx = (width - tree.w) / 2;
  const X = (u: U) => u.x + sx;

  // ---- background: night parchment, generation bands, dotted grain, mandala behind the root, roots at the foot
  const cx0 = X(tree);
  let bg =
    `<rect width="${width}" height="${height}" fill="url(#dsky)"/>` +
    `<rect width="${width}" height="${height}" fill="url(#dgrain)" opacity=".55"/>`;
  for (let d = 0; d < gens; d++) {
    const y = TOP + d * ROW - ROW / 2 + 18;
    if (d % 2 === 0) bg += `<rect x="0" y="${y}" width="${width}" height="${ROW}" fill="#ffffff" opacity=".035"/>`;
    bg += `<text x="22" y="${y + 26}" font-size="13" fill="#d9b36a" opacity=".62" ${FONT}>${np(d + 1)} औँ पुस्ता</text>`;
  }
  // mandala: concentric rings and petals
  const petals = Array.from({ length: 16 }, (_, i) => `<ellipse cx="0" cy="-86" rx="13" ry="42" transform="rotate(${i * 22.5})"/>`).join("");
  const petals2 = Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-150" rx="20" ry="52" transform="rotate(${i * 45 + 22.5})"/>`).join("");
  bg +=
    `<g transform="translate(${cx0} ${TOP + 10})" fill="none" stroke="#d9b36a" stroke-width="1.1" opacity=".2">` +
    `<circle r="214"/><circle r="196" stroke-dasharray="2 7"/><circle r="120"/>${petals}${petals2}</g>`;
  // roots rising from the bottom edge, mirrored vines at the sides
  const rootY = height;
  bg += `<g fill="none" stroke="#b58a42" stroke-linecap="round" opacity=".28">`;
  for (let i = 0; i < 9; i++) {
    const x = width * (0.08 + i * 0.105);
    const lean = (i % 2 ? 1 : -1) * (34 + (i % 3) * 16);
    bg += `<path d="M${x} ${rootY} C${x + lean} ${rootY - 38}, ${x - lean * 0.6} ${rootY - 76}, ${x + lean * 0.4} ${rootY - 118}" stroke-width="${1.4 + (i % 3) * 0.5}"/>`;
    bg += `<path d="M${x + lean * 0.3} ${rootY - 64} q${lean * 0.7} -14 ${lean * 1.1} -6" stroke-width="1"/>`;
  }
  bg += `</g>`;
  bg += `<rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="22" fill="none" stroke="#d9b36a" stroke-width="1.6" opacity=".7"/>`;
  bg += `<rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="17" fill="none" stroke="#d9b36a" stroke-width=".7" opacity=".4"/>`;

  // ---- branches (curved Béziers) first, so the medallions sit on top
  let branches = "";
  let glow = "";
  let leaves = "";
  const walk = (u: U) => {
    const x1 = X(u);
    const y1 = u.y + R + 4;
    u.kids.forEach((k) => {
      const x2 = X(k);
      const y2 = k.y - R - 6;
      const ym = y1 + (y2 - y1) * 0.62;
      const d = `M${x1} ${y1} C${x1} ${ym}, ${x2} ${y1 + (y2 - y1) * 0.38}, ${x2} ${y2}`;
      const w = Math.max(1.6, 4.4 - u.depth * 0.7);
      if (k.lit) {
        glow += `<path d="${d}" stroke="#ffe29a" stroke-width="${w + 7}" opacity=".28" fill="none" stroke-linecap="round"/>`;
        branches += `<path d="${d}" stroke="url(#dgold)" stroke-width="${w + 1.2}" fill="none" stroke-linecap="round"/>`;
      } else branches += `<path d="${d}" stroke="#b58a42" stroke-opacity=".85" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
      // a small leaf at the tip of each branch
      const side = x2 >= x1 ? 1 : -1;
      leaves += `<path d="M${x2} ${y2 + 1} q${side * 11} -4 ${side * 15} -15 q${-side * 12} 1 ${-side * 15} 15z" fill="${k.lit ? "#ffe29a" : "#7f9a5a"}" opacity="${k.lit ? 0.95 : 0.7}"/>`;
      walk(k);
    });
  };
  walk(tree);

  // ---- medallions
  let defs = "";
  let nodes = "";
  let idx = 0;
  const medal = (p: VPerson, x: number, y: number, o2: { focus: boolean; lit: boolean; rootNode: boolean }) => {
    const i = idx++;
    const accent = p.gender === "F" ? "#a4506a" : p.gender === "M" ? "#44563a" : "#6b6a5c";
    const gone = p.is_living === false;
    const ring = o2.focus ? "#ffe29a" : o2.lit ? "#f0cf84" : "#d9b36a";
    let face: string;
    if (p.photo_url && !p.is_locked) {
      defs += `<clipPath id="dm${i}"><circle cx="${x}" cy="${y}" r="${R}"/></clipPath>`;
      face = `<image href="${esc(p.photo_url)}" x="${x - R}" y="${y - R}" width="${R * 2}" height="${R * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#dm${i})"${gone ? ' opacity=".8"' : ""}/>`;
    } else {
      face = `<circle cx="${x}" cy="${y}" r="${R}" fill="${accent}"/><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="25" font-weight="700" fill="#fff" ${FONT}>${esc(Array.from(nm(p).trim())[0] || "•")}</text>`;
    }
    const span = (() => {
      const b = yr(p.birth_bs);
      const d = yr(p.death_bs);
      return b && d ? `${np(b)}–${np(d)}` : b ? (gone ? `${np(b)}–` : `जन्म ${np(b)}`) : d ? `मृ. ${np(d)}` : "";
    })();
    nodes +=
      (o2.focus ? `<circle cx="${x}" cy="${y}" r="${R + 13}" fill="url(#dhalo)"/>` : "") +
      `<circle cx="${x}" cy="${y}" r="${R + 5}" fill="#1d2616" stroke="${ring}" stroke-width="${o2.focus ? 3.2 : o2.rootNode ? 2.8 : 1.8}"${gone ? ' stroke-dasharray="1 0"' : ""}/>` +
      (o2.rootNode ? `<circle cx="${x}" cy="${y}" r="${R + 10}" fill="none" stroke="#d9b36a" stroke-width="1" stroke-dasharray="2 5" opacity=".9"/>` : "") +
      face +
      `<text x="${x}" y="${y + R + 24}" text-anchor="middle" font-size="13" font-weight="700" fill="${o2.focus ? "#ffe29a" : "#f6efdc"}" ${FONT}>${esc((gone ? "स्व. " : "") + cut(nm(p), 14))}</text>` +
      (span ? `<text x="${x}" y="${y + R + 41}" text-anchor="middle" font-size="10.5" fill="#d9b36a" opacity=".9" ${FONT}>${esc(span)}</text>` : "");
  };
  const draw = (u: U) => {
    const people = [u.p, ...u.spouses];
    const left = X(u) - (people.length * SLOT) / 2 + SLOT / 2;
    const xs = people.map((_, i) => left + i * SLOT);
    // the pair is tied by a small arc and a heart
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1] + R + 6;
      const b = xs[i] - R - 6;
      branches += `<path d="M${a} ${u.y} Q${(a + b) / 2} ${u.y - 20} ${b} ${u.y}" stroke="#d9b36a" stroke-width="1.6" fill="none" stroke-dasharray="3 4" stroke-linecap="round"/>`;
      branches += `<path d="M${(a + b) / 2} ${u.y - 4} c-5 -5 -5 -11 0 -11 c5 0 5 6 0 11z" fill="#d9b36a"/>`;
    }
    people.forEach((p, i) => medal(p, xs[i], u.y, { focus: p.id === me.id, lit: u.lit && i === 0, rootNode: u.depth === 0 && i === 0 }));
    u.kids.forEach(draw);
  };
  draw(tree);

  const title = `<text x="${width / 2}" y="46" text-anchor="middle" font-size="22" font-weight="700" fill="#f3d99a" ${FONT}>${esc(cut(nm(root), 26))} को वंश-विस्तार</text>` +
    `<path d="M${width / 2 - 70} 58 h140" stroke="#d9b36a" stroke-width="1.2" opacity=".7"/>`;
  const foot = `<text x="${width / 2}" y="${height - 26}" text-anchor="middle" font-size="12" fill="#d9b36a" opacity=".8" ${FONT}>${np(count)} सदस्य · ${np(gens)} पुस्ता</text>`;

  const defsAll =
    `<defs>` +
    `<radialGradient id="dsky" cx="50%" cy="22%" r="85%"><stop offset="0" stop-color="#3b4b2c"/><stop offset=".55" stop-color="#27321c"/><stop offset="1" stop-color="#151c10"/></radialGradient>` +
    `<pattern id="dgrain" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#d9b36a" opacity=".35"/><circle cx="14" cy="14" r=".8" fill="#ffffff" opacity=".18"/></pattern>` +
    `<linearGradient id="dgold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset="1" stop-color="#d9a441"/></linearGradient>` +
    `<radialGradient id="dhalo"><stop offset=".55" stop-color="#ffe29a" stop-opacity=".55"/><stop offset="1" stop-color="#ffe29a" stop-opacity="0"/></radialGradient>` +
    defs +
    `</defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(root))} को वंश-विस्तार">` +
    defsAll + bg + title + glow + branches + leaves + nodes + foot +
    `</svg>`;
  return { svg, width, height, count, gens, root };
}
