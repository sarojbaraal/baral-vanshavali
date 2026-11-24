// Family-chart layout: turns the people list into positioned cards and connector lines.
// Ported from the original app.js (build / measure / rowOf / place / draw).
import type { VPerson } from "./types";
import type { Graph } from "./graph";
import { surnameOf } from "./text";

export const CW = 176;
export const CH = 72;
export const GAP = 16;
export const HG = 26;
export const VG = 64;
export const GEN = ["#E4572E", "#F3A712", "#29A19C", "#3A7CA5", "#7B5EA7", "#D1477A", "#5B8C5A", "#C17C3B"];

export interface Dims { cw: number; ch: number; gap: number; hg: number; vg: number; heart?: boolean; /** parent→child branches are drawn as soft Bézier curves instead of right-angled brackets */ curve?: boolean; /** children without descendants hang in a vertical column when a parent has at least this many */ stack?: number; /** everything below a hanging node hangs too (outline style) */ deep?: boolean }
const STK = 22; // indent of a hanging column
const SG = 26; // gap between hanging cards
export const DEFAULT_DIMS: Dims = { cw: CW, ch: CH, gap: GAP, hg: HG, vg: VG };
/** Smaller cards and a gap wide enough for a heart between spouses: used by the printable poster. */
/** the on-screen chart: same grid, curved branches */
export const SCREEN_DIMS: Dims = { ...DEFAULT_DIMS, curve: true };

export const POSTER_DIMS: Dims = { cw: 158, ch: 60, gap: 24, hg: 14, vg: 46, heart: true };
let D: Dims = DEFAULT_DIMS;
let HEARTS: { x: number; y: number }[] = [];
// women who married into the Baral line: they belong to their husband's tree, not to their birth family's
let AWAY: Set<string> = new Set();

export interface TreeNode {
  p: VPerson;
  sps: VPerson[];
  d: number;
  w: number;
  all: TreeNode[];
  from?: string | null;
  vis: TreeNode[];
  ct: number;
  tw: number;
  ax: number;
  stk?: boolean;
  /** hangs from a parent's vertical spine: the blood child is drawn first (leftmost) so the branch joins her/him, not the spouse */
  hang?: boolean;
}
export interface Card {
  p: VPerson;
  x: number;
  y: number;
  d: number;
}
export interface Line {
  d: string;
  c: string;
  m?: 1;
}
export interface Unit {
  key: string;
  px: number;
  y: number;
  n: number;
  open: boolean;
}
export interface Layout {
  cards: Card[];
  lines: Line[];
  units: Unit[];
  trees: TreeNode[];
  W: number;
  H: number;
  cardPos: Record<string, Card>;
  hearts: { x: number; y: number }[];
  dims: Dims;
}

function buildNode(g: Graph, p: VPerson, seen: Set<string>, d: number): TreeNode {
  const { byId, spousesOf, kidsOf, byBirth } = g;
  seen.add(p.id);
  const sps = spousesOf(p)
    .map((id) => byId[id])
    .filter((s, i, a) => !seen.has(s.id) && a.indexOf(s) === i);
  sps.forEach((s) => seen.add(s.id));
  const uniq = (a: VPerson[]) => [...new Map(a.map((k) => [k.id, k])).values()].sort(byBirth);
  const groups: { from: string | null; ks: VPerson[] }[] =
    sps.length >= 2
      ? [...sps.map((s) => ({ from: s.id, ks: uniq(kidsOf(s)) })), { from: null, ks: uniq(kidsOf(p)) }]
      : [{ from: null, ks: uniq([...kidsOf(p), ...(sps[0] ? kidsOf(sps[0]) : [])]) }];
  const all: TreeNode[] = [];
  groups.forEach((gr) =>
    gr.ks.forEach((k) => {
      if (!seen.has(k.id) && !AWAY.has(k.id)) {
        const c = buildNode(g, k, seen, d + 1);
        c.from = gr.from;
        all.push(c);
      }
    })
  );
  return { p, sps, d, w: (sps.length + 1) * D.cw + sps.length * D.gap, all, vis: [], ct: 0, tw: 0, ax: 0 };
}

function measure(n: TreeNode, collapsed: Set<string>) {
  n.vis = collapsed.has(n.p.id) ? [] : n.all;
  n.vis.forEach((c) => {
    c.hang = false;
    measure(c, collapsed);
  });
  n.ct = n.vis.reduce((a, c) => a + c.tw, 0) + D.hg * Math.max(0, n.vis.length - 1);
  n.tw = Math.max(n.w, n.ct);
  const canHang = (c: TreeNode) => c.sps.length <= 1 && (c.vis.length === 0 || !!c.stk);
  n.stk = !!D.stack && n.sps.length <= 1 && n.vis.length > 0 && n.vis.every(canHang) && (n.vis.length >= D.stack || !!D.deep);
  if (n.stk) {
    n.vis.forEach((c) => {
      c.hang = true;
      if (c.stk) stkSize(c); // its own row order changed, so its hanging width too
    });
    stkSize(n);
  }
}

