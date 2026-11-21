import { describe, expect, it } from "vitest";
import { family } from "./fixtures";
import { createGraph } from "../graph";
import { computeLayout, DEFAULT_DIMS, myBranchCollapsed, SCREEN_DIMS } from "../layout";

describe("on-screen chart", () => {
  const g = createGraph(family());

  it("draws branches as Bézier curves, the printed layout stays right-angled", () => {
    const screen = computeLayout(g, new Set(), SCREEN_DIMS);
    const plain = computeLayout(g, new Set(), DEFAULT_DIMS);
    const kidLine = (l: typeof screen) => l.lines.find((x) => x.c === "ram" && x.d.startsWith("M") && /[VC]/.test(x.d))!.d;
    expect(kidLine(screen)).toMatch(/C/);
    expect(kidLine(plain)).toMatch(/V\d+H/);
    // same cards in both: only the connector style changes
    expect(screen.cards.length).toBe(plain.cards.length);
    expect(screen.W).toBe(plain.W);
  });

  it("starts a member on their own branch: relatives' families fold, their own line stays open", () => {
    const c = myBranchCollapsed(g, "ram");
    expect(c.has("ram")).toBe(false);
    expect(c.has("hari")).toBe(false);
    expect(c.has("gopal")).toBe(false);
    // the uncle's family and the aunt's family are folded away
    expect(c.has("dev")).toBe(true);
    expect(c.has("mina")).toBe(true);
    const L = computeLayout(g, c, SCREEN_DIMS);
    const ids = L.cards.map((x) => x.p.id);
    expect(ids).toContain("kiran");
    expect(ids).not.toContain("pooja");
    expect(ids).not.toContain("anil");
  });
});
