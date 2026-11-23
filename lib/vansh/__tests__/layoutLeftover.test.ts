import { describe, expect, it } from "vitest";
import { createGraph } from "../graph";
import { computeLayout } from "../layout";

const P = (id: string, name: string, o: Record<string, unknown> = {}) =>
  ({ id, name, gender: "M", father_id: null, mother_id: null, spouse_id: null, is_living: true, created_at: "1", ...o }) as never;

describe("layout: people the roots could not reach", () => {
  it("a descendant listed before his elder is drawn once, below him", () => {
    // A's father is a record that is not in the list, so neither is a root; the child is listed first.
    const ppl = [P("c", "सरोज", { father_id: "b" }), P("b", "देवी", { father_id: "a" }), P("a", "त्रैलोक्य", { father_id: "gone" })];
    const L = computeLayout(createGraph(ppl), new Set());
    const n = (id: string) => L.cards.filter((c) => c.p.id === id);
    expect(n("a")).toHaveLength(1);
    expect(n("b")).toHaveLength(1);
    expect(n("c")).toHaveLength(1);
    expect(n("c")[0].d).toBe(n("a")[0].d + 2);
    expect(L.trees).toHaveLength(1);
  });
});