function stkSize(n: TreeNode) {
  const pi = rowOf(n).indexOf(n.p);
  n.ct = pi * (D.cw + D.gap) + STK * 2 + Math.max(...n.vis.map((c) => c.tw));
  n.tw = Math.max(n.w, n.ct);
}

function rowOf(n: TreeNode): VPerson[] {
  const { p, sps } = n;
  if (!sps.length) return [p];
  if (sps.length === 1) {
    const s = sps[0];
    // a married daughter is drawn after her husband, except in a hanging column where the spine must reach her
    return p.gender === "F" && s.gender !== "F" && !n.hang ? [s, p] : [p, s];
  }
  return [sps[0], p, ...sps.slice(1)];
}

function place(n: TreeNode, x: number, y: number, cards: Card[], lines: Line[], units: Unit[]): number {
  const row = rowOf(n);
  const ux = n.stk ? x : x + (n.tw - n.w) / 2;
  const px = ux + n.w / 2;
  const cx: Record<string, number> = {};
  row.forEach((q, i) => {
    const qx = ux + i * (D.cw + D.gap);
    cards.push({ p: q, x: qx, y, d: n.d });
    cx[q.id] = qx + D.cw / 2;
  });
  const pi = row.indexOf(n.p);
  n.sps.forEach((s) => {
    const si = row.indexOf(s);
    if (Math.abs(si - pi) === 1) {
      const a = Math.min(si, pi);
      lines.push({ d: `M${ux + a * (D.cw + D.gap) + D.cw} ${y + D.ch / 2}H${ux + (a + 1) * (D.cw + D.gap)}`, c: n.p.id });
      if (D.heart && n.sps.length === 1) HEARTS.push({ x: ux + a * (D.cw + D.gap) + D.cw + D.gap / 2, y: y + D.ch / 2 });
    } else {
      lines.push({ d: `M${cx[n.p.id]} ${y + D.ch}V${y + D.ch + 12}H${cx[s.id]}V${y + D.ch}`, c: n.p.id, m: 1 });
    }
  });
  n.ax = cx[n.p.id];
  if (n.all.length) units.push({ key: n.p.id, px, y, n: n.all.length, open: n.vis.length > 0 });
  if (n.stk) {
    // hanging column: a spine under the parent card, one short branch per child (children may hang their own children)
    const sx = ux + pi * (D.cw + D.gap) + STK;
    let cy = y + D.ch + 14;
    let lastY = cy;
    n.vis.forEach((c) => {
      lastY = cy;
      const bottom = place(c, sx + STK, cy, cards, lines, units);
      lines.push({ d: `M${sx} ${cy + D.ch / 2}H${sx + STK}`, c: c.p.id });
      cy = bottom + SG;
    });
    lines.push({ d: `M${sx} ${y + D.ch}V${lastY + D.ch / 2}`, c: n.p.id });
    return cy - SG;
  }
  let cur = x + (n.tw - n.ct) / 2;
  // several spouses: each spouse's children hang from their own bracket line at its own height, so one spouse's
  // children never look joined to another spouse (the brackets overlap sideways when families are wide)
  const multi = n.sps.length >= 2;
  const groups = n.sps.length + (n.vis.some((c) => !c.from) ? 1 : 0);
  const step = multi && groups > 1 ? Math.min(10, (D.vg - 20) / (groups - 1)) : 0;
  n.vis.forEach((c) => {
    const fx = multi && c.from && cx[c.from] != null ? cx[c.from] : px;
    place(c, cur, y + D.ch + D.vg, cards, lines, units);
    const y0 = D.heart && n.sps.length === 1 && fx === px ? y + D.ch / 2 : y + D.ch; // poster: the child bracket hangs from the heart
    const gi = multi ? (c.from ? n.sps.findIndex((s) => s.id === c.from) : n.sps.length) : 0;
    const by = multi ? y + D.ch + 10 + gi * step : y + D.ch + D.vg / 2;
    const yt = y + D.ch + D.vg;
    lines.push({
      d: D.curve
        ? `M${fx} ${y0}C${fx} ${y0 + (yt - y0) * 0.58},${c.ax} ${yt - (yt - y0) * 0.58},${c.ax} ${yt}`
        : `M${fx} ${y0}V${by}H${c.ax}V${yt}`,
      c: c.p.id,
    });
    cur += c.tw + D.hg;
  });
  return y + D.ch;
}

