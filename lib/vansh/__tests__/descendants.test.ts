import { describe, expect, it } from "vitest";
import { family } from "./fixtures";
import { createGraph } from "../graph";
import { descendantsRoot, descendantsSvg } from "../descendants";

describe("descendantsSvg", () => {
  const g = createGraph(family());

  it("starts from the paternal grandfather and draws everyone below", () => {
    const ram = g.byId["ram"];
    const root = descendantsRoot(g, ram);
    expect(root.id).toBe(g.byId["hari"].father_id);
    const d = descendantsSvg(g, ram);
    expect(d.svg).toContain(root.name);
    expect(d.svg).toContain(ram.name);
    expect(d.count).toBeGreaterThan(3);
    expect(d.gens).toBeGreaterThanOrEqual(3);
    expect(d.svg).not.toContain("undefined");
    expect(d.svg).not.toContain("NaN");
  });

  it("falls back to the person when no ancestors are recorded and escapes names", () => {
    const top = g.byId["gopal"];
    expect(descendantsRoot(g, top).id).toBe(top.id);
    const d = descendantsSvg(g, top, { nm: () => "<b>&" });
    expect(d.svg).toContain("&lt;b&gt;&amp;");
    expect(d.svg).not.toContain("<b>");
  });

  it("draws each person once", () => {
    const d = descendantsSvg(g, g.byId["ram"]);
    expect((d.svg.match(/fill="#1d2616"/g) || []).length).toBe(d.count);
  });
});
