import { describe, expect, it } from "vitest";
import { person } from "./fixtures";
import { createGraph } from "../graph";
import { computeLayout } from "../layout";

// Durga (born Niraula) m. Devi Baral; their son Saroj. The Niraula tree must not carry the Baral couple, whichever
// tree is built first (an older / undated Niraula root used to win for roles that see masked birth dates).
const make = (niraulaBirth?: string) => [
  person({ id: "nar", name: "नारायण निरौला", gender: "M", spouse_id: "nab", birth_bs: niraulaBirth }),
  person({ id: "nab", name: "नर्बदा निरौला", gender: "F", spouse_id: "nar", birth_bs: niraulaBirth }),
  person({ id: "dur", name: "दुर्गा निरौला बराल", gender: "F", father_id: "nar", mother_id: "nab", spouse_id: "dev" }),
  person({ id: "gop", name: "गोपाल बराल", gender: "M", birth_bs: "1950-01-01" }),
  person({ id: "dev", name: "देवी बराल", gender: "M", father_id: "gop", spouse_id: "dur", birth_bs: "1970-01-01" }),
  person({ id: "sar", name: "सरोज बराल", gender: "M", father_id: "dev", mother_id: "dur", birth_bs: "2040-01-01" }),
];

describe("married-in women belong to the husband's tree", () => {
  for (const nb of [undefined, "1900-01-01"]) {
    it(`Niraula root born ${nb ?? "unknown"}`, () => {
      const g = createGraph(make(nb));
      const { trees } = computeLayout(g, new Set());
      const ids = (n: (typeof trees)[number]): string[] => [n.p.id, ...n.sps.map((s) => s.id), ...n.all.flatMap(ids)];
      const has = (id: string) => trees.find((t) => ids(t).includes(id))!;
      const niraula = has("nar");
      const baral = has("gop");
      expect(niraula).not.toBe(baral);
      expect(ids(niraula)).not.toContain("sar");
      expect(ids(niraula)).not.toContain("dev");
      expect(ids(baral)).toEqual(expect.arrayContaining(["dev", "dur", "sar"]));
    });
  }
});
