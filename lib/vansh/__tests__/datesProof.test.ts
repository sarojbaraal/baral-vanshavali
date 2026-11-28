import { describe, expect, it } from "vitest";
import { ageLabel, ageText, ageYMD, dateProof, neTime } from "../bs";
import { createGraph } from "../graph";
import { withFatherSurname } from "../text";
import { buildKidRequests } from "../requests";

const P = (id: string, name: string, o: Record<string, unknown> = {}) =>
  ({ id, name, gender: "M", father_id: null, mother_id: null, spouse_id: null, is_living: true, created_at: "1", ...o }) as never;

describe("proven dates, age in years / months / days, birth time", () => {
  it("counts years, months and days between two BS dates", () => {
    const a = ageYMD("2045-05-12", "2080-07-20")!;
    expect(a).toEqual({ y: 35, m: 2, d: 8 });
    expect(ageText(a)).toBe("३५ वर्ष २ महिना ८ दिन");
  });
  it("borrows the days of the previous BS month", () => {
    const a = ageYMD("2045-05-28", "2080-07-03")!;
    expect(a.y).toBe(35);
    expect(a.m).toBe(1);
    expect(a.d).toBeGreaterThan(3);
    expect(a.d).toBeLessThan(10);
  });
  it("needs a full date", () => {
    expect(ageYMD("2045-00-00", "2080-07-20")).toBeNull();
  });
  it("shows y/m/d only for a proven birth date, whole years otherwise", () => {
    const base = { birth_bs: "2045-05-12", death_bs: "2080-07-20", is_living: false };
    expect(ageLabel({ ...base, birth_exact: true, death_exact: true })).toBe("३५ वर्ष २ महिना ८ दिन");
    expect(ageLabel({ ...base, birth_exact: true, death_exact: false })).toBe("३५ वर्ष");
    expect(ageLabel({ ...base })).toBe("३५ वर्ष");
  });
  it("marks a date proven or estimated", () => {
    expect(dateProof("2045-05-12", true)).toContain("✔");
    expect(dateProof("2045-05-12", false)).toContain("अनुमानित");
    expect(dateProof("", true)).toBe("");
  });
  it("writes the birth time in words", () => {
    expect(neTime("04:30")).toBe("बिहान ४:३० बजे");
    expect(neTime("14:05")).toBe("दिउँसो २:०५ बजे");
    expect(neTime("")).toBe("");
  });
});

describe("defaults", () => {
  it("a child with a first name only takes the father's surname", () => {
    expect(withFatherSurname("सरोज", "हरि प्रसाद बराल")).toBe("सरोज बराल");
    expect(withFatherSurname("सरोज खनाल", "हरि बराल")).toBe("सरोज खनाल");
    expect(withFatherSurname("सरोज", "हरि")).toBe("सरोज");
  });
  it("kids added from the form get the father's surname", () => {
    const me = { id: "u" } as never;
    const par = P("f", "हरि बराल");
    const r = buildKidRequests(me, par, "", [{ name: "सीता", gender: "F", is_living: true, birth_bs: "", birth_place: "", married: false, spouse: "" }], "", 1, "हरि बराल");
    expect(r.requests![0].payload.name).toBe("सीता बराल");
  });
  it("the current address falls back to the birth place", () => {
    const g = createGraph([P("a", "क", { birth_place: "गोरखा" }), P("b", "ख", { address: "काठमाडौं", birth_place: "गोरखा" })]);
    expect(g.addrOf(g.byId.a)).toBe("गोरखा");
    expect(g.addrOf(g.byId.b)).toBe("काठमाडौं");
  });
});

import { deceasedLine } from "../bs";
describe("deceasedLine", () => {
  const dead = { is_living: false, birth_bs: "2000-01-15", death_bs: "2020-03-10" };
  it("proven dates: age at death in years / months / days and how long ago", () => {
    const l = deceasedLine({ ...dead, birth_exact: true, death_exact: true }, new Date("2026-06-01"));
    expect(l).toMatch(/^२० वर्ष [०-९]+ महिना( [०-९]+ दिन)? \([०-९]+ वर्ष.* अगाडि\)$/);
    expect(l).toContain("२० वर्ष १ महिना");
  });
  it("estimated dates: whole years only", () => {
    const l = deceasedLine(dead, new Date("2026-06-01"));
    expect(l.startsWith("२० वर्ष (")).toBe(true);
    expect(l).toContain("वर्ष अगाडि)");
    expect(l).not.toContain("महिना");
  });
  it("nothing for the living", () => {
    expect(deceasedLine({ is_living: true, birth_bs: "2000-01-15" })).toBe("");
  });
});
