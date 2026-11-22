import { describe, expect, it } from "vitest";
import { createGraph } from "../graph";
import { muralSvg } from "../mural";

const P = (id: string, name: string, o: Record<string, unknown> = {}) => ({ id, name, gender: "M", father_id: null, mother_id: null, spouse_id: null, is_living: true, created_at: "1", ...o });
const base = () => [
  P("gf", "हरि बराल", { spouse_id: "gm" }), P("gm", "इन्दिरा बराल", { gender: "F", spouse_id: "gf" }),
  P("f", "राम बराल", { father_id: "gf", mother_id: "gm", spouse_id: "m" }), P("m", "कमला", { gender: "F", spouse_id: "f" }),
  P("b", "हरिप्रसाद बराल", { father_id: "gf", mother_id: "gm", spouse_id: "bw" }), P("bw", "मीना", { gender: "F", spouse_id: "b" }),
  P("d", "दुर्गा", { gender: "F", father_id: "gf", mother_id: "gm", spouse_id: "dh" }), P("dh", "देवी", { spouse_id: "d" }), P("dk", "दीपक", { father_id: "dh", mother_id: "d" }),
  P("me", "सरोज बराल", { father_id: "f", mother_id: "m", spouse_id: "w" }), P("w", "अनिता", { gender: "F", spouse_id: "me" }),
  P("sis", "रेखा", { gender: "F", father_id: "f", mother_id: "m", spouse_id: "sh" }), P("sh", "रेखाका श्रीमान्", { spouse_id: "sis" }),
  P("k1", "आरव", { father_id: "me", mother_id: "w" }),
];
const tier = (svg: string, id: string) => (svg.match(new RegExp(`data-p="${id}" data-tier="(\\w+)"`)) || [])[1];

describe("muralSvg", () => {
  const g = createGraph(base() as never);
  const m = muralSvg(g, g.byId["me"]);
  it("keeps a son's whole family but a daughter stands alone", () => {
    expect(m.ids).toEqual(expect.arrayContaining(["gf", "gm", "f", "m", "b", "bw", "d", "me", "w", "k1"]));
    expect(m.ids).not.toContain("dh"); // the daughter's husband
    expect(m.ids).not.toContain("dk"); // the daughter's child
    expect(m.ids).not.toContain("sh"); // the viewer's own sister's husband
  });
  it("frames everyone when the family is small", () => {
    expect(m.plates).toBe(0);
    expect(tier(m.svg, "d")).toBe("frame");
  });
  it("shrinks the brothers' children to plates in a big family, but never the viewer's line", () => {
    const many = base();
    for (let i = 0; i < 12; i++) many.push(P("c" + i, "चचेरा" + i, { gender: i % 2 ? "F" : "M", father_id: "b", mother_id: "bw" }));
    const g2 = createGraph(many as never);
    const big = muralSvg(g2, g2.byId["me"]);
    expect(tier(big.svg, "c3")).toBe("plate");
    expect(big.plates).toBe(12);
    for (const id of ["me", "w", "k1", "sis", "f", "b", "gf"]) expect(tier(big.svg, id)).toBe("frame");
  });
  it("escapes names", () => {
    expect(muralSvg(g, g.byId["me"], { nm: () => "<b>&" }).svg).not.toContain("<b>");
  });
});
