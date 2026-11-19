// "हजुरबुबादेखिको वंशवृक्ष": an SVG of one person's close lineage — grandparents (both sides), parents,
// the person with siblings and spouse(s), and their children. Used on the profile page, the life-sheet print and the home hero.
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { np, yr } from "./text";

export interface Lineage {
  svg: string;
  width: number;
  height: number;
}

export interface LineageOpts {
  /** what to call the focus person, e.g. "तपाईं" */
  selfLabel?: string;
  /** children row (default true) */
  kids?: boolean;
  /** mother's parents (default true) */
  maternal?: boolean;
  /** hide the small relation line under each name (mini tree) */
  noLabels?: boolean;
  /** name used for locked people */
  nm?: (p: VPerson) => string;
}

const U = 176; // column width
const CW = 152; // card width
const CH = 108; // card height
const ROW = 156; // row pitch
const FONT = 'font-family="Noto Serif Devanagari, Tiro Devanagari Hindi, serif"';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cut = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n - 1).join("") + "…" : s);

interface Node {
  p: VPerson;
  cx: number;
  row: number;
  label: string;
  focus?: boolean;
}

const lifeSpan = (p: VPerson) => {
  const b = yr(p.birth_bs);
  const d = yr(p.death_bs);
  if (b && d) return `${np(b)} – ${np(d)}`;
  if (b) return p.is_living === false ? `${np(b)} – ` : `जन्म ${np(b)}`;
  if (d) return `मृ. ${np(d)}`;
  return "";
};

