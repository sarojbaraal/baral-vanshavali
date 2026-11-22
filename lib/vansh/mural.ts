// "भित्ते वंशवृक्ष" for the printed life-sheet: the family of the grandfather as a painted tree on a cream wall.
// Every person hangs in a gold frame (walnut when deceased) by a rope from the bough of their generation; couples are
// tied by a heart; a vine runs from each family down to the bough its children hang from.
// Rules for who is drawn (see the family's own words):
//   • sons of the house keep their whole family (wife and children), generation after generation;
//   • a daughter is drawn alone: her photo, name and a gender sign — not her husband or children;
//   • in a very big family the children of the brothers shrink to a small plate with name and gender sign only —
//     except the viewer's own line (the road down to them, their spouse and children), which always keeps its frames.
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { descendantsRoot } from "./descendants";
import { rng } from "./treeArt";
import { np, yr } from "./text";

export interface Mural {
  svg: string;
  width: number;
  height: number;
  /** ids drawn (spouses included), and how many of them are framed or small plates */
  ids: string[];
  frames: number;
  plates: number;
  root: VPerson;
}

export interface MuralOpts {
  nm?: (p: VPerson) => string;
  /** widest row (in drawing units) before the brothers' children shrink to plates */
  limit?: number;
}

const FW = 132; // slot of a framed person
const FRW = 120; // the frame itself
const FH = 172;
const PW = 104; // slot of a small plate
const PLW = 96;
const PLH = 54;
const ROWH = 250;
const TOP0 = 300;
const PAD = 64;
const MAXD = 3; // root + three generations
const FONT = 'font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, serif"';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);
const GREENS = ["#4f6f3a", "#5f8044", "#6f9150", "#7f9f5a", "#93ad63", "#a9c07a"];

interface N {
  p: VPerson;
  spouses: VPerson[];
  kids: N[];
  depth: number;
  plate: boolean;
  keep: boolean; // the viewer's own line: never shrinks
  lit: boolean;
  w: number;
  x: number;
}

