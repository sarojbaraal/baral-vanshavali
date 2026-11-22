import { describe, expect, it } from "vitest";
import { person } from "./fixtures";
import { printable } from "../hidden";
import { createGraph } from "../graph";
import { lineageSvg } from "../lineage";

const base = () => [
  person({ id: "f", name: "पिता बराल", gender: "M", spouse_id: "m", birth_bs: "2000-01-01" }),
  person({ id: "m", name: "माता बराल", gender: "F", spouse_id: "f", birth_bs: "2002-01-01" }),
  person({ id: "c", name: "सन्तान बराल", gender: "M", father_id: "f", mother_id: "m", birth_bs: "2030-01-01" }),
  person({ id: "d", name: "छोरी बराल", gender: "F", father_id: "f", mother_id: "m", birth_bs: "2033-01-01" }),
];

describe("printable", () => {
  it("returns the same list when nobody is hidden", () => {
    const l = base();
    expect(printable(l)).toBe(l);
  });

  it("drops a hidden person and every link to them", () => {
    const l = base().map((p) => (p.id === "m" ? { ...p, hidden: true } : p));
    const out = printable(l);
    expect(out.map((p) => p.id)).toEqual(["f", "c", "d"]);
    expect(out.find((p) => p.id === "f")!.spouse_id).toBeNull();
    expect(out.find((p) => p.id === "c")!.mother_id).toBeNull();
    expect(out.find((p) => p.id === "c")!.father_id).toBe("f");
  });

  it("a hidden person's name appears in nothing built from the printable list", () => {
    const l = base().map((p) => (p.id === "m" ? { ...p, hidden: true, name: "गोप्य व्यक्ति" } : p));
    const g = createGraph(printable(l));
    const svg = lineageSvg(g, g.byId["c"], { selfLabel: "म" }).svg;
    expect(svg).not.toContain("गोप्य");
    expect(JSON.stringify(g.people)).not.toContain("गोप्य");
  });
});
