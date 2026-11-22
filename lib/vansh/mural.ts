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
  let s = "";
  s += `<rect width="${width}" height="${height}" fill="url(#mwall)"/><rect width="${width}" height="${height}" fill="url(#mgrain)"/>`;
  s += `<polygon points="${width * 0.55},0 ${width},0 ${width},${height * 0.55}" fill="url(#mlight)"/>`;

  // ---------------------------------------------------------------- trunk (a tall tapering stem up to the top bough)
  const Y0 = (d: number) => rowTop(d) - 54;
  const topY = Y0(0) - 6;
  const H = G - topY;
  const edge = (sgn: number) => ({
    a: [CX + sgn * 58, G + 10],
    b: [CX + sgn * 34, G - 0.2 * H],
    c: [CX + sgn * 19, G - 0.58 * H],
    d: [CX + sgn * 11, topY],
  });
  const L = edge(-1);
  const Rr = edge(1);
  const f = (v: number[]) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`;
  s += `<path d="M${f(L.a)} C${f(L.b)}, ${f(L.c)}, ${f(L.d)} L${f(Rr.d)} C${f(Rr.c)}, ${f(Rr.b)}, ${f(Rr.a)} Z" fill="url(#mbark)" stroke="#4a361d" stroke-width="1.6"/>`;
  for (let k = 1; k < 10; k++) {
    const u = k / 10;
    const mix = (a: number[], b: number[]) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    const wob = (rnd() - 0.5) * 6;
    s += `<path d="M${f(mix(L.a, Rr.a))} C${f([mix(L.b, Rr.b)[0] + wob, mix(L.b, Rr.b)[1]])}, ${f([mix(L.c, Rr.c)[0] - wob, mix(L.c, Rr.c)[1]])}, ${f(mix(L.d, Rr.d))}" fill="none" stroke="#4a361d" stroke-width="${(1 + rnd() * 1.5).toFixed(1)}" stroke-linecap="round" opacity=".34"/>`;
  }
  // roots spreading into the grass
  [[-1, 170, 22], [1, 190, 26], [-1, 110, 14], [1, 120, 16]].forEach(([sg, len, drop]) => {
    s += `<path d="M${CX + sg * 40} ${G - 6} C${CX + sg * 70} ${G + 6}, ${CX + sg * (len * 0.6)} ${G + drop * 0.4}, ${CX + sg * len} ${G + drop}" fill="none" stroke="#6e5230" stroke-width="13" stroke-linecap="round"/>`;
    s += `<path d="M${CX + sg * 40} ${G - 8} C${CX + sg * 70} ${G + 2}, ${CX + sg * (len * 0.6)} ${G + drop * 0.3}, ${CX + sg * len} ${G + drop - 3}" fill="none" stroke="#a98253" stroke-width="3" stroke-linecap="round" opacity=".6"/>`;
  });

  // ---------------------------------------------------------------- boughs, one per generation row
  const span = (d: number) => {
    const xs = flat.filter((n) => n.depth === d).flatMap((n) => {
      const c = X(n);
      return [c - (1 + n.spouses.length) * slot(n) / 2, c + (1 + n.spouses.length) * slot(n) / 2];
    });
    return Math.min(width / 2 - 26, Math.max(...xs.map((x) => Math.abs(x - CX))) + 70);
  };
  const A = 44;
  const bough = (d: number, x: number) => {
    const t = Math.min(1, Math.abs(x - CX) / span(d));
    return Y0(d) - A * Math.pow(t, 1.6);
  };
  let wood = "";
  let leaves = "";
  const leaf = (x: number, y: number, rot: number, size: number, col: string, op = 0.9) =>
    `<path d="M0 0 C${size * 0.55} -${size * 0.35}, ${size * 0.8} -${size * 0.9}, 0 -${size * 1.6} C-${size * 0.8} -${size * 0.9}, -${size * 0.55} -${size * 0.35}, 0 0Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})" fill="${col}" opacity="${op}"/>`;
  const bloom = ["#f0c4c9", "#f6dc9a", "#fbeed2"];
  const blossom = (x: number, y: number) => {
    let b = "";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rnd();
      b += `<circle cx="${(x + Math.cos(a) * 5).toFixed(1)}" cy="${(y + Math.sin(a) * 5).toFixed(1)}" r="3.4" fill="${bloom[Math.floor(rnd() * 3)]}"/>`;
    }
    return b + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#c58a2c"/>`;
  };
  for (let d = 0; d <= maxDepth; d++) {
    const Hs = span(d);
    const base = 11 + d * 2.6;
    for (const side of [-1, 1]) {
      let prev: [number, number] | null = null;
      for (let i = 0; i <= 22; i++) {
        const t = i / 22;
        const x = CX + side * Hs * t;
        const y = Y0(d) - A * Math.pow(t, 1.6);
        if (prev) {
          const w = base + (2.4 - base) * Math.pow(t, 0.75);
          wood += `<line x1="${prev[0].toFixed(1)}" y1="${(prev[1] + 2).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 2).toFixed(1)}" stroke="#3b2d16" stroke-opacity=".18" stroke-width="${(w + 2).toFixed(1)}" stroke-linecap="round"/>`;
          wood += `<line x1="${prev[0].toFixed(1)}" y1="${prev[1].toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#7a5a31" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
          wood += `<line x1="${prev[0].toFixed(1)}" y1="${(prev[1] - w * 0.2).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - w * 0.2).toFixed(1)}" stroke="#b9935e" stroke-width="${Math.max(1, w * 0.26).toFixed(1)}" stroke-linecap="round" opacity=".55"/>`;
        }
        prev = [x, y];
        if (i >= 1) {
          // leaves above the bough, a twig with a blossom now and then
          const out = side * 28;
          leaves += leaf(x, y - 2, -90 + out + (rnd() - 0.5) * 50, 11 + rnd() * 8, GREENS[Math.floor(rnd() * GREENS.length)]);
          leaves += leaf(x, y - 2, -90 - out * 0.4 + (rnd() - 0.5) * 60, 10 + rnd() * 7, GREENS[Math.floor(rnd() * GREENS.length)], 0.85);
          leaves += leaf(x, y + 1, 90 + out + (rnd() - 0.5) * 40, 8 + rnd() * 5, GREENS[Math.floor(rnd() * GREENS.length)], 0.8);
          if (i % 4 === 1) {
            const tx = x + side * 16;
            const ty = y - 36 - rnd() * 14;
            wood += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + side * 4).toFixed(1)} ${(y - 22).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="#7a5a31" stroke-width="2.6" stroke-linecap="round"/>`;
            for (let j = 0; j < 3; j++) leaves += leaf(tx - side * j * 3, ty + j * 8, -90 + side * (20 + j * 24), 10 + rnd() * 5, GREENS[Math.floor(rnd() * GREENS.length)]);
            leaves += blossom(tx + side * 3, ty - 6);
          }
        }
      }
    }
  }
  // the crown: twigs fanning out above the top bough, leaving the title clear
  for (let k = 0; k < 7; k++) {
    const side = k % 2 ? 1 : -1;
    const reach = 50 + Math.floor(k / 2) * 62 + rnd() * 20;
    const tx = CX + side * reach;
    const ty = Y0(0) - 62 - rnd() * 24 + Math.floor(k / 2) * 6;
    wood += `<path d="M${CX} ${topY + 12} C${CX + side * reach * 0.2} ${topY - 22}, ${CX + side * reach * 0.8} ${ty + 24}, ${tx.toFixed(1)} ${ty.toFixed(1)}" fill="none" stroke="#7a5a31" stroke-width="${(6 - k * 0.4).toFixed(1)}" stroke-linecap="round"/>`;
    for (let j = 0; j < 7; j++) {
      const u = 0.25 + j * 0.11;
      const lx = CX + side * reach * u;
      const ly = topY + 12 + (ty - topY - 12) * Math.pow(u, 1.2);
      leaves += leaf(lx, ly, -90 + side * (30 + rnd() * 40), 11 + rnd() * 8, GREENS[Math.floor(rnd() * GREENS.length)]);
      leaves += leaf(lx, ly, -90 - side * (10 + rnd() * 30), 10 + rnd() * 7, GREENS[Math.floor(rnd() * GREENS.length)], 0.85);
    }
    leaves += blossom(tx, ty - 6);
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
    const d = `M${x1.toFixed(1)} ${y1} C${x1.toFixed(1)} ${(y1 + (y2 - y1) * 0.6).toFixed(1)}, ${tx.toFixed(1)} ${(y1 + (y2 - y1) * 0.4).toFixed(1)}, ${tx.toFixed(1)} ${y2.toFixed(1)}`;
    const col = n.lit ? "#d98a1e" : "#7a5a31";
    vines += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n.lit ? 4.2 : 3.2}" stroke-linecap="round"/>`;
    const my = (y1 + y2) / 2;
    vines += leaf((x1 + tx) / 2, my, 55, 11, n.lit ? "#f0b43e" : "#6f9150") + leaf((x1 + tx) / 2, my, -55, 9, n.lit ? "#f6cf6f" : "#8fae63");
  });

  // ---------------------------------------------------------------- frames, plates, ropes
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
    `<path d="M${x.toFixed(1)} ${y1.toFixed(1)} L${x.toFixed(1)} ${y2.toFixed(1)}" stroke="${lit ? "#b8741a" : "#9a7648"}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 0"/>` +
    `<path d="M${x.toFixed(1)} ${y1.toFixed(1)} L${x.toFixed(1)} ${y2.toFixed(1)}" stroke="#d8bd8a" stroke-width="1" stroke-linecap="round" stroke-dasharray="3 3" opacity=".8"/>` +
    `<circle cx="${x.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.6" fill="#6e5230"/>`;

  const wrap = (p: VPerson, gone: boolean, n1: number, n2: number): string[] => {
    const full = (gone ? "स्व. " : "") + nm(p).trim();
    if (Array.from(full).length <= n1) return [full];
    const w = full.split(/\s+/);
    if (w.length < 2) return [cut(full, n1)];
    return [cut(w.slice(0, -1).join(" "), n1), cut(w[w.length - 1], n2)];
  };
  const drawPerson = (p: VPerson, cx: number, d: number, plate: boolean, lit: boolean, focus: boolean) => {
    const i = idx++;
    ids.push(p.id);
    const gone = p.is_living === false;
    const female = p.gender === "F";
    const top = rowTop(d);
    const by = bough(d, cx);
    const frameCol = gone ? "#6e4b2a" : "#c9a14a";
    const edgeCol = gone ? "#3f2a15" : "#8a6a24";
    const lines = plate ? wrap(p, gone, 9, 9) : wrap(p, gone, 15, 13);
    if (plate) {
      nPlates++;
      const x0 = cx - PLW / 2;
      hang += `<g data-p="${esc(p.id)}" data-tier="plate">` + rope(cx, by, top + 2, lit);
      hang += `<rect x="${x0 + 2}" y="${top + 5}" width="${PLW}" height="${PLH}" rx="9" fill="#3b2d16" opacity=".22"/>`;
      hang += `<rect x="${x0}" y="${top + 2}" width="${PLW}" height="${PLH}" rx="9" fill="${female ? "#f7e6e1" : "#f4ead2"}" stroke="${frameCol}" stroke-width="3"/>`;
      hang += sign(x0 + 14, top + 2 + PLH / 2, female, female ? "#a4506a" : "#44563a", 0.9);
      const tx = x0 + 28 + (PLW - 32) / 2;
      lines.forEach((l, k) => (hang += `<text x="${tx}" y="${top + 2 + PLH / 2 + (lines.length === 1 ? 5 : k === 0 ? -1 : 14)}" text-anchor="middle" font-size="${lines.length === 1 ? 13 : 12.5}" font-weight="700" fill="#2b2a20" ${FONT}>${esc(l)}</text>`));
      hang += `</g>`;
      return;
    }
    nFrames++;
    const x0 = cx - FRW / 2;
    const mat = gone ? "#efe6d3" : female ? "#f7e6e1" : "#f4ead2";
    let face: string;
    const fy = top + 62;
    if (p.photo_url && !p.is_locked) {
      defs += `<clipPath id="mf${i}"><circle cx="${cx}" cy="${fy}" r="36"/></clipPath>`;
      face = `<image href="${esc(p.photo_url)}" x="${cx - 36}" y="${fy - 36}" width="72" height="72" preserveAspectRatio="xMidYMid slice" clip-path="url(#mf${i})"/>`;
    } else {
      face = `<circle cx="${cx}" cy="${fy}" r="36" fill="${female ? "#a4506a" : "#44563a"}"/><text x="${cx}" y="${fy + 13}" text-anchor="middle" font-size="38" font-weight="700" fill="#fff" ${FONT}>${esc(Array.from(nm(p).trim())[0] || "•")}</text>`;
    }
    hang += `<g data-p="${esc(p.id)}" data-tier="frame">` + rope(cx, by, top - 1, lit);
    if (focus) hang += `<rect x="${x0 - 9}" y="${top - 8}" width="${FRW + 18}" height="${FH + 16}" rx="12" fill="url(#mglow)"/>`;
    hang +=
      `<rect x="${x0 + 3}" y="${top + 6}" width="${FRW}" height="${FH}" rx="5" fill="#3b2d16" opacity=".25"/>` +
      `<rect x="${x0}" y="${top}" width="${FRW}" height="${FH}" rx="5" fill="${frameCol}" stroke="${edgeCol}" stroke-width="1.6"/>` +
      `<rect x="${x0 + 6}" y="${top + 6}" width="${FRW - 12}" height="${FH - 12}" rx="2" fill="none" stroke="${gone ? "#9a7348" : "#ecd48e"}" stroke-width="1.4"/>` +
      `<rect x="${x0 + 10}" y="${top + 10}" width="${FRW - 20}" height="${FH - 20}" rx="2" fill="${mat}" stroke="${edgeCol}" stroke-opacity=".45" stroke-width="1"/>` +
      `<circle cx="${cx}" cy="${fy}" r="39.5" fill="none" stroke="${frameCol}" stroke-width="3.2"/>` +
      face +
      sign(x0 + FRW - 25, top + 27, female, female ? "#a4506a" : "#44563a", 0.95) +
      lines.map((l, k) => `<text x="${cx}" y="${top + (lines.length === 1 ? 127 : 120 + k * 16)}" text-anchor="middle" font-size="${lines.length === 1 ? 14.5 : 13.5}" font-weight="700" fill="#2b2a20" ${FONT}>${esc(l)}</text>`).join("") +
      (life(p) ? `<text x="${cx}" y="${top + 152}" text-anchor="middle" font-size="11.5" fill="#6b5a36" ${FONT}>${esc(life(p))}</text>` : "");
    if (focus) hang += `<g transform="translate(${cx} ${top + FH})"><rect x="-27" y="-10" width="54" height="21" rx="10.5" fill="#d98a1e" stroke="#fffdf8" stroke-width="1.6"/><text y="4.5" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff" ${FONT}>तपाईं</text></g>`;
    hang += `</g>`;
  };

  flat.forEach((n) => {
    const people = [n.p, ...n.spouses];
    const sl = slot(n);
    const left = X(n) - (people.length * sl) / 2 + sl / 2;
    people.forEach((p, i) => {
      const cx = left + i * sl;
      drawPerson(p, cx, n.depth, n.plate, n.lit && i === 0, p.id === me.id);
      if (i > 0 && !n.plate) {
        const hx = cx - sl / 2;
        const hy = rowTop(n.depth) + 74;
        hearts += `<path d="M${(hx - 3).toFixed(1)} ${hy} h6" stroke="#9a7648" stroke-width="3"/>`;
        hearts += `<path d="M${hx.toFixed(1)} ${hy + 10} c-13 -10 -15 -23 -6 -25 c4 -1 6 2 6 5 c0 -3 2 -6 6 -5 c9 2 7 15 -6 25z" fill="#c4475f" stroke="#fffdf8" stroke-width="2.2" paint-order="stroke"/>`;
      }
    });
  });

  // ---------------------------------------------------------------- ground, flowers, birds, title
  let ground =
    `<path d="M0 ${G - 18} C${width * 0.2} ${G - 44}, ${width * 0.4} ${G - 8}, ${width * 0.55} ${G - 26} S${width * 0.88} ${G - 40}, ${width} ${G - 14} V${height} H0Z" fill="#c9d9a6"/>` +
    `<path d="M0 ${G + 4} C${width * 0.22} ${G - 20}, ${width * 0.45} ${G + 10}, ${width * 0.62} ${G - 4} S${width * 0.9} ${G - 14}, ${width} ${G + 2} V${height} H0Z" fill="url(#mgrass)"/>`;
  const petal = ["#e8837f", "#f3c24f", "#b684d6", "#f4a3c0", "#ffffff", "#7fb0e0"];
  for (let i = 0; i < 70; i++) {
    const x = 20 + rnd() * (width - 40);
    if (Math.abs(x - CX) < 50) continue;
    const y = G + 6 + rnd() * 70;
    const h = 8 + rnd() * 16;
    ground += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(rnd() - 0.5) * 8} -${(h * 0.6).toFixed(1)} 0 -${h.toFixed(1)}" fill="none" stroke="#5f8044" stroke-width="1.6" stroke-linecap="round"/>`;
    if (i % 3 === 0) ground += `<circle cx="${x.toFixed(1)}" cy="${(y - h).toFixed(1)}" r="${(2.4 + rnd() * 2).toFixed(1)}" fill="${petal[Math.floor(rnd() * petal.length)]}"/>`;
  }
  const bird = (x: number, y: number, sc: number, flip: number) =>
    `<g transform="translate(${x} ${y}) scale(${sc * flip} ${sc})" fill="#7a5a31" opacity=".9"><path d="M0 0 C10 -10 22 -10 30 -2 C24 -2 18 0 12 6 C8 8 3 6 0 0Z"/><path d="M8 -2 C14 -18 24 -22 34 -18 C26 -14 20 -8 16 0Z" fill="#a98253"/><path d="M-2 0 L-9 -3 L-3 3Z"/></g>`;
  const birds = bird(60, 200, 1, 1) + bird(width - 110, 170, 0.9, -1) + bird(width - 90, 520, 0.6, -1);
  const title =
    `<text x="${CX}" y="98" text-anchor="middle" font-size="68" font-weight="800" fill="#8b6914" stroke="#f4ecdc" stroke-width="6" stroke-linejoin="round" paint-order="stroke" ${FONT}>हाम्रो वंशवृक्ष</text>` +
    `<text x="${CX}" y="138" text-anchor="middle" font-size="19" fill="#7d5a1e" stroke="#f4ecdc" stroke-width="4" stroke-linejoin="round" paint-order="stroke" ${FONT}>${esc(cut(nm(root), 24))} देखि तलका सन्तति</text>`;

  const dsDefs =
    `<defs><linearGradient id="mwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f0e0"/><stop offset="1" stop-color="#eadfc6"/></linearGradient>` +
    `<pattern id="mgrain" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="1.1" fill="#9a7d4f" opacity=".1"/><circle cx="17" cy="18" r=".9" fill="#9a7d4f" opacity=".08"/><circle cx="21" cy="6" r=".7" fill="#fff" opacity=".35"/></pattern>` +
    `<linearGradient id="mlight" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e4" stop-opacity=".7"/><stop offset="1" stop-color="#fff8e4" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="mbark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f4527"/><stop offset=".45" stop-color="#8a6a3c"/><stop offset="1" stop-color="#6e5230"/></linearGradient>` +
    `<linearGradient id="mgrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#88a95e"/><stop offset="1" stop-color="#6f9150"/></linearGradient>` +
    `<radialGradient id="mglow"><stop offset=".6" stop-color="#f6c75e" stop-opacity=".75"/><stop offset="1" stop-color="#f6c75e" stop-opacity="0"/></radialGradient>` +
    defs +
    `</defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(root))} देखिको वंशवृक्ष">` +
    dsDefs + s + wood + `<g>${leaves}</g>` + vines + birds + hang + hearts + ground + title +
    `</svg>`;
  return { svg, width, height, ids, frames: nFrames, plates: nPlates, root };
}
