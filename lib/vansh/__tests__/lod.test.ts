import { describe, expect, it } from "vitest";
import { lodOf } from "../lod";

describe("lodOf", () => {
  it("picks a level of detail from the zoom", () => {
    expect(lodOf(0.02)).toBe("far");
    expect(lodOf(0.27)).toBe("far");
    expect(lodOf(0.28)).toBe("mid");
    expect(lodOf(0.49)).toBe("mid");
    expect(lodOf(0.5)).toBe("near");
    expect(lodOf(2.5)).toBe("near");
  });
});
