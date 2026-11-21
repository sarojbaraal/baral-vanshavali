import { describe, expect, it } from "vitest";
import { person } from "./fixtures";
import { createGraph } from "../graph";
import { birthSurname, isBaralByBirth, lastWord } from "../gotra";

describe("gotra applies to Baral by birth only", () => {
  const g = createGraph([
    person({ id: "f1", name: "नारायण प्रसाद निरौला", gender: "M" }),
    person({ id: "w1", name: "दुर्गा कुमारी निरौला बराल", gender: "F", father_id: "f1" }),
    person({ id: "f2", name: "सुदामा बराल", gender: "M" }),
    person({ id: "d2", name: "अञ्जु बराल निरौला", gender: "F", father_id: "f2" }),
    person({ id: "m1", name: "सरोज बराल", gender: "M" }),
    person({ id: "x1", name: "अनिता निरौला (नयाँ)", gender: "F" }),
  ]);
  it("a woman takes her father's surname", () => {
    expect(birthSurname(g, g.byId.w1)).toBe("निरौला");
    expect(isBaralByBirth(g, g.byId.w1)).toBe(false);
    expect(isBaralByBirth(g, g.byId.d2)).toBe(true);
  });
  it("a man takes his own; unknown stays unknown", () => {
    expect(isBaralByBirth(g, g.byId.m1)).toBe(true);
    expect(isBaralByBirth(g, g.byId.x1)).toBe(false);
  });
  it("ignores notes and placeholders", () => {
    expect(lastWord("अनिता निरौला (नयाँ)")).toBe("निरौला");
    expect(lastWord("<प्रकाश छोरो> निरौला")).toBe("निरौला");
  });
});
