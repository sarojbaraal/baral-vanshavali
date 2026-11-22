// "वंश-विस्तार": every descendant of the grandfather (the father's father; the father, or the person themself when
// the record stops earlier), drawn as an SVG on light warm paper with curved wooden branches, leaves, generation
// bands and a faint mandala behind the root. The path from the root to the viewer is lit in saffron.
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
const TOP = 134;
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

  // ---- background: warm paper with soft colour washes, generation bands, a faint mandala behind the root, corner ornaments
  const cx0 = X(tree);
  let bg =
    `<rect width="${width}" height="${height}" fill="url(#dpaper)"/>` +
    `<rect width="${width}" height="${height}" fill="url(#dwash1)"/><rect width="${width}" height="${height}" fill="url(#dwash2)"/><rect width="${width}" height="${height}" fill="url(#dwash3)"/>` +
    `<rect width="${width}" height="${height}" fill="url(#dgrain)"/>`;
  for (let d = 0; d < gens; d++) {
    const y = TOP + d * ROW - ROW / 2 + 18;
    if (d % 2 === 0) bg += `<rect x="0" y="${y}" width="${width}" height="${ROW}" fill="#6f8f4f" opacity=".075"/>`;
    bg += `<rect x="16" y="${y + 12}" width="98" height="24" rx="12" fill="#fffdf8" stroke="#c9a45c" stroke-width="1"/>`;
    bg += `<text x="65" y="${y + 29}" text-anchor="middle" font-size="12.5" fill="#7d5a1e" ${FONT}>${np(d + 1)} औँ पुस्ता</text>`;
  }
  // mandala: concentric rings and petals
  const petals = Array.from({ length: 16 }, (_, i) => `<ellipse cx="0" cy="-86" rx="13" ry="42" transform="rotate(${i * 22.5})"/>`).join("");
  const petals2 = Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-150" rx="20" ry="52" transform="rotate(${i * 45 + 22.5})"/>`).join("");
  bg +=
    `<g transform="translate(${cx0} ${TOP + 10})" fill="#c9a45c" fill-opacity=".05" stroke="#b58a42" stroke-width="1.1" opacity=".3">` +
    `<circle r="214" fill="none"/><circle r="196" fill="none" stroke-dasharray="2 7"/><circle r="120" fill="none"/>${petals}${petals2}</g>`;
  // frame with corner ornaments
  bg += `<rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="20" fill="none" stroke="#b58a42" stroke-width="1.8" opacity=".85"/>`;
  bg += `<rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="15" fill="none" stroke="#b58a42" stroke-width=".7" opacity=".5"/>`;
  const corner = (x: number, y: number, sx: number, sy: number) =>
    `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="#b58a42" stroke-linecap="round" opacity=".8">` +
    `<path d="M0 46 C0 20 20 0 46 0" stroke-width="1.6"/><path d="M0 30 C0 14 14 0 30 0" stroke-width="1"/>` +
    `<path d="M12 12 q14 -2 20 -14 q-14 -1 -20 14z" fill="#7f9a5a" stroke="none" opacity=".8"/><circle cx="8" cy="8" r="3" fill="#c9a45c" stroke="none"/></g>`;
  bg += corner(10, 10, 1, 1) + corner(width - 10, 10, -1, 1) + corner(10, height - 10, 1, -1) + corner(width - 10, height - 10, -1, -1);

  // ---- branches (curved Béziers, wooden) first, so the medallions sit on top
  let shadow = "";
  let branches = "";
  let glow = "";
  let leaves = "";
  const leaf = (x: number, y: number, side: number, size: number, fill: string, op: number) =>
    `<path d="M${x} ${y} q${side * size * 0.75} ${-size * 0.3} ${side * size} ${-size} q${-side * size * 0.85} ${size * 0.05} ${-side * size} ${size}z" fill="${fill}" opacity="${op}"/>`;
  const walk = (u: U) => {
    const x1 = X(u);
    const y1 = u.y + R + 4;
    u.kids.forEach((k) => {
      const x2 = X(k);
      const y2 = k.y - R - 6;
      const d = `M${x1} ${y1} C${x1} ${y1 + (y2 - y1) * 0.62}, ${x2} ${y1 + (y2 - y1) * 0.38}, ${x2} ${y2}`;
      const w = Math.max(2, 5.4 - u.depth * 0.8);
      shadow += `<path d="${d}" stroke="#4a361d" stroke-opacity=".16" stroke-width="${w + 1.5}" fill="none" stroke-linecap="round" transform="translate(1.5 2.5)"/>`;
      if (k.lit) {
        glow += `<path d="${d}" stroke="#f6c75e" stroke-width="${w + 9}" opacity=".4" fill="none" stroke-linecap="round"/>`;
        branches += `<path d="${d}" stroke="#d98a1e" stroke-width="${w + 1.4}" fill="none" stroke-linecap="round"/>`;
        branches += `<path d="${d}" stroke="#ffe29a" stroke-width="${Math.max(1, w * 0.3)}" fill="none" stroke-linecap="round" opacity=".8" transform="translate(-.8 -.5)"/>`;
      } else {
        branches += `<path d="${d}" stroke="#7a5a31" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
        branches += `<path d="${d}" stroke="#b9935e" stroke-width="${Math.max(0.9, w * 0.28)}" fill="none" stroke-linecap="round" opacity=".6" transform="translate(-.7 -.4)"/>`;
      }
      // a pair of leaves where each branch meets its child
      const side = x2 >= x1 ? 1 : -1;
      leaves += leaf(x2, y2 + 1, side, 15, k.lit ? "#f0b43e" : "#6f8f4f", k.lit ? 0.95 : 0.85);
      leaves += leaf(x2, y2 + 1, -side, 12, k.lit ? "#f6cf6f" : "#8fae63", k.lit ? 0.9 : 0.75);
      walk(k);
    });
  };
  walk(tree);

  // ---- medallions
  let defs = "";
  let nodes = "";
  let idx = 0;
  const halo = (t: string, x: number, y: number, size: number, weight: number, fill: string) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="#fffdf8" stroke-width="4" stroke-linejoin="round" paint-order="stroke" ${FONT}>${esc(t)}</text>`;
  const medal = (p: VPerson, x: number, y: number, o2: { focus: boolean; lit: boolean; rootNode: boolean }) => {
    const i = idx++;
    const accent = p.gender === "F" ? "#a4506a" : p.gender === "M" ? "#44563a" : "#6b6a5c";
    const gone = p.is_living === false;
    const ring = o2.focus ? "#d98a1e" : o2.lit ? "#e0a037" : p.gender === "F" ? "#c98099" : p.gender === "M" ? "#7f9a5a" : "#c9a45c";
    let face: string;
    if (p.photo_url && !p.is_locked) {
      defs += `<clipPath id="dm${i}"><circle cx="${x}" cy="${y}" r="${R}"/></clipPath>`;
      face = `<image href="${esc(p.photo_url)}" x="${x - R}" y="${y - R}" width="${R * 2}" height="${R * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#dm${i})"${gone ? ' opacity=".85"' : ""}/>`;
    } else {
      face = `<circle cx="${x}" cy="${y}" r="${R}" fill="${accent}"/><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="25" font-weight="700" fill="#fff" ${FONT}>${esc(Array.from(nm(p).trim())[0] || "•")}</text>`;
    }
    const span = (() => {
      const b = yr(p.birth_bs);
      const d = yr(p.death_bs);
      return b && d ? `${np(b)}–${np(d)}` : b ? (gone ? `${np(b)}–` : `जन्म ${np(b)}`) : d ? `मृ. ${np(d)}` : "";
    })();
    nodes +=
      (o2.focus ? `<circle cx="${x}" cy="${y}" r="${R + 16}" fill="url(#dhalo)"/>` : "") +
      `<circle cx="${x}" cy="${y + 2.5}" r="${R + 5}" fill="#3b2d16" opacity=".2"/>` +
      `<circle cx="${x}" cy="${y}" r="${R + 5}" fill="#fffdf8" stroke="${ring}" stroke-width="${o2.focus ? 3.6 : o2.rootNode ? 3 : 2.2}"/>` +
      (o2.rootNode ? `<circle cx="${x}" cy="${y}" r="${R + 11}" fill="none" stroke="#b58a42" stroke-width="1" stroke-dasharray="2 5"/>` : "") +
      face +
      halo((gone ? "स्व. " : "") + cut(nm(p), 14), x, y + R + 24, 13, 700, o2.focus ? "#8a4f06" : "#2b2a20") +
      (span ? halo(span, x, y + R + 40, 10.5, 400, "#7d5a1e") : "");
    if (o2.focus) nodes += `<g transform="translate(${x} ${y - R - 17})"><rect x="-27" y="-11" width="54" height="20" rx="10" fill="#d98a1e"/><text y="3.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" ${FONT}>तपाईं</text></g>`;
    if (o2.rootNode) {
      // a small lotus above the founder
      const fy = y - R - 20;
      nodes += `<g transform="translate(${x} ${fy})" fill="#c4475f" opacity=".92"><path d="M0 8 C-5 0 -5 -8 0 -13 C5 -8 5 0 0 8z"/><path d="M-2 8 C-11 5 -15 -2 -14 -8 C-8 -6 -3 0 -2 8z" fill="#d97a91"/><path d="M2 8 C11 5 15 -2 14 -8 C8 -6 3 0 2 8z" fill="#d97a91"/></g>`;
    }
  };
  const draw = (u: U) => {
    const people = [u.p, ...u.spouses];
    const left = X(u) - (people.length * SLOT) / 2 + SLOT / 2;
    const xs = people.map((_, i) => left + i * SLOT);
    // the pair is tied by a small arc and a heart
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1] + R + 6;
      const b = xs[i] - R - 6;
      branches += `<path d="M${a} ${u.y} Q${(a + b) / 2} ${u.y - 20} ${b} ${u.y}" stroke="#b8862f" stroke-width="1.8" fill="none" stroke-dasharray="2 5" stroke-linecap="round"/>`;
      branches += `<path d="M${(a + b) / 2} ${u.y - 2} c-7 -6 -8 -13 -3 -14 c2 0 3 1 3 3 c0 -2 1 -3 3 -3 c5 1 4 8 -3 14z" fill="#c4475f" stroke="#fffdf8" stroke-width="1.6" paint-order="stroke"/>`;
    }
    people.forEach((p, i) => medal(p, xs[i], u.y, { focus: p.id === me.id, lit: u.lit && i === 0, rootNode: u.depth === 0 && i === 0 }));
    u.kids.forEach(draw);
  };
  draw(tree);

  const tw = Math.min(width - 120, 400);
  const title =
    `<rect x="${width / 2 - tw / 2}" y="24" width="${tw}" height="46" rx="23" fill="#fffdf8" stroke="#b58a42" stroke-width="1.6"/>` +
    `<rect x="${width / 2 - tw / 2 + 5}" y="29" width="${tw - 10}" height="36" rx="18" fill="none" stroke="#c9a45c" stroke-width=".7"/>` +
    `<text x="${width / 2}" y="54" text-anchor="middle" font-size="21" font-weight="700" fill="#3b4b2c" ${FONT}>${esc(cut(nm(root), 22))} को वंश-विस्तार</text>`;
  const foot = `<text x="${width / 2}" y="${height - 30}" text-anchor="middle" font-size="12.5" fill="#7d5a1e" ${FONT}>${np(count)} सदस्य · ${np(gens)} पुस्ता</text>`;

  const defsAll =
    `<defs>` +
    `<linearGradient id="dpaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf9ef"/><stop offset="1" stop-color="#f3ead3"/></linearGradient>` +
    `<radialGradient id="dwash1" cx="0%" cy="0%" r="70%"><stop offset="0" stop-color="#9db878" stop-opacity=".32"/><stop offset="1" stop-color="#9db878" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="dwash2" cx="100%" cy="100%" r="70%"><stop offset="0" stop-color="#e6c06a" stop-opacity=".34"/><stop offset="1" stop-color="#e6c06a" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="dwash3" cx="0%" cy="100%" r="55%"><stop offset="0" stop-color="#e3a3b4" stop-opacity=".2"/><stop offset="1" stop-color="#e3a3b4" stop-opacity="0"/></radialGradient>` +
    `<pattern id="dgrain" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#8a6a3a" opacity=".12"/><circle cx="14" cy="14" r=".8" fill="#8a6a3a" opacity=".08"/></pattern>` +
    `<radialGradient id="dhalo"><stop offset=".5" stop-color="#f6c75e" stop-opacity=".6"/><stop offset="1" stop-color="#f6c75e" stop-opacity="0"/></radialGradient>` +
    defs +
    `</defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(root))} को वंश-विस्तार">` +
    defsAll + bg + title + shadow + glow + branches + leaves + nodes + foot +
    `</svg>`;
  return { svg, width, height, count, gens, root };
}