export function lineageSvg(g: Graph, p: VPerson, o: LineageOpts = {}): Lineage {
  const { byId } = g;
  const label = (n: string) => (o.noLabels ? "" : n);
  const nodes: Node[] = [];
  const at = (id: string | null | undefined) => (id ? byId[id] : undefined);
  const byGender = (m: string, f: string, x: VPerson) => (x.gender === "F" ? f : m);

  const father = at(p.father_id);
  const mother = at(p.mother_id);
  const maternal = o.maternal !== false;

  // ---- row 2: siblings + the person + spouses (centred on 0)
  const sibs = g.sibsOf(p).filter((s) => s.id !== p.id);
  const all = [...sibs, p].sort(g.byBirth);
  const spouses = g.spousesOf(p).map((id) => byId[id]).filter(Boolean) as VPerson[];
  const items: { p: VPerson; label: string; focus?: boolean; spouseOf?: boolean }[] = [];
  all.forEach((x) => {
    if (x.id === p.id) {
      items.push({ p: x, label: o.selfLabel || "", focus: true });
      spouses.forEach((s) => items.push({ p: s, label: byGender("पति", "पत्नी", s), spouseOf: true }));
    } else items.push({ p: x, label: byGender("दाजु/भाइ", "दिदी/बहिनी", x) });
  });
  const w2 = items.length * U;
  items.forEach((it, i) => nodes.push({ p: it.p, cx: -w2 / 2 + U / 2 + i * U, row: 2, label: label(it.label), focus: it.focus }));
  const me = nodes.find((n) => n.focus) as Node;
  const mySpouses = nodes.filter((n, i) => n.row === 2 && items[i].spouseOf);

  // ---- row 1: parents, spread so that their own parents fit above
  const twoPar = !!(father && mother);
  const gpN = (par?: VPerson) => (par ? [at(par.father_id), at(par.mother_id)].filter(Boolean).length : 0);
  const left = gpN(father);
  const right = maternal ? gpN(mother) : 0;
  // parents sit just far enough apart that both grandparent pairs fit above them
  const gap = twoPar ? Math.max(U, ((left + right) / 2) * U + (left && right ? 0.5 * U : 0)) : 0;
  const fx = twoPar ? -gap / 2 : 0;
  const mx = twoPar ? gap / 2 : 0;
  if (father) nodes.push({ p: father, cx: fx, row: 1, label: label("बुबा") });
  if (mother) nodes.push({ p: mother, cx: mx, row: 1, label: label("आमा") });

  // ---- row 0: grandparents (pairs around each parent)
  const pair = (par: VPerson | undefined, cx: number, tags: [string, string]) => {
    if (!par) return;
    const gf = at(par.father_id);
    const gm = at(par.mother_id);
    if (gf && gm) {
      nodes.push({ p: gf, cx: cx - U / 2, row: 0, label: label(tags[0]) });
      nodes.push({ p: gm, cx: cx + U / 2, row: 0, label: label(tags[1]) });
    } else if (gf) nodes.push({ p: gf, cx, row: 0, label: label(tags[0]) });
    else if (gm) nodes.push({ p: gm, cx, row: 0, label: label(tags[1]) });
  };
  pair(father, fx, ["हजुरबुबा", "हजुरआमा"]);
  if (maternal) pair(mother, mx, ["आमाका पिता", "आमाकी आमा"]);

  // ---- row 3: children
  const kids = o.kids === false ? [] : g.kidsOf(p).slice().sort(g.byBirth);
  if (kids.length) {
    const mid = mySpouses.length ? (me.cx + mySpouses[mySpouses.length - 1].cx) / 2 : me.cx;
    kids.forEach((k, i) => nodes.push({ p: k, cx: mid - (kids.length * U) / 2 + U / 2 + i * U, row: 3, label: label(byGender("छोरा", "छोरी", k)) }));
  }

  const rows = new Set(nodes.map((n) => n.row));
  const topRow = Math.min(...rows);
  const botRow = Math.max(...rows);
  const minX = Math.min(...nodes.map((n) => n.cx - CW / 2)) - 24;
  const maxX = Math.max(...nodes.map((n) => n.cx + CW / 2)) + 24;
  const width = Math.max(maxX - minX, 360);
  const shift = -minX + (width - (maxX - minX)) / 2;
  const height = (botRow - topRow) * ROW + CH + 48;
  const X = (n: Node) => n.cx + shift;
  const Y = (row: number) => 24 + (row - topRow) * ROW;
  const nodeOf = (id: string) => nodes.find((n) => n.p.id === id);
  const nm = (x: VPerson) => (o.nm ? o.nm(x) : x.name);

  // ---- connectors (drawn first, under the cards)
  let lines = "";
  const stroke = 'fill="none" stroke="#b58a42" stroke-width="1.6" stroke-linecap="round"';
  const drop = (fromX: number, fromRow: number, toX: number, toRow: number) => {
    const y1 = Y(fromRow) + CH;
    const y2 = Y(toRow);
    const my = y1 + (y2 - y1) / 2;
    lines += `<path d="M${fromX} ${y1} V${my} H${toX} V${y2}" ${stroke}/>`;
  };
  const couple = (a: Node, b: Node) => {
    const y = Y(a.row) + CH / 2;
    const x1 = Math.min(X(a), X(b)) + CW / 2;
    const x2 = Math.max(X(a), X(b)) - CW / 2;
    lines += `<path d="M${x1} ${y} H${x2}" ${stroke} stroke-dasharray="0"/>`;
    lines += `<path d="M${(x1 + x2) / 2} ${y + 5} c-7 -6 -7 -13 0 -13 c7 0 7 7 0 13z" fill="#b58a42" transform="translate(0 2)"/>`;
  };
  const fn = father && nodeOf(father.id);
  const mn = mother && nodeOf(mother.id);
  // grandparents -> each parent
  [fn, mn].forEach((pn) => {
    if (!pn) return;
    const gs = [at(pn.p.father_id), at(pn.p.mother_id)].map((x) => x && nodeOf(x.id)).filter(Boolean) as Node[];
    if (!gs.length) return;
    if (gs.length === 2) couple(gs[0], gs[1]);
    drop(gs.reduce((s, n) => s + X(n), 0) / gs.length, 0, X(pn), 1);
  });
  if (fn && mn) couple(fn, mn);
  // parents -> siblings (and the person)
  const parentX = fn && mn ? (X(fn) + X(mn)) / 2 : fn ? X(fn) : mn ? X(mn) : null;
  if (parentX !== null) nodes.filter((n) => n.row === 2 && !items[nodes.indexOf(n)]?.spouseOf).forEach((n) => drop(parentX, 1, X(n), 2));
  mySpouses.forEach((s) => couple(me, s));
  // the person (+ spouse) -> children
  if (kids.length) {
    const mid = mySpouses.length ? (X(me) + X(mySpouses[mySpouses.length - 1])) / 2 : X(me);
    nodes.filter((n) => n.row === 3).forEach((n) => drop(mid, 2, X(n), 3));
  }

  // ---- cards
  let cards = "";
  let defs = "";
  nodes.forEach((n, i) => {
    const x = X(n) - CW / 2;
    const y = Y(n.row);
    const p = n.p;
    const name = cut(nm(p), 15);
    const fill = n.focus ? "#313d24" : "#fffdf8";
    const ink = n.focus ? "#ffffff" : "#2b2a20";
    const sub = n.focus ? "#d9b36a" : "#7d5a1e";
    const accent = p.gender === "F" ? "#a4506a" : p.gender === "M" ? "#44563a" : "#6b6a5c";
    const cx = x + CW / 2;
    const cy = y + 34;
    let face: string;
    if (p.photo_url && !p.is_locked) {
      defs += `<clipPath id="ln${i}"><circle cx="${cx}" cy="${cy}" r="24"/></clipPath>`;
      face = `<image href="${esc(p.photo_url)}" x="${cx - 24}" y="${cy - 24}" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#ln${i})"/><circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="#d9b36a" stroke-width="2"/>`;
    } else {
      const ini = esc(Array.from(nm(p).trim())[0] || "•");
      face = `<circle cx="${cx}" cy="${cy}" r="24" fill="${accent}" stroke="#d9b36a" stroke-width="2"/><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" ${FONT}>${ini}</text>`;
    }
    const gone = p.is_living === false ? "स्व. " : "";
    cards +=
      `<g><rect x="${x}" y="${y}" width="${CW}" height="${CH}" rx="14" fill="${fill}" stroke="${n.focus ? "#d9b36a" : "#b58a42"}" stroke-width="${n.focus ? 2.4 : 1.2}"/>` +
      face +
      `<text x="${cx}" y="${y + 77}" text-anchor="middle" font-size="14" font-weight="700" fill="${ink}" ${FONT}>${esc(gone + name)}</text>` +
      (n.label ? `<text x="${cx}" y="${y + 94}" text-anchor="middle" font-size="11" fill="${sub}" ${FONT}>${esc(n.label)}${lifeSpan(p) ? " · " + esc(lifeSpan(p)) : ""}</text>` : lifeSpan(p) ? `<text x="${cx}" y="${y + 94}" text-anchor="middle" font-size="11" fill="${sub}" ${FONT}>${esc(lifeSpan(p))}</text>` : "") +
      `</g>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(nm(p))} को वंशवृक्ष"><defs>${defs}</defs>${lines}${cards}</svg>`;
  return { svg, width, height };
}
