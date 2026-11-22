// "तपाईंको वृक्ष": the home-hero picture of a member's own family drawn as a real tree.
//   जरा  (roots)    = grandparents, set in the soil
//   काण्ड (trunk)   = parents, on the bark
//   हाँगा (boughs)  = the person, siblings and spouse
//   पात  (foliage)  = children, on the highest twigs
// Pure string SVG (no DOM), deterministic for one person so the leaves do not jump between renders.
import type { Graph } from "./graph";
import type { VPerson } from "./types";

export interface TreeArt {
  svg: string;
  width: number;
  height: number;
  moreSibs: number;
  moreKids: number;
}

export interface TreeArtOpts {
  maxSibs?: number;
  maxKids?: number;
  nm?: (p: VPerson) => string;
}

const W = 520;
const H = 660;
const CX = W / 2;
const GROUND = 520;
const FONT = 'font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, serif"';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);

export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GREENS = ["#4f6f3a", "#5f8044", "#6f9150", "#7f9f5a", "#93ad63", "#a9c07a"];

export function treeArtSvg(g: Graph, me: VPerson, o: TreeArtOpts = {}): TreeArt {
  const rnd = rng(me.id);
  const nm = (p: VPerson) => (o.nm ? o.nm(p) : p.name);
  const at = (id?: string | null) => (id ? g.byId[id] : undefined);
  const father = at(me.father_id);
  const mother = at(me.mother_id);
  const sibsAll = g.sibsOf(me).filter((s) => s.id !== me.id).sort(g.byBirth);
  const sibs = sibsAll.slice(0, o.maxSibs ?? 3);
  const spouse = g.spousesOf(me).map((id) => g.byId[id]).filter(Boolean)[0] as VPerson | undefined;
  const kidsAll = g.kidsOf(me).slice().sort(g.byBirth);
  const kids = kidsAll.slice(0, o.maxKids ?? 4);

  let defs = "";
  let idx = 0;

  // ---------------------------------------------------------------- positions
  const meP = { x: CX, y: 214, r: 35 };
  const sibSlots = [
    { x: CX - 132, y: 300 },
    { x: CX + 132, y: 300 },
    { x: CX - 208, y: 196 },
  ];
  const sibP = sibs.map((p, i) => ({ p, ...sibSlots[i], r: 26 }));
  const spP = spouse ? { p: spouse, x: CX + 96, y: 196, r: 26 } : null;
  const kidMid = CX + (spP ? 48 : 0);
  const kidGap = kids.length > 1 ? Math.min(92, 300 / (kids.length - 1)) : 0;
  const kidP = kids.map((p, i) => ({ p, x: kidMid + (i - (kids.length - 1) / 2) * kidGap, y: 88 + (i % 2) * 30, r: 20 }));
  const JX = CX;
  const JY = 396; // where the trunk opens into boughs

  // ---------------------------------------------------------------- sky, sun, soil
  let s = "";
  s += `<rect width="${W}" height="${H}" fill="url(#tsky)"/>`;
  s += `<circle cx="${W - 70}" cy="74" r="120" fill="url(#tsun)"/><circle cx="${W - 70}" cy="74" r="34" fill="#f6dc9a" opacity=".55"/>`;
  // soft hills
  s += `<path d="M0 ${GROUND - 6} C90 ${GROUND - 40}, 190 ${GROUND - 14}, 270 ${GROUND - 26} S450 ${GROUND - 44}, ${W} ${GROUND - 12} V${H} H0Z" fill="#cfdcae" opacity=".9"/>`;
  s += `<path d="M0 ${GROUND + 4} C110 ${GROUND - 16}, 210 ${GROUND + 8}, 300 ${GROUND - 4} S470 ${GROUND - 16}, ${W} ${GROUND + 2} V${H} H0Z" fill="url(#tsoil)"/>`;
  // grass tufts on the line
  let grass = "";
  for (let i = 0; i < 26; i++) {
    const x = 14 + i * 20 + rnd() * 8;
    const y = GROUND - 2 + Math.sin(i * 0.9) * 6;
    const h = 8 + rnd() * 9;
    grass += `<path d="M${x} ${y} q-2 -${h * 0.6} -5 -${h} M${x} ${y} q1 -${h * 0.7} 1 -${h * 1.1} M${x} ${y} q3 -${h * 0.5} 6 -${h * 0.9}" fill="none" stroke="#6f8f4f" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>`;
  }
  s += grass;

  // ---------------------------------------------------------------- roots (grandparents live at their tips)
  const gpSlots: { x: number; p?: VPerson }[] = [
    { x: CX - 188, p: at(father?.father_id) },
    { x: CX - 66, p: at(father?.mother_id) },
    { x: CX + 66, p: at(mother?.father_id) },
    { x: CX + 188, p: at(mother?.mother_id) },
  ];
  const GY = 590;
  let roots = "";
  gpSlots.forEach((sl, i) => {
    const bx = CX + (i - 1.5) * 20;
    const d = `M${bx} ${GROUND + 6} C${bx + (sl.x - bx) * 0.15} ${GROUND + 44}, ${sl.x - (sl.x - bx) * 0.2} ${GY - 40}, ${sl.x} ${GY - 22}`;
    roots += `<path d="${d}" fill="none" stroke="#7a5a31" stroke-width="${sl.p ? 11 : 6}" stroke-linecap="round" opacity="${sl.p ? 1 : 0.55}"/>`;
    roots += `<path d="${d}" fill="none" stroke="#b08a55" stroke-width="3" stroke-linecap="round" opacity=".55" transform="translate(-1.5 -1)"/>`;
    // fine rootlets
    const mx = (bx + sl.x) / 2;
    roots += `<path d="M${mx} ${GROUND + 40} q${i < 2 ? -22 : 22} 8 ${i < 2 ? -34 : 34} 30" fill="none" stroke="#8c6a3c" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>`;
  });
  s += roots;

  // ---------------------------------------------------------------- foliage (behind everything but the sky)
  let canopy = "";
  const lobes: [number, number, number][] = [
    [CX, 190, 118], [CX - 130, 215, 92], [CX + 130, 215, 92], [CX - 186, 150, 62], [CX + 186, 150, 62],
    [CX - 70, 110, 84], [CX + 70, 110, 84], [CX, 60, 70], [CX - 170, 290, 52], [CX + 170, 290, 52], [CX, 300, 90],
  ];
  lobes.forEach(([x, y, r], i) => {
    canopy += `<circle cx="${x + (rnd() - 0.5) * 14}" cy="${y + (rnd() - 0.5) * 14}" r="${r}" fill="${i % 2 ? "#6f8f4f" : "#5f8044"}" opacity=".42"/>`;
  });
  const leafAt = (x: number, y: number, size: number, col: string, op: number) => {
    const a = rnd() * 360;
    return `<path d="M0 0 C${size * 0.55} -${size * 0.35}, ${size * 0.8} -${size * 0.9}, 0 -${size * 1.6} C-${size * 0.8} -${size * 0.9}, -${size * 0.55} -${size * 0.35}, 0 0Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(0)})" fill="${col}" opacity="${op}"/>`;
  };
  for (let i = 0; i < 150; i++) {
    // sample the canopy ellipse, thinner toward the trunk
    const t = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd());
    const x = CX + Math.cos(t) * rr * 226;
    const y = 190 + Math.sin(t) * rr * 175;
    if (y > 340 && Math.abs(x - CX) < 70) continue;
    canopy += leafAt(x, y, 12 + rnd() * 12, GREENS[Math.floor(rnd() * GREENS.length)], 0.55 + rnd() * 0.4);
  }
  // blossoms
  const bloom = ["#e8b4b8", "#f3d388", "#f6e7c1"];
  for (let i = 0; i < 22; i++) {
    const t = rnd() * Math.PI * 2;
    const rr = Math.sqrt(rnd());
    const x = CX + Math.cos(t) * rr * 230;
    const y = 190 + Math.sin(t) * rr * 165;
    canopy += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity=".9"><circle r="4.2" fill="${bloom[i % 3]}"/><circle r="1.5" fill="#c58a2c"/></g>`;
  }
  s += `<g class="ta-leaves">${canopy}</g>`;

  // ---------------------------------------------------------------- trunk and boughs
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number, lit = false) => {
    const c1x = x1 + (x2 - x1) * 0.08;
    const c1y = y1 + (y2 - y1) * 0.5;
    const c2x = x2 - (x2 - x1) * 0.55;
    const c2y = y2 + (y1 - y2) * 0.22;
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    return (
      `<path d="${d}" fill="none" stroke="#5b4326" stroke-width="${w + 2}" stroke-linecap="round" opacity=".35" transform="translate(1.5 2)"/>` +
      `<path d="${d}" fill="none" stroke="${lit ? "#8a5f2a" : "#7a5a31"}" stroke-width="${w}" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="#b9935e" stroke-width="${Math.max(1.4, w * 0.28)}" stroke-linecap="round" opacity=".6" transform="translate(-${(w * 0.18).toFixed(1)} -${(w * 0.1).toFixed(1)})"/>`
    );
  };
  let wood = "";
  sibP.forEach((n) => (wood += limb(JX + (n.x < CX ? -10 : 10), JY, n.x, n.y + n.r - 4, 11)));
  wood += limb(JX, JY + 4, meP.x, meP.y + meP.r - 4, 17, true);
  kidP.forEach((k) => (wood += limb(meP.x, meP.y - meP.r + 6, k.x, k.y + k.r - 3, 5.5)));
  if (spP) wood += limb(JX + 8, JY - 18, spP.x, spP.y + spP.r - 4, 8);
  s += wood;

  // trunk
  const L = CX - 22;
  const R = CX + 22;
  s +=
    `<path d="M${CX - 62} ${GROUND + 10} C${CX - 40} ${GROUND - 14}, ${CX - 36} 470, ${L - 6} 432 C${L - 8} 414, ${L - 4} 404, ${L + 2} ${JY - 6} L${R - 2} ${JY - 6} C${R + 4} 404, ${R + 8} 414, ${R + 6} 432 C${CX + 36} 470, ${CX + 40} ${GROUND - 14}, ${CX + 62} ${GROUND + 10} Z" fill="url(#tbark)" stroke="#5b4326" stroke-width="1.4"/>`;
  let bark = "";
  for (let i = 0; i < 7; i++) {
    const x = CX - 30 + i * 10 + rnd() * 4;
    bark += `<path d="M${x} ${GROUND - 4} C${x + 5} 480, ${x - 4} 450, ${x + 2} ${JY + 6}" fill="none" stroke="#4a361d" stroke-width="${(1 + rnd() * 1.2).toFixed(1)}" stroke-linecap="round" opacity=".38"/>`;
  }
  s += bark + `<ellipse cx="${CX + 6}" cy="480" rx="5" ry="8" fill="#4a361d" opacity=".5"/>`;

  // ---------------------------------------------------------------- a handful of leaves in front of the boughs
  let near = "";
  const nearNodes = [meP, ...sibP, ...(spP ? [spP] : []), ...kidP];
  nearNodes.forEach((n) => {
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2;
      const d = n.r + 6 + rnd() * 18;
      near += leafAt(n.x + Math.cos(a) * d, n.y + Math.sin(a) * d, 9 + rnd() * 6, GREENS[2 + Math.floor(rnd() * 4)], 0.95);
    }
  });
  s += `<g class="ta-leaves ta-near">${near}</g>`;

  // ---------------------------------------------------------------- people
  const accent = (p: VPerson) => (p.gender === "F" ? "#a4506a" : p.gender === "M" ? "#44563a" : "#6b6a5c");
  const label = (x: number, y: number, text: string, size: number, o2: { anchor?: string; weight?: number } = {}) =>
    `<text x="${x}" y="${y}" text-anchor="${o2.anchor || "middle"}" font-size="${size}" font-weight="${o2.weight || 700}" fill="#2b2a20" stroke="#fffdf8" stroke-width="4" stroke-linejoin="round" paint-order="stroke" ${FONT}>${esc(text)}</text>`;
  const medal = (p: VPerson, x: number, y: number, r: number, o2: { focus?: boolean; tag?: string; side?: "l" | "r" } = {}) => {
    const i = idx++;
    const gone = p.is_living === false;
    let face: string;
    if (p.photo_url && !p.is_locked) {
      defs += `<clipPath id="tm${i}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`;
      face = `<image href="${esc(p.photo_url)}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#tm${i})"${gone ? ' opacity=".85"' : ""}/>`;
    } else {
      face = `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent(p)}"/><text x="${x}" y="${y + r * 0.34}" text-anchor="middle" font-size="${(r * 0.95).toFixed(0)}" font-weight="700" fill="#fff" ${FONT}>${esc(Array.from(nm(p).trim())[0] || "•")}</text>`;
    }
    const name = (gone ? "स्व. " : "") + cut(nm(p), o2.focus ? 14 : 13);
    let out =
      (o2.focus ? `<circle cx="${x}" cy="${y}" r="${r + 16}" fill="url(#thalo)"/>` : "") +
      `<circle cx="${x}" cy="${y + 2}" r="${r + 4}" fill="#3b2d16" opacity=".22"/>` +
      `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="#fffdf8" stroke="${o2.focus ? "#d98a1e" : "#c9a45c"}" stroke-width="${o2.focus ? 3.4 : 2}"/>` +
      face;
    if (o2.side) out += label(o2.side === "l" ? x - r - 10 : x + r + 10, y + 4, name, 12.5, { anchor: o2.side === "l" ? "end" : "start" });
    else out += label(x, y + r + (o2.focus ? 22 : 17), name, o2.focus ? 15 : 12.5);
    if (o2.tag) out += `<g transform="translate(${x} ${y - r - 11})"><rect x="-26" y="-11" width="52" height="19" rx="9.5" fill="#d98a1e"/><text y="3" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff" ${FONT}>${esc(o2.tag)}</text></g>`;
    return out;
  };
  let people = "";
  // grandparents in the soil
  gpSlots.forEach((sl) => {
    if (sl.p) people += medal(sl.p, sl.x, GY, 21);
  });
  // parents on the bark
  if (father && mother) {
    people += medal(father, CX - 24, 452, 19, { side: "l" });
    people += medal(mother, CX + 24, 452, 19, { side: "r" });
  } else if (father || mother) {
    people += medal((father || mother) as VPerson, CX, 452, 20, { side: "r" });
  }
  sibP.forEach((n) => (people += medal(n.p, n.x, n.y, n.r)));
  if (spP) {
    // the two are tied by a vine with a heart
    const a = meP.x + meP.r + 6;
    const b = spP.x - spP.r - 6;
    people += `<path d="M${a} ${meP.y - 8} Q${(a + b) / 2} ${meP.y - 40} ${b} ${spP.y}" fill="none" stroke="#b8862f" stroke-width="2.6" stroke-dasharray="2 5" stroke-linecap="round"/>`;
    people += `<path d="M${(a + b) / 2} ${meP.y - 12} c-12 -9 -14 -20 -6 -22 c4 -1 6 2 6 5 c0 -3 2 -6 6 -5 c8 2 6 13 -6 22z" fill="#c4475f" stroke="#fffdf8" stroke-width="2.4" paint-order="stroke"/>`;
    people += medal(spP.p, spP.x, spP.y, spP.r);
  }
  kidP.forEach((k) => (people += medal(k.p, k.x, k.y, k.r)));
  people += medal(me, meP.x, meP.y, meP.r, { focus: true, tag: "तपाईं" });
  s += people;

  // ---------------------------------------------------------------- a few falling leaves
  let fall = "";
  for (let i = 0; i < 5; i++) fall += leafAt(30 + rnd() * (W - 60), 360 + rnd() * 150, 7 + rnd() * 4, "#c9a45c", 0.7);
  s += fall;

  const dsDefs =
    `<defs>` +
    `<linearGradient id="tsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf8f1"/><stop offset=".6" stop-color="#f3f1df"/><stop offset="1" stop-color="#e6ebcd"/></linearGradient>` +
    `<radialGradient id="tsun"><stop offset="0" stop-color="#f6dc9a" stop-opacity=".7"/><stop offset="1" stop-color="#f6dc9a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="tsoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d6b4"/><stop offset="1" stop-color="#cdb68a"/></linearGradient>` +
    `<linearGradient id="tbark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5f4527"/><stop offset=".45" stop-color="#8a6a3c"/><stop offset="1" stop-color="#6e5230"/></linearGradient>` +
    `<radialGradient id="thalo"><stop offset=".55" stop-color="#f6c75e" stop-opacity=".6"/><stop offset="1" stop-color="#f6c75e" stop-opacity="0"/></radialGradient>` +
    defs +
    `</defs>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(nm(me))} को वंशवृक्ष">${dsDefs}${s}</svg>`;
  return { svg, width: W, height: H, moreSibs: sibsAll.length - sibs.length, moreKids: kidsAll.length - kids.length };
}
