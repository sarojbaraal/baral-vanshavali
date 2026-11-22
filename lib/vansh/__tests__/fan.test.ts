import { describe, expect, it } from "vitest";
import { createGraph } from "../graph";
import { fanSvg } from "../fan";

const P = (id: string, name: string, o: Record<string, unknown> = {}) => ({ id, name, gender: "M", father_id: null, mother_id: null, spouse_id: null, is_living: true, created_at: "1", ...o });
const g = createGraph([
  P("gf", "हजुर"), P("gm", "हजुरआमा", { gender: "F" }),
  P("f", "बुबा", { father_id: "gf", mother_id: "gm" }), P("m", "आमा", { gender: "F" }),
  P("me", "म", { father_id: "f", mother_id: "m" }),
] as never);

describe("fanSvg", () => {
  it("places the father's line left and counts known and empty places", () => {
    const d = fanSvg(g, g.byId["me"], { gens: 3 });
    expect(d.known).toBe(4); // father, mother, two grandparents
    expect(d.empty).toBe(2 + 4 + 8 - 4);
    expect(d.svg.indexOf("बुबा")).toBeLessThan(d.svg.indexOf("आमा"));
  });
  it("escapes names and adds the stamp only when asked", () => {
    const d = fanSvg(g, g.byId["me"], { nm: () => "<b>&" });
    expect(d.svg).toContain("&lt;b&gt;&amp;");
    expect(d.svg).not.toContain("<b>");
    expect(d.svg).not.toContain("डिजिटल हस्ताक्षर");
    const s = fanSvg(g, g.byId["me"], { stamp: { who: "x", when: "w", id: "ABC", line: "डिजिटल हस्ताक्षर ABC" } });
    expect(s.svg).toContain("डिजिटल हस्ताक्षर ABC");
  });
});