export function muralSvg(g: Graph, me: VPerson, o: MuralOpts = {}): Mural {
  const nm = (x: VPerson) => (o.nm ? o.nm(x) : x.name);
  const root = descendantsRoot(g, me);
  const seen = new Set<string>();
  const mine = new Set<string>([me.id]); // the viewer, spouse(s) and children
  g.spousesOf(me).forEach((s) => mine.add(s));
  g.kidsOf(me).forEach((k) => mine.add(k.id));

  const build = (p: VPerson, depth: number): N => {
    seen.add(p.id);
    // a daughter stands alone (the viewer is the one exception: it is their own sheet)
    const family = p.gender !== "F" || p.id === me.id;
    const spouses = family ? g.spousesOf(p).map((id) => g.byId[id]).filter((s): s is VPerson => !!s && !seen.has(s.id)) : [];
    spouses.forEach((s) => seen.add(s.id));
    const kids = family && depth < MAXD ? g.kidsOf(p).filter((k) => !seen.has(k.id)).sort(g.byBirth).map((k) => build(k, depth + 1)) : [];
    return { p, spouses, kids, depth, plate: false, keep: false, lit: false, w: 0, x: 0 };
  };
  const tree = build(root, 0);

  // the road from the root down to the viewer (and the viewer's own people) keeps its frames
  const mark = (n: N): boolean => {
    const hit = n.p.id === me.id || n.spouses.some((s) => s.id === me.id);
    const below = n.kids.map(mark).some(Boolean);
    n.lit = hit || below;
    n.keep = n.lit || mine.has(n.p.id) || n.depth <= 1;
    return n.lit;
  };
  mark(tree);
  // the viewer's brothers and sisters (children of anyone on the road) keep their frames too
  const kin = (n: N): void => {
    if (n.lit) n.kids.forEach((k) => (k.keep = true));
    n.kids.forEach(kin);
  };
  kin(tree);

  const slot = (n: N) => (n.plate ? PW : FW);
  const measure = (n: N): void => {
    n.kids.forEach(measure);
    const own = (1 + n.spouses.length) * slot(n);
    n.w = Math.max(own, n.kids.reduce((s, k) => s + k.w, 0));
  };
  const all = (n: N, out: N[] = []): N[] => (out.push(n), n.kids.forEach((k) => all(k, out)), out);
  measure(tree);
  // a very big family: shrink the children of the brothers, deepest generation first
  const limit = o.limit ?? 1000;
  for (let d = MAXD; d >= 2 && tree.w > limit; d--) {
    all(tree).filter((n) => n.depth === d && !n.keep).forEach((n) => (n.plate = true));
    measure(tree);
  }

  const place = (n: N, left: number) => {
    n.x = left + n.w / 2;
    let c = left + (n.w - n.kids.reduce((s, k) => s + k.w, 0)) / 2;
    n.kids.forEach((k) => {
      place(k, c);
      c += k.w;
    });
  };
  place(tree, 0);

  const flat = all(tree);
  const maxDepth = Math.max(...flat.map((n) => n.depth));
  const width = Math.max(tree.w + PAD * 2, 760);
  const sx = (width - tree.w) / 2;
  const X = (n: N) => n.x + sx;
  const CX = width / 2;
  // a small family still fills the portrait page: the rows spread apart (up to a point)
  const natural = TOP0 + maxDepth * ROWH + FH + 96 + 100;
  const rowH = ROWH + Math.max(0, Math.min(150, (width * 1.28 - natural) / Math.max(1, maxDepth)));
  const rowTop = (d: number) => TOP0 + d * rowH;
  const lastBottom = rowTop(maxDepth) + FH;
  const G = lastBottom + 96;
  const height = G + 100;
  const rnd = rng(root.id + "|mural");

  // ---------------------------------------------------------------- the wall
  const Y0 = (d: number) => rowTop(d) - 54;
  const topY = Y0(0) - 6;
  const tH = G - topY;
  const tc = (y: number) => CX + 12 * Math.sin(((G - y) / tH) * Math.PI * 1.7);
  const hw = (y: number) => 10 + 46 * Math.pow(Math.max(0, 1 - (G - y) / tH), 2.1) + 26 * Math.exp(-(G - y) / 60);
  const fx = (v: number) => v.toFixed(1);
  const cs = (a: number) => Math.cos((a * Math.PI) / 180);
  const sn = (a: number) => Math.sin((a * Math.PI) / 180);

  let s = `<rect width="${width}" height="${height}" fill="url(#mwall)"/><rect width="${width}" height="${height}" fill="url(#mgrain)"/>`;
  s += `<polygon points="${width * 0.55},0 ${width},0 ${width},${height * 0.55}" fill="url(#mlight)"/>`;

  // ---------------------------------------------------------------- trunk: a sculpted, slightly swaying stem that flares into the grass
  const ys: number[] = [];
  for (let i = 0; i <= 40; i++) ys.push(G + 12 - (i / 40) * (tH + 12));
  const left = ys.map((y) => `${fx(tc(y) - hw(y))} ${fx(y)}`);
  const right = ys.map((y) => `${fx(tc(y) + hw(y))} ${fx(y)}`).reverse();
  s += `<path d="M${left.join(" L")} L${right.join(" L")} Z" fill="url(#mbark)" stroke="#4a361d" stroke-width="1.8" stroke-linejoin="round"/>`;
  for (let k = 1; k < 11; k++) {
    const f = -1 + (2 * k) / 11;
    const wob = (rnd() - 0.5) * 0.18;
    const pts = ys.filter((_, i) => i % 4 === 0).map((y) => `${fx(tc(y) + (f + wob) * hw(y))} ${fx(y)}`);
    s += `<path d="M${pts.join(" L")}" fill="none" stroke="${k % 3 ? "#4a361d" : "#c9a674"}" stroke-width="${(1 + rnd() * 1.6).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${k % 3 ? 0.34 : 0.4}"/>`;
  }
  // a knot or two in the bark
  [0.3, 0.55].forEach((u, i) => {
    const y = G - u * tH;
    s += `<ellipse cx="${fx(tc(y) + (i ? 6 : -8))}" cy="${fx(y)}" rx="5" ry="9" fill="#4a361d" opacity=".35"/>`;
  });
  // roots reaching out into the grass
  [[-1, 180, 24], [1, 200, 28], [-1, 115, 15], [1, 125, 17]].forEach(([sg, len, drop]) => {
    s += `<path d="M${CX + sg * 36} ${G - 10} C${CX + sg * 66} ${G + 4}, ${CX + sg * len * 0.6} ${G + drop * 0.4}, ${CX + sg * len} ${G + drop}" fill="none" stroke="#6e5230" stroke-width="14" stroke-linecap="round"/>`;
    s += `<path d="M${CX + sg * 36} ${G - 12} C${CX + sg * 66} ${G + 1}, ${CX + sg * len * 0.6} ${G + drop * 0.3}, ${CX + sg * len} ${G + drop - 3}" fill="none" stroke="#a98253" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
  });

  // ---------------------------------------------------------------- boughs: one winding limb per generation row, each throwing curved twigs and leaf sprays
  const span = (d: number) => {
    const xs = flat.filter((n) => n.depth === d).flatMap((n) => {
      const c = X(n);
      return [c - ((1 + n.spouses.length) * slot(n)) / 2, c + ((1 + n.spouses.length) * slot(n)) / 2];
    });
    return Math.min(width / 2 - 26, Math.max(...xs.map((x) => Math.abs(x - CX))) + 70);
  };
  const A = 56;
  const tcd = (d: number) => tc(Y0(d));
  const bough = (d: number, x: number) => {
    const t = Math.min(1, Math.abs(x - tcd(d)) / span(d));
    return Y0(d) - A * Math.pow(t, 1.6) + 9 * Math.sin(t * 5 + d * 1.7);
  };
  let wood = "";
  let leaves = "";
  const lf = (x: number, y: number, rot: number, sc: number, col: string, op = 1) =>
    `<use href="#${rnd() < 0.35 ? "mlf2" : "mlf"}" transform="translate(${fx(x)} ${fx(y)}) rotate(${rot.toFixed(0)}) scale(${sc.toFixed(1)})" fill="${col}"${op < 1 ? ` opacity="${op}"` : ""}/>`;
  const green = () => GREENS[Math.floor(rnd() * GREENS.length)];
  const BL = ["#fbefe0", "#f7d9de", "#fdf4e6", "#f2c6cf"];
  const blossom = (x: number, y: number, sc = 1) => `<use href="#mbl" transform="translate(${fx(x)} ${fx(y)}) scale(${sc.toFixed(2)})" fill="${BL[Math.floor(rnd() * BL.length)]}"/>`;
  const spray = (x: number, y: number, a: number, n: number, sc: number) => {
    for (let j = 0; j < n; j++) leaves += lf(x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8, a + 90 + (j - (n - 1) / 2) * (34 + rnd() * 14), sc * (0.8 + rnd() * 0.5), green(), 0.95);
  };
  // a curving twig; branches again on its way out (up to two levels)
  const twig = (x: number, y: number, ang: number, len: number, w: number, lvl: number, curl: number): void => {
    const n = lvl === 0 ? 6 : 4;
    const st = len / n;
    let px = x;
    let py = y;
    let a = ang;
    for (let i = 0; i < n; i++) {
      a += curl * (5 + rnd() * 9);
      const nx = px + cs(a) * st;
      const ny = py + sn(a) * st;
      const ww = Math.max(1.4, w * (1 - (i / n) * 0.65));
      wood += `<line x1="${fx(px)}" y1="${fx(py)}" x2="${fx(nx)}" y2="${fx(ny)}" stroke="${lvl === 0 ? "#6e5230" : "#7d5d34"}" stroke-width="${ww.toFixed(1)}" stroke-linecap="round"/>`;
      if (i >= 1) {
        leaves += lf(nx, ny, a + 90 + 48 + (rnd() - 0.5) * 24, 8 + rnd() * 6, green(), 0.96);
        leaves += lf(nx, ny, a + 90 - 48 + (rnd() - 0.5) * 24, 8 + rnd() * 6, green(), 0.96);
      }
      if (lvl < 2 && (i === 1 || i === 3) && n > 2) twig(nx, ny, a + (i === 1 ? -1 : 1) * curl * (32 + rnd() * 24), len * 0.55, w * 0.62, lvl + 1, -curl);
      px = nx;
      py = ny;
    }
    spray(px, py, a, 3, 9);
    if (rnd() < 0.5) leaves += blossom(px + cs(a) * 6, py + sn(a) * 6, 0.85 + rnd() * 0.4);
  };

  for (let d = 0; d <= maxDepth; d++) {
    const Hs = span(d);
    const base = 12 + (maxDepth - d) * 0 + (d === 0 ? 3 : 0);
    for (const side of [-1, 1]) {
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = tcd(d) + side * Hs * t;
        const y = bough(d, x);
        if (prev) {
          const w = base + (2.6 - base) * Math.pow(t, 0.7);
          wood += `<line x1="${fx(prev[0])}" y1="${fx(prev[1] + 2)}" x2="${fx(x)}" y2="${fx(y + 2)}" stroke="#3b2d16" stroke-opacity=".16" stroke-width="${(w + 2).toFixed(1)}" stroke-linecap="round"/>`;
          wood += `<line x1="${fx(prev[0])}" y1="${fx(prev[1])}" x2="${fx(x)}" y2="${fx(y)}" stroke="#6e5230" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
          wood += `<line x1="${fx(prev[0])}" y1="${fx(prev[1] - w * 0.22)}" x2="${fx(x)}" y2="${fx(y - w * 0.22)}" stroke="#b9935e" stroke-width="${Math.max(1, w * 0.24).toFixed(1)}" stroke-linecap="round" opacity=".5"/>`;
          const slope = (Math.atan2(y - prev[1], x - prev[0]) * 180) / Math.PI;
          if (i % 2 === 0) twig(x, y, -90 + side * (28 + rnd() * 22), 40 + rnd() * 30, 4.4, 1, -side * (0.8 + rnd() * 0.5));
          if (i % 3 === 1) twig(x, y, -90 + side * (62 + rnd() * 18), 28 + rnd() * 22, 3.6, 1, side * 0.9);
          if (i % 4 === 2 && i < 22) twig(x, y, 90 - side * (28 + rnd() * 20), 18 + rnd() * 12, 3, 2, side);
          leaves += lf(x, y - 1, slope + 90 + side * 40 + (rnd() - 0.5) * 30, 9 + rnd() * 5, green(), 0.95);
        }
        prev = [x, y];
      }
      twig(prev![0], prev![1], side === 1 ? -8 : 188, 56, 4.6, 1, -side);
    }
  }
  // the crown: sinuous boughs fanning up and out from the top, thick with leaves and blossom, the title kept clear
  for (let k = 0; k < 10; k++) {
    const side = k % 2 ? 1 : -1;
    const ang = -90 + side * (14 + Math.floor(k / 2) * 17 + rnd() * 6);
    const ox = tcd(0) + side * (2 + rnd() * 6);
    twig(ox, topY + 18, ang, 80 + rnd() * 30 - Math.floor(k / 2) * 4, 9 - Math.floor(k / 2) * 0.8, 0, side * (0.6 + rnd() * 0.4));
  }
  // a dense canopy of leaves behind the crown
  for (let i = 0; i < 90; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const rr = Math.pow(rnd(), 0.8) * 170;
    const a = -90 + side * rnd() * 80;
    const x = tcd(0) + cs(a) * rr;
    const y = topY + 8 + sn(a) * rr * 0.62;
    if (y < 168) continue;
    leaves += lf(x, y, a + 90 + (rnd() - 0.5) * 140, 8 + rnd() * 7, green(), 0.9);
    if (i % 9 === 0) leaves += blossom(x, y, 0.9);
  }

  // ---------------------------------------------------------------- vines: from each family down to the bough its children hang from
  let vines = "";
  flat.forEach((n) => {
    if (!n.kids.length) return;
    const k0 = X(n.kids[0]);
    const k1 = X(n.kids[n.kids.length - 1]);
    const tx = (k0 + k1) / 2;
    const y1 = rowTop(n.depth) + (n.plate ? PLH : FH) + 2;
    const y2 = bough(n.depth + 1, tx);
    const x1 = X(n);
    const d = `M${fx(x1)} ${y1} C${fx(x1)} ${fx(y1 + (y2 - y1) * 0.6)}, ${fx(tx)} ${fx(y1 + (y2 - y1) * 0.4)}, ${fx(tx)} ${fx(y2)}`;
    vines += `<path d="${d}" fill="none" stroke="${n.lit ? "#d98a1e" : "#7a5a31"}" stroke-width="${n.lit ? 4.2 : 3.2}" stroke-linecap="round"/>`;
    const my = (y1 + y2) / 2;
    vines += lf((x1 + tx) / 2, my, 55, 9, n.lit ? "#f0b43e" : "#6f9150") + lf((x1 + tx) / 2, my, -55, 8, n.lit ? "#f6cf6f" : "#8fae63");
  });

  // ---------------------------------------------------------------- frames, medallions, plates, ropes
  let defs = "";
  let hang = "";
  let hearts = "";
  let idx = 0;
  let nFrames = 0;
  let nPlates = 0;
  const ids: string[] = [];
  const sign = (x: number, y: number, female: boolean, col: string, sc = 1) =>
    `<g transform="translate(${x} ${y}) scale(${sc})" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    (female
      ? `<circle cx="0" cy="-3" r="5.2"/><path d="M0 2.2 V10.5 M-3.6 7 H3.6"/>`
      : `<circle cx="-1.5" cy="2" r="5.2"/><path d="M2.3 -1.8 L8.5 -8 M3.6 -8 H8.5 V-3.1"/>`) +
    `</g>`;
  const life = (p: VPerson) => {
    const b = yr(p.birth_bs);
    const d = yr(p.death_bs);
    return b && d ? `${np(b)} – ${np(d)}` : b ? (p.is_living === false ? `${np(b)} –` : `जन्म ${np(b)}`) : d ? `मृ. ${np(d)}` : "";
  };
  const rope = (x: number, y1: number, y2: number, lit: boolean) =>
    `<path d="M${fx(x)} ${fx(y1)} L${fx(x)} ${fx(y2)}" stroke="${lit ? "#b8741a" : "#9a7648"}" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="M${fx(x)} ${fx(y1)} L${fx(x)} ${fx(y2)}" stroke="#e2c995" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="3 3" opacity=".85"/>` +
    `<circle cx="${fx(x)}" cy="${fx(y1)}" r="3.8" fill="#6e5230"/>`;
  const wrap = (p: VPerson, gone: boolean, n1: number, n2: number): string[] => {
    const full = (gone ? "स्व. " : "") + nm(p).trim();
    if (Array.from(full).length <= n1) return [full];
    const w = full.split(/\s+/);
    if (w.length < 2) return [cut(full, n1)];
    return [cut(w.slice(0, -1).join(" "), n1), cut(w[w.length - 1], n2)];
  };
  const photo = (p: VPerson, i: number, cx: number, cy: number, r: number, female: boolean) => {
    if (p.photo_url && !p.is_locked) {
      defs += `<clipPath id="mf${i}"><circle cx="${fx(cx)}" cy="${fx(cy)}" r="${r}"/></clipPath>`;
      return `<image href="${esc(p.photo_url)}" x="${fx(cx - r)}" y="${fx(cy - r)}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#mf${i})"/>`;
    }
    return `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${r}" fill="${female ? "#a4506a" : "#44563a"}"/><text x="${fx(cx)}" y="${fx(cy + r * 0.36)}" text-anchor="middle" font-size="${Math.round(r * 1.05)}" font-weight="700" fill="#fff" ${FONT}>${esc(Array.from(nm(p).trim())[0] || "•")}</text>`;
  };
  const wallText = (x: number, y: number, t: string, size: number, bold: boolean, fill: string) =>
    `<text x="${fx(x)}" y="${fx(y)}" text-anchor="middle" font-size="${size}" ${bold ? 'font-weight="700"' : ""} fill="${fill}" stroke="#f6efdc" stroke-width="3.4" stroke-linejoin="round" paint-order="stroke" ${FONT}>${esc(t)}</text>`;

  const drawPerson = (p: VPerson, cx: number, d: number, plate: boolean, lit: boolean, focus: boolean) => {
    const i = idx++;
    ids.push(p.id);
    const gone = p.is_living === false;
    const female = p.gender === "F";
    const top = rowTop(d);
    const by = bough(d, cx);
    const frameCol = gone ? "#6e4b2a" : "#c9a14a";
    const edgeCol = gone ? "#3f2a15" : "#8a6a24";
    const sgCol = female ? "#a4506a" : "#44563a";
    const mat = gone ? "#efe6d3" : female ? "#f7e6e1" : "#f4ead2";
    const pill = (y: number) =>
      focus ? `<g transform="translate(${fx(cx)} ${fx(y)})"><rect x="-27" y="-10" width="54" height="21" rx="10.5" fill="#d98a1e" stroke="#fffdf8" stroke-width="1.6"/><text y="4.5" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff" ${FONT}>तपाईं</text></g>` : "";

    if (plate) {
      nPlates++;
      const lines = wrap(p, gone, 9, 9);
      const x0 = cx - PLW / 2;
      hang += `<g data-p="${esc(p.id)}" data-tier="plate">` + rope(cx, by, top + 2, lit);
      hang += `<rect x="${x0 + 2}" y="${top + 5}" width="${PLW}" height="${PLH}" rx="9" fill="#3b2d16" opacity=".22"/>`;
      hang += `<rect x="${x0}" y="${top + 2}" width="${PLW}" height="${PLH}" rx="9" fill="${mat}" stroke="${frameCol}" stroke-width="3"/>`;
      hang += sign(x0 + 14, top + 2 + PLH / 2, female, sgCol, 0.9);
      const tx = x0 + 28 + (PLW - 32) / 2;
      lines.forEach((l, k) => (hang += `<text x="${tx}" y="${top + 2 + PLH / 2 + (lines.length === 1 ? 5 : k === 0 ? -1 : 14)}" text-anchor="middle" font-size="${lines.length === 1 ? 13 : 12.5}" font-weight="700" fill="#2b2a20" ${FONT}>${esc(l)}</text>`));
      hang += `</g>`;
      return;
    }
    nFrames++;
    hang += `<g data-p="${esc(p.id)}" data-tier="frame">`;

    if (d === 0) {
      // the founder: a round crown medallion with a nameplate below
      const r = 46;
      const my = top + 52;
      hang += rope(cx, by, my - r - 4, lit);
      let wreath = "";
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * 360 - 90;
        wreath += `<use href="#mlf" transform="translate(${fx(cx + cs(a) * (r + 3))} ${fx(my + sn(a) * (r + 3))}) rotate(${(a + 90 + (k % 2 ? 40 : -40)).toFixed(0)}) scale(8)" fill="${GREENS[k % GREENS.length]}"/>`;
      }
      if (focus) hang += `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r + 16}" fill="url(#mglow)"/>`;
      hang +=
        wreath +
        `<circle cx="${fx(cx + 2)}" cy="${fx(my + 4)}" r="${r + 2}" fill="#3b2d16" opacity=".25"/>` +
        `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r + 2}" fill="${frameCol}" stroke="${edgeCol}" stroke-width="1.6"/>` +
        `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r - 5}" fill="${mat}" stroke="#ecd48e" stroke-width="1.4"/>` +
        photo(p, i, cx, my, r - 9, female);
      const lines = wrap(p, gone, 17, 14);
      const ny = top + 104;
      const nh = 20 + lines.length * 17 + (life(p) ? 15 : 0);
      hang +=
        `<rect x="${fx(cx - 62)}" y="${ny + 3}" width="124" height="${nh}" rx="8" fill="#3b2d16" opacity=".22"/>` +
        `<rect x="${fx(cx - 62)}" y="${ny}" width="124" height="${nh}" rx="8" fill="#fbf3dd" stroke="${frameCol}" stroke-width="2.4"/>` +
        sign(cx - 50, ny + 16, female, sgCol, 0.8) +
        lines.map((l, k) => `<text x="${fx(cx + 6)}" y="${ny + 20 + k * 16}" text-anchor="middle" font-size="${lines.length === 1 ? 14.5 : 13.5}" font-weight="700" fill="#2b2a20" ${FONT}>${esc(l)}</text>`).join("") +
        (life(p) ? `<text x="${fx(cx)}" y="${ny + 20 + lines.length * 16 + 1}" text-anchor="middle" font-size="11.5" fill="#6b5a36" ${FONT}>${esc(life(p))}</text>` : "");
      hang += pill(ny + nh + 2) + `</g>`;
      return;
    }

    if (d >= 2 && gone) {
      // a deceased member of a later generation: an oval walnut frame, the name written on the wall beneath
      const ry = 62;
      const my = top + ry + 4;
      hang += rope(cx, by, my - ry - 1, lit);
      if (focus) hang += `<ellipse cx="${fx(cx)}" cy="${fx(my)}" rx="${FRW / 2 + 14}" ry="${ry + 14}" fill="url(#mglow)"/>`;
      hang +=
        `<ellipse cx="${fx(cx + 3)}" cy="${fx(my + 5)}" rx="${FRW / 2 - 8}" ry="${ry}" fill="#3b2d16" opacity=".25"/>` +
        `<ellipse cx="${fx(cx)}" cy="${fx(my)}" rx="${FRW / 2 - 8}" ry="${ry}" fill="${frameCol}" stroke="${edgeCol}" stroke-width="1.6"/>` +
        `<ellipse cx="${fx(cx)}" cy="${fx(my)}" rx="${FRW / 2 - 16}" ry="${ry - 8}" fill="${mat}" stroke="#9a7348" stroke-width="1.2"/>` +
        photo(p, i, cx, my, 38, female);
      const lines = wrap(p, gone, 15, 13);
      hang += lines.map((l, k) => wallText(cx, top + 2 * ry + 22 + k * 16, l, 13.5, true, "#2b2a20")).join("");
      hang += life(p) ? wallText(cx, top + 2 * ry + 22 + lines.length * 16, life(p), 11, false, "#6b5a36") : "";
      hang += `<circle cx="${fx(cx + 40)}" cy="${fx(my + 44)}" r="13" fill="#fbf3dd" stroke="${frameCol}" stroke-width="2"/>` + sign(cx + 40, my + 44, female, sgCol, 0.8);
      hang += pill(top + FH) + `</g>`;
      return;
    }

    // a framed portrait: gold for the living, walnut for those who have passed on
    const x0 = cx - FRW / 2;
    const fy = top + 62;
    const lines = wrap(p, gone, 15, 13);
    hang += rope(cx, by, top - 1, lit);
    if (focus) hang += `<rect x="${x0 - 9}" y="${top - 8}" width="${FRW + 18}" height="${FH + 16}" rx="12" fill="url(#mglow)"/>`;
    hang +=
      `<rect x="${x0 + 3}" y="${top + 6}" width="${FRW}" height="${FH}" rx="5" fill="#3b2d16" opacity=".25"/>` +
      `<rect x="${x0}" y="${top}" width="${FRW}" height="${FH}" rx="5" fill="${frameCol}" stroke="${edgeCol}" stroke-width="1.6"/>` +
      `<rect x="${x0 + 6}" y="${top + 6}" width="${FRW - 12}" height="${FH - 12}" rx="2" fill="none" stroke="${gone ? "#9a7348" : "#ecd48e"}" stroke-width="1.4"/>` +
      `<rect x="${x0 + 10}" y="${top + 10}" width="${FRW - 20}" height="${FH - 20}" rx="2" fill="${mat}" stroke="${edgeCol}" stroke-opacity=".45" stroke-width="1"/>` +
      `<circle cx="${fx(cx)}" cy="${fy}" r="39.5" fill="none" stroke="${frameCol}" stroke-width="3.2"/>` +
      photo(p, i, cx, fy, 36, female) +
      sign(x0 + FRW - 25, top + 27, female, sgCol, 0.95) +
      lines.map((l, k) => `<text x="${fx(cx)}" y="${top + (lines.length === 1 ? 127 : 120 + k * 16)}" text-anchor="middle" font-size="${lines.length === 1 ? 14.5 : 13.5}" font-weight="700" fill="#2b2a20" ${FONT}>${esc(l)}</text>`).join("") +
      (life(p) ? `<text x="${fx(cx)}" y="${top + 152}" text-anchor="middle" font-size="11.5" fill="#6b5a36" ${FONT}>${esc(life(p))}</text>` : "");
    hang += pill(top + FH) + `</g>`;
  };

  flat.forEach((n) => {
    const people = [n.p, ...n.spouses];
    const sl = slot(n);
    const lft = X(n) - (people.length * sl) / 2 + sl / 2;
    people.forEach((p, i) => {
      const cx = lft + i * sl;
      drawPerson(p, cx, n.depth, n.plate, n.lit && i === 0, p.id === me.id);
      if (i > 0 && !n.plate) {
        // a couple: a heart of twine knotted between the two frames
        const hx = cx - sl / 2;
        const hy = rowTop(n.depth) + (n.depth === 0 ? 40 : 66);
        const heart = `M${fx(hx)} ${fx(hy + 24)} c-30 -20 -34 -40 -14 -44 c9 -2 14 4 14 11 c0 -7 5 -13 14 -11 c20 4 16 24 -14 44z`;
        hearts += `<path d="${heart}" fill="none" stroke="#6e5230" stroke-width="6.5" stroke-linejoin="round"/>`;
        hearts += `<path d="${heart}" fill="none" stroke="#c8a56c" stroke-width="4.4" stroke-linejoin="round" stroke-dasharray="6 2.5"/>`;
        hearts += `<path d="M${fx(hx - 5)} ${fx(hy + 24)} q5 8 10 0 M${fx(hx - 4)} ${fx(hy + 26)} l-4 9 M${fx(hx + 4)} ${fx(hy + 26)} l4 9" fill="none" stroke="#6e5230" stroke-width="3" stroke-linecap="round"/>`;
      }
    });
  });

  // ---------------------------------------------------------------- ground, flowers, birds, title
  let ground =
    `<path d="M0 ${G - 18} C${width * 0.2} ${G - 44}, ${width * 0.4} ${G - 8}, ${width * 0.55} ${G - 26} S${width * 0.88} ${G - 40}, ${width} ${G - 14} V${height} H0Z" fill="#c9d9a6"/>` +
    `<path d="M0 ${G + 4} C${width * 0.22} ${G - 20}, ${width * 0.45} ${G + 10}, ${width * 0.62} ${G - 4} S${width * 0.9} ${G - 14}, ${width} ${G + 2} V${height} H0Z" fill="url(#mgrass)"/>`;
  const petal = ["#e8837f", "#f3c24f", "#b684d6", "#f4a3c0", "#ffffff", "#7fb0e0"];
  for (let i = 0; i < 150; i++) {
    const x = 16 + rnd() * (width - 32);
    const y = G + 4 + rnd() * 80;
    const h = 10 + rnd() * 20;
    const lean = (rnd() - 0.5) * 12;
    ground += `<path d="M${fx(x)} ${fx(y)} q${fx(lean * 0.4)} -${fx(h * 0.6)} ${fx(lean)} -${fx(h)}" fill="none" stroke="${i % 2 ? "#5f8044" : "#79985a"}" stroke-width="1.7" stroke-linecap="round"/>`;
    if (i % 3 === 0) {
      const pc = petal[Math.floor(rnd() * petal.length)];
      const px = x + lean;
      const py = y - h;
      for (let k = 0; k < 5; k++) ground += `<circle cx="${fx(px + cs(k * 72) * 3)}" cy="${fx(py + sn(k * 72) * 3)}" r="2.3" fill="${pc}"/>`;
      ground += `<circle cx="${fx(px)}" cy="${fx(py)}" r="1.6" fill="#f3c24f"/>`;
    }
  }
  const bird = (x: number, y: number, sc: number, flip: number) =>
    `<g transform="translate(${x} ${y}) scale(${sc * flip} ${sc})" fill="#7a5a31" opacity=".9"><path d="M0 0 C10 -10 22 -10 30 -2 C24 -2 18 0 12 6 C8 8 3 6 0 0Z"/><path d="M8 -2 C14 -18 24 -22 34 -18 C26 -14 20 -8 16 0Z" fill="#a98253"/><path d="M-2 0 L-9 -3 L-3 3Z"/></g>`;
  const birds = bird(60, 200, 1, 1) + bird(width - 110, 170, 0.9, -1) + bird(width - 90, 520, 0.6, -1) + bird(70, 640, 0.55, 1);
  const title =
    `<text x="${CX}" y="98" text-anchor="middle" font-size="68" font-weight="800" fill="#8d7a22" stroke="#f6efdc" stroke-width="6" stroke-linejoin="round" paint-order="stroke" ${FONT}>हाम्रो वंशवृक्ष</text>` +
    `<path d="M${CX - 120} 116 q60 -10 120 0 q60 10 120 0" fill="none" stroke="#b49a3c" stroke-width="2.2" stroke-linecap="round"/>` +
    `<text x="${CX}" y="146" text-anchor="middle" font-size="19" fill="#7d5a1e" stroke="#f6efdc" stroke-width="4" stroke-linejoin="round" paint-order="stroke" ${FONT}>${esc(cut(nm(root), 24))} देखि तलका सन्तति</text>`;

  const dsDefs =
    `<defs><linearGradient id="mwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f0e0"/><stop offset="1" stop-color="#eadfc6"/></linearGradient>` +
    `<pattern id="mgrain" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.1" fill="#9a7d4f" opacity=".1"/><circle cx="17" cy="18" r=".9" fill="#9a7d4f" opacity=".08"/><circle cx="21" cy="6" r=".7" fill="#fff" opacity=".35"/></pattern>` +
    `<linearGradient id="mlight" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e4" stop-opacity=".7"/><stop offset="1" stop-color="#fff8e4" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="mbark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f4527"/><stop offset=".45" stop-color="#8a6a3c"/><stop offset="1" stop-color="#6e5230"/></linearGradient>` +
    `<linearGradient id="mgrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#88a95e"/><stop offset="1" stop-color="#6f9150"/></linearGradient>` +
    `<radialGradient id="mglow"><stop offset=".6" stop-color="#f6c75e" stop-opacity=".75"/><stop offset="1" stop-color="#f6c75e" stop-opacity="0"/></radialGradient>` +
    `<path id="mlf" d="M0 0 C.55 -.35 .8 -.9 0 -1.6 C-.8 -.9 -.55 -.35 0 0Z"/>` +
    `<path id="mlf2" d="M0 0 C.32 -.4 .42 -1.05 0 -1.9 C-.42 -1.05 -.32 -.4 0 0Z"/>` +
    `<g id="mbl"><circle cx="0" cy="-5" r="3.6"/><circle cx="4.8" cy="-1.5" r="3.6"/><circle cx="3" cy="4" r="3.6"/><circle cx="-3" cy="4" r="3.6"/><circle cx="-4.8" cy="-1.5" r="3.6"/><circle r="2.2" fill="#d9a23a"/></g>` +
    defs +
    `</defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(root))} देखिको वंशवृक्ष">` +
    dsDefs + s + wood + `<g>${leaves}</g>` + vines + birds + hang + hearts + ground + title +
    `</svg>`;
  return { svg, width, height, ids, frames: nFrames, plates: nPlates, root };
}
