import { describe, expect, it } from "vitest";
import { family } from "./fixtures";
import { createGraph } from "../graph";
import { lineageSvg } from "../lineage";

describe("lineageSvg", () => {
  const people = family();
  const g = createGraph(people);
  const ram = g.byId["ram"];

  it("draws grandparents, parents, siblings, spouse and children of a person", () => {
    const { svg, width, height } = lineageSvg(g, ram, { selfLabel: "तपाईं" });
    for (const n of ["गोपाल बराल", "लक्ष्मी बराल", "हरि बराल", "गीता बराल", "श्याम बराल", "मिना बराल", "सीता बराल", "किरण बराल"]) {
      expect(svg).toContain(n);
    }
    expect(svg).toContain("तपाईं");
    expect(width).toBeGreaterThan(500);
    expect(height).toBeGreaterThan(400);
  });

  it("skips missing generations and can hide the children", () => {
    const hari = g.byId["hari"];
    const a = lineageSvg(g, hari, { kids: false });
    expect(a.svg).not.toContain("राम बराल");
    const top = lineageSvg(g, g.byId["gopal"]);
    expect(top.svg).toContain("हरि बराल");
    expect(top.svg).not.toContain("undefined");
  });

  it("escapes names", () => {
    const x = { ...g.byId["shyam"], name: 'A<b>"&' };
    const { svg } = lineageSvg(createGraph(people.map((p) => (p.id === "shyam" ? x : p))), x);
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;");
  });

  it("can limit siblings and children for a small tree", () => {
    const hari = g.byId["hari"];
    const full = lineageSvg(g, hari, {});
    const small = lineageSvg(g, hari, { maxSibs: 0, maxKids: 1, noLabels: true });
    expect(full.moreSibs).toBe(0);
    expect(small.moreSibs).toBe(1);
    expect(small.moreKids).toBe(2);
    expect(small.svg.length).toBeLessThan(full.svg.length);
  });
});