/**
 * A woman born into another family who married a बराल man with known parents is drawn beside her husband, with their
 * children. Otherwise whichever tree is built first would claim the couple, and with masked birth dates for some roles
 * that was the wife's family (मावाली) tree.
 */
export function marriedAway(g: Graph): Set<string> {
  const out = new Set<string>();
  g.people.forEach((p) => {
    if (p.gender !== "F" || !g.hasParents(p) || !p.spouse_id || p.more_spouse_ids?.length) return;
    const h = g.byId[p.spouse_id];
    if (!h || h.gender === "F" || !g.hasParents(h) || surnameOf(h.name) !== "बराल") return;
    const fa = p.father_id ? g.byId[p.father_id] : undefined;
    if (fa && surnameOf(fa.name) === "बराल") return; // a Baral daughter stays in the Baral tree
    out.add(p.id);
  });
  return out;
}

function buildTrees(g: Graph): TreeNode[] {
  const seen = new Set<string>();
  const { people, hasParents, isMarriedIn, byBirth } = g;
  AWAY = marriedAway(g);
  const trees = people
    .filter((p) => !hasParents(p) && !isMarriedIn(p))
    .sort(byBirth)
    .map((p) => buildNode(g, p, seen, 0));
  // Anyone not reached from a root (a link the roots above could not follow): start from their topmost known ancestor,
  // never from a descendant. Re-checked one by one, so nobody is drawn a second time and no branch is cut off from its elders.
  const top = (p: VPerson): VPerson => {
    const path = new Set<string>([p.id]);
    let cur = p;
    for (;;) {
      const up = [cur.father_id, cur.mother_id].map((i) => (i ? g.byId[i] : undefined)).find((q): q is VPerson => !!q && !path.has(q.id) && !AWAY.has(q.id));
      if (!up) return cur;
      path.add(up.id);
      cur = up;
    }
  };
  people.forEach((p) => {
    if (seen.has(p.id)) return;
    const t = top(p);
    trees.push(buildNode(g, seen.has(t.id) ? p : t, seen, 0));
  });
  AWAY = new Set();
  return trees;
}

/** Initially folded branches: everything from generation 4 down. */
export function initialCollapsed(g: Graph): Set<string> {
  const c = new Set<string>();
  const f = (n: TreeNode) => {
    if (n.d >= 3 && n.all.length) c.add(n.p.id);
    n.all.forEach(f);
  };
  buildTrees(g).forEach(f);
  return c;
}

export function computeLayout(g: Graph, collapsed: Set<string>, dims: Dims = DEFAULT_DIMS): Layout {
  D = dims;
  HEARTS = [];
  const cards: Card[] = [];
  const lines: Line[] = [];
  const units: Unit[] = [];
  const trees = buildTrees(g);
  let x = 0;
  trees.forEach((t) => {
    measure(t, collapsed);
    place(t, x, 0, cards, lines, units);
    x += t.tw + D.hg * 3;
  });
  const W = Math.max(x - D.hg * 3, D.cw);
  const H = Math.max(D.ch, ...cards.map((c) => c.y + D.ch)) + 34;
  const out = { cards, lines, units, trees, W, H, cardPos: Object.fromEntries(cards.map((c) => [c.p.id, c])), hearts: HEARTS, dims };
  D = DEFAULT_DIMS;
  return out;
}

/** First view for a member with a place in the tree: their own branch open (ancestors, siblings, descendants), the rest folded. */
export function myBranchCollapsed(g: Graph, id: string): Set<string> {
  return openUp(g, compactCollapsed({ trees: buildTrees(g) } as Layout, g.branchOf([id])), id);
}

/** "संक्षिप्त": keep the user's own branch open and fold the rest. */
export function compactCollapsed(layout: Layout, keep: Set<string> | null): Set<string> {
  const c = new Set<string>();
  const f = (n: TreeNode) => {
    const mine = !!keep && (keep.has(n.p.id) || n.sps.some((s) => keep.has(s.id)));
    if (!mine && (keep || n.d >= 1) && n.all.length) c.add(n.p.id);
    n.all.forEach(f);
  };
  layout.trees.forEach(f);
  return c;
}

/** Unfold every ancestor/spouse chain so that `id` becomes visible. */
export function openUp(g: Graph, collapsed: Set<string>, id: string | null | undefined, seen = new Set<string>()): Set<string> {
  const next = new Set(collapsed);
  const walk = (i?: string | null) => {
    const p = i ? g.byId[i] : undefined;
    if (!p || seen.has(p.id)) return;
    seen.add(p.id);
    next.delete(p.id);
    walk(p.father_id);
    walk(p.mother_id);
    walk(p.spouse_id);
  };
  walk(id);
  return next;
}
