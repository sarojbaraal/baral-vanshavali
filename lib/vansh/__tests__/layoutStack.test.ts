import { describe, expect, it } from "vitest";
import { createGraph } from "../graph";
import { computeLayout, POSTER_DIMS } from "../layout";

const P = (id: string, name: string, o: Record<string, unknown> = {}) =>
  ({ id, name, gender: "M", father_id: null, mother_id: null, spouse_id: null, is_living: true, created_at: "1", ...o }) as never;

describe("layout: hanging column (vertical spine)", () => {
  it("a married daughter hangs from the spine herself; her husband sits beside her, not at the spine", () => {
    const ppl = [
      P("f", "बुबा"),
      P("s1", "छोरा१", { father_id: "f", created_at: "2" }),
      P("d", "छोरी", { gender: "F", father_id: "f", spouse_id: "h", created_at: "3" }),
      P("h", "ज्वाइँ", { spouse_id: "d", created_at: "9" }),
      P("s2", "छोरा२", { father_id: "f", created_at: "4" }),
      P("s3", "छोरा३", { father_id: "f", created_at: "5" }),
    ];
    const L = computeLayout(createGraph(ppl), new Set(), { ...POSTER_DIMS, stack: 4 });
    const x = (id: string) => L.cards.find((c) => c.p.id === id)!.x;
    expect(x("d")).toBe(x("s1")); // same column as the sons
    expect(x("h")).toBeGreaterThan(x("d")); // the son-in-law is beside her
  });
});
