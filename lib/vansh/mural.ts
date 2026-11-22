// Royal family chart for the printed life-sheet: the family of the grandfather, generation by generation, on cream paper.
// Every person sits in an ornate gold frame (bronze when deceased) with a name band; couples are joined by a heart seal;
// gold curves run from each family down to its children.
// Rules for who is drawn (see the family's own words):
//   • sons of the house keep their whole family (wife and children), generation after generation;
//   • a daughter is drawn alone: her photo, name and a gender sign — not her husband or children;
//   • in a very big family the children of the brothers shrink to a small plate with name and gender sign only —
//     except the viewer's own line (the road down to them, their spouse and children), which always keeps its frames.
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { descendantsRoot } from "./descendants";
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
const TOP0 = 200;
const PAD = 64;
const MAXD = 3; // root + three generations
const FONT = 'font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, serif"';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);

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
  const natural = TOP0 + maxDepth * ROWH + FH + 110;
  const rowH = ROWH + Math.max(0, Math.min(150, (width * 1.28 - natural) / Math.max(1, maxDepth)));
  const rowTop = (d: number) => TOP0 + d * rowH;
  const lastBottom = rowTop(maxDepth) + FH;
  const G = lastBottom + 60;
  const height = G + 50;

  // ---------------------------------------------------------------- paper, border, title
  const fx = (v: number) => v.toFixed(1);
  const GOLD = "url(#mgold)";
  const BRONZE = "url(#mbronze)";
  let defs = "";
  let hang = "";
  let seals = "";
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
    return `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${r}" fill="${female ? "url(#mrose)" : "url(#mpine)"}"/><text x="${fx(cx)}" y="${fx(cy + r * 0.36)}" text-anchor="middle" font-size="${Math.round(r * 1.05)}" font-weight="700" fill="#fdf3d2" ${FONT}>${esc(Array.from(nm(p).trim())[0] || "•")}</text>`;
  };
  // a small ornament in each corner of a frame
  const corners = (x0: number, y0: number, w: number, h: number, col: string) =>
    [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]]
      .map(([x, y, sx, sy]) => `<path d="M${fx(x + sx * 3)} ${fx(y + sy * 14)} q0 -11 11 -11 M${fx(x + sx * 7)} ${fx(y + sy * 7)} l${sx * 3} ${sy * 3}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${fx(x + sx * 5)}" cy="${fx(y + sy * 5)}" r="2.3" fill="${col}"/>`)
      .join("");

  const drawPerson = (p: VPerson, cx: number, d: number, plate: boolean, lit: boolean, focus: boolean) => {
    const i = idx++;
    ids.push(p.id);
    const gone = p.is_living === false;
    const female = p.gender === "F";
    const top = rowTop(d);
    const metal = gone ? BRONZE : GOLD;
    const edge = gone ? "#3a2412" : "#7a5412";
    const bandFill = gone ? "url(#mwine)" : "url(#memer)";
    const ink = gone ? "#f3e2c0" : "#f6e6ab";
    const sgCol = "#e9c768";
    const pill = (y: number) =>
      focus ? `<g transform="translate(${fx(cx)} ${fx(y)})"><rect x="-27" y="-10" width="54" height="21" rx="10.5" fill="url(#mgold)" stroke="#fffdf8" stroke-width="1.6"/><text y="4.5" text-anchor="middle" font-size="12.5" font-weight="700" fill="#3a2a08" ${FONT}>तपाईं</text></g>` : "";

    if (plate) {
      nPlates++;
      const lines = wrap(p, gone, 9, 9);
      const x0 = cx - PLW / 2;
      hang += `<g data-p="${esc(p.id)}" data-tier="plate">`;
      hang += `<rect x="${x0 + 2}" y="${top + 5}" width="${PLW}" height="${PLH}" rx="8" fill="#3b2d16" opacity=".22"/>`;
      hang += `<rect x="${x0}" y="${top + 2}" width="${PLW}" height="${PLH}" rx="8" fill="${metal}" stroke="${edge}" stroke-width="1.2"/>`;
      hang += `<rect x="${x0 + 4}" y="${top + 6}" width="${PLW - 8}" height="${PLH - 8}" rx="5" fill="${bandFill}" stroke="#f3dc8f" stroke-opacity=".7" stroke-width=".9"/>`;
      hang += sign(x0 + 17, top + 2 + PLH / 2, female, sgCol, 0.85);
      const tx = x0 + 32 + (PLW - 38) / 2;
      lines.forEach((l, k) => (hang += `<text x="${fx(tx)}" y="${top + 2 + PLH / 2 + (lines.length === 1 ? 5 : k === 0 ? -1 : 14)}" text-anchor="middle" font-size="${lines.length === 1 ? 13 : 12.5}" font-weight="700" fill="${ink}" ${FONT}>${esc(l)}</text>`));
      hang += `</g>`;
      return;
    }
    nFrames++;
    hang += `<g data-p="${esc(p.id)}" data-tier="frame">`;

    if (d === 0) {
      // the founder: a crowned round medallion with a name band
      const r = 46;
      const my = top + 54;
      if (focus) hang += `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r + 18}" fill="url(#mglow)"/>`;
      hang +=
        `<path d="M${fx(cx - 16)} ${fx(my - r - 2)} l-3 -17 l9 8 l10 -13 l10 13 l9 -8 l-3 17z" fill="${metal}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<circle cx="${fx(cx + 2)}" cy="${fx(my + 4)}" r="${r + 4}" fill="#3b2d16" opacity=".25"/>` +
        `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r + 4}" fill="${metal}" stroke="${edge}" stroke-width="1.4"/>` +
        `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r - 3}" fill="none" stroke="#fff3c4" stroke-opacity=".8" stroke-width="1.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>` +
        `<circle cx="${fx(cx)}" cy="${fx(my)}" r="${r - 7}" fill="#fbf3dd" stroke="${edge}" stroke-width="1"/>` +
        photo(p, i, cx, my, r - 10, female);
      const lines = wrap(p, gone, 17, 14);
      const ny = top + 108;
      const nh = 14 + lines.length * 16 + (life(p) ? 16 : 0);
      hang +=
        `<rect x="${fx(cx - 62)}" y="${ny + 3}" width="124" height="${nh}" rx="7" fill="#3b2d16" opacity=".25"/>` +
        `<rect x="${fx(cx - 62)}" y="${ny}" width="124" height="${nh}" rx="7" fill="${metal}" stroke="${edge}" stroke-width="1.2"/>` +
        `<rect x="${fx(cx - 58)}" y="${ny + 4}" width="116" height="${nh - 8}" rx="4" fill="${bandFill}"/>` +
        sign(cx - 47, ny + 7 + 9, female, sgCol, 0.75) +
        lines.map((l, k) => `<text x="${fx(cx + 6)}" y="${ny + 18 + k * 16}" text-anchor="middle" font-size="${lines.length === 1 ? 14.5 : 13.5}" font-weight="700" fill="${ink}" ${FONT}>${esc(l)}</text>`).join("") +
        (life(p) ? `<text x="${fx(cx)}" y="${ny + 18 + lines.length * 16}" text-anchor="middle" font-size="11" fill="#e8d9b0" ${FONT}>${esc(life(p))}</text>` : "");
      hang += pill(ny + nh + 2) + `</g>`;
      return;
    }

    // a royal portrait frame: gold (bronze for those who have passed on), emerald (wine) name band
    const x0 = cx - FRW / 2;
    const fy = top + 56;
    const lines = wrap(p, gone, 15, 13);
    if (focus) hang += `<rect x="${x0 - 9}" y="${top - 8}" width="${FRW + 18}" height="${FH + 16}" rx="12" fill="url(#mglow)"/>`;
    hang +=
      `<rect x="${x0 + 3}" y="${top + 6}" width="${FRW}" height="${FH}" rx="6" fill="#3b2d16" opacity=".26"/>` +
      `<rect x="${x0}" y="${top}" width="${FRW}" height="${FH}" rx="6" fill="${metal}" stroke="${edge}" stroke-width="1.6"/>` +
      `<rect x="${x0 + 5}" y="${top + 5}" width="${FRW - 10}" height="${FH - 10}" rx="3" fill="none" stroke="#fff1bd" stroke-opacity=".85" stroke-width="1.1"/>` +
      `<rect x="${x0 + 8}" y="${top + 8}" width="${FRW - 16}" height="${FH - 16}" rx="2" fill="#fbf3dd" stroke="${edge}" stroke-width="1.1"/>` +
      corners(x0 + 8, top + 8, FRW - 16, FH - 16, gone ? "#a9783a" : "#b8862a") +
      `<circle cx="${fx(cx)}" cy="${fy}" r="39" fill="${metal}" stroke="${edge}" stroke-width="1.2"/>` +
      `<circle cx="${fx(cx)}" cy="${fy}" r="35.5" fill="#fbf3dd"/>` +
      photo(p, i, cx, fy, 33, female) +
      `<rect x="${x0 + 8}" y="${top + 100}" width="${FRW - 16}" height="${FH - 108}" rx="2" fill="${bandFill}" stroke="${edge}" stroke-width="1"/>` +
      `<path d="M${x0 + 12} ${top + 103.5} H${x0 + FRW - 12}" stroke="#f3dc8f" stroke-opacity=".8" stroke-width=".9"/>` +
      sign(x0 + 21, top + 21, female, gone ? "#8a5a22" : "#8a6414", 0.8) +
      lines.map((l, k) => `<text x="${fx(cx)}" y="${top + (lines.length === 1 ? 126 : 121 + k * 16)}" text-anchor="middle" font-size="${lines.length === 1 ? 14.5 : 13.5}" font-weight="700" fill="${ink}" ${FONT}>${esc(l)}</text>`).join("") +
      (life(p) ? `<text x="${fx(cx)}" y="${top + 154}" text-anchor="middle" font-size="11" fill="#e8d9b0" ${FONT}>${esc(life(p))}</text>` : "");
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
        // a couple: a gold seal with a heart between the two frames
        const hx = cx - sl / 2;
        const hy = rowTop(n.depth) + (n.depth === 0 ? 54 : 56);
        seals +=
          `<circle cx="${fx(hx)}" cy="${fx(hy)}" r="13" fill="url(#mgold)" stroke="#7a5412" stroke-width="1.3"/>` +
          `<path d="M${fx(hx)} ${fx(hy + 7)} c-9 -6 -10 -12 -4 -13 c2.5 -.4 4 1.2 4 3.2 c0 -2 1.5 -3.6 4 -3.2 c6 1 5 7 -4 13z" fill="#a8243c" stroke="#fff1bd" stroke-width=".9"/>`;
      }
    });
  });

  // ---------------------------------------------------------------- curved connectors: from each family down to its children
  let lines = "";
  const ink0 = (lit: boolean) => (lit ? "#d98a1e" : "#b8923f");
  flat.forEach((n) => {
    if (!n.kids.length) return;
    const x1 = X(n);
    const y1 = rowTop(n.depth) + (n.plate ? PLH + 2 : FH) + (n.lit && !n.plate ? 14 : 0);
    n.kids.forEach((k) => {
      const kx = X(k);
      const y2 = rowTop(k.depth) - 4;
      const ym = y1 + (y2 - y1) * 0.55;
      const d = `M${fx(x1)} ${fx(y1)} C${fx(x1)} ${fx(ym)}, ${fx(kx)} ${fx(y1 + (y2 - y1) * 0.45)}, ${fx(kx)} ${fx(y2)}`;
      const hot = n.lit && k.lit;
      lines += `<path d="${d}" fill="none" stroke="#3b2d16" stroke-opacity=".14" stroke-width="${hot ? 6 : 4.6}" stroke-linecap="round" transform="translate(1.5 2.5)"/>`;
      lines += `<path d="${d}" fill="none" stroke="${ink0(hot)}" stroke-width="${hot ? 3.6 : 2.6}" stroke-linecap="round"/>`;
      lines += `<path d="${d}" fill="none" stroke="#fff3c4" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round" stroke-dasharray="1 5"/>`;
      lines += `<path d="M${fx(kx)} ${fx(y2 + 1)} l-4.5 -7 h9z" fill="${ink0(hot)}"/>`;
    });
    lines += `<path d="M${fx(x1)} ${fx(y1 - 6)} l6 6 l-6 6 l-6 -6z" fill="url(#mgold)" stroke="#7a5412" stroke-width="1"/>`;
  });

  // ---------------------------------------------------------------- title, border
  const title =
    `<text x="${CX}" y="82" text-anchor="middle" font-size="62" font-weight="800" fill="#a67c1a" stroke="#6b4a10" stroke-width="1.1" stroke-linejoin="round" ${FONT}>हाम्रो वंशवृक्ष</text>` +
    `<path d="M${CX - 150} 106 H${CX - 18} M${CX + 18} 106 H${CX + 150}" stroke="#b58a42" stroke-width="1.6"/>` +
    `<path d="M${CX} 97 l9 9 l-9 9 l-9 -9z" fill="url(#mgold)" stroke="#7a5412" stroke-width="1"/>` +
    `<circle cx="${CX - 160}" cy="106" r="3" fill="#b58a42"/><circle cx="${CX + 160}" cy="106" r="3" fill="#b58a42"/>` +
    `<text x="${CX}" y="140" text-anchor="middle" font-size="19" fill="#6e4f14" ${FONT}>${esc(cut(nm(root), 24))} देखि तलका सन्तति</text>`;
  const b1 = 14;
  const b2 = 24;
  const border =
    `<rect x="${b1}" y="${b1}" width="${width - 2 * b1}" height="${height - 2 * b1}" rx="18" fill="none" stroke="url(#mgold)" stroke-width="3.2"/>` +
    `<rect x="${b2}" y="${b2}" width="${width - 2 * b2}" height="${height - 2 * b2}" rx="12" fill="none" stroke="#b58a42" stroke-width="1" opacity=".7"/>` +
    [[b2, b2, 1, 1], [width - b2, b2, -1, 1], [b2, height - b2, 1, -1], [width - b2, height - b2, -1, -1]]
      .map(([x, y, sx, sy]) => `<path d="M${x + sx * 4} ${y + sy * 46} q0 -42 42 -42 M${x + sx * 12} ${y + sy * 30} q0 -18 18 -18" fill="none" stroke="#b58a42" stroke-width="1.6" stroke-linecap="round"/><path d="M${x + sx * 4} ${y + sy * 4} l${sx * 7} ${sy * 7} l${sx * -7} ${sy * 7} l${sx * -7} ${sy * -7}z" fill="url(#mgold)" stroke="#7a5412" stroke-width=".9"/>`)
      .join("");

  const dsDefs =
    `<defs><linearGradient id="mwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf5e6"/><stop offset="1" stop-color="#efe4c9"/></linearGradient>` +
    `<pattern id="mdam" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M17 3 l7 14 l-7 14 l-7 -14z" fill="none" stroke="#b58a42" stroke-opacity=".13" stroke-width="1"/><circle cx="0" cy="0" r="2" fill="#b58a42" opacity=".12"/><circle cx="34" cy="34" r="2" fill="#b58a42" opacity=".12"/></pattern>` +
    `<radialGradient id="mvig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#c9a45c" stop-opacity=".22"/></radialGradient>` +
    `<linearGradient id="mgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e39a"/><stop offset=".3" stop-color="#d6a73c"/><stop offset=".55" stop-color="#f1d77f"/><stop offset=".8" stop-color="#b98a2b"/><stop offset="1" stop-color="#e7c565"/></linearGradient>` +
    `<linearGradient id="mbronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b98a52"/><stop offset=".35" stop-color="#7a5230"/><stop offset=".6" stop-color="#a77a47"/><stop offset="1" stop-color="#5c3d22"/></linearGradient>` +
    `<linearGradient id="memer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f4a35"/><stop offset="1" stop-color="#1c3022"/></linearGradient>` +
    `<linearGradient id="mwine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c2430"/><stop offset="1" stop-color="#3a141d"/></linearGradient>` +
    `<linearGradient id="mpine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f6a45"/><stop offset="1" stop-color="#2f4a35"/></linearGradient>` +
    `<linearGradient id="mrose" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c0678a"/><stop offset="1" stop-color="#8f3f5f"/></linearGradient>` +
    `<radialGradient id="mglow"><stop offset=".6" stop-color="#f6c75e" stop-opacity=".75"/><stop offset="1" stop-color="#f6c75e" stop-opacity="0"/></radialGradient>` +
    defs +
    `</defs>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(root))} देखिको वंशवृक्ष">` +
    dsDefs +
    `<rect width="${width}" height="${height}" fill="url(#mwall)"/><rect width="${width}" height="${height}" fill="url(#mdam)"/><rect width="${width}" height="${height}" fill="url(#mvig)"/>` +
    border + title + lines + hang + seals +
    `</svg>`;
  return { svg, width, height, ids, frames: nFrames, plates: nPlates, root };
}
