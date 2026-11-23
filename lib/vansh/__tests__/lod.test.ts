import { describe, expect, it } from "vitest";
import { lodOf } from "../lod";

describe("lodOf", () => {
  it("picks a level of detail from the zoom: tile / name / photo+first name / full card", () => {
    expect(lodOf(0.02)).toBe("far");
    expect(lodOf(0.099)).toBe("far");
    expect(lodOf(0.1)).toBe("name");
    expect(lodOf(0.299)).toBe("name");
    expect(lodOf(0.3)).toBe("face");
    expect(lodOf(0.499)).toBe("face");
    expect(lodOf(0.5)).toBe("near");
    expect(lodOf(2.5)).toBe("near");
  });
});
