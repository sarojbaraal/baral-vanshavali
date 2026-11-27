import { describe, expect, it } from "vitest";
import { canSee, type Viewer } from "./privacy";

const ALL: Viewer[] = ["family", "branch", "far", "trusted"];
const who = (k: Parameters<typeof canSee>[0], l: Parameters<typeof canSee>[1]) => ALL.filter((v) => canSee(k, l, v));

describe("canSee (mirrors get_people)", () => {
  it("'me' hides from everyone", () => expect(who("birth_bs", "me")).toEqual([]));
  it("'family' reaches only the family", () => expect(who("education", "family")).toEqual(["family"]));
  it("'near' reaches family and branch, not far members", () => expect(who("phone", "near")).toEqual(["family", "branch"]));
  it("'all' reaches everyone, even for contact fields (owner opt-in)", () => expect(who("address", "all")).toEqual(ALL));
  it("unset contact fields are seen by trusted roles only", () => {
    expect(who("phone", undefined)).toEqual(["trusted"]);
    expect(who("address", undefined)).toEqual(["trusted"]);
  });
  it("unset non-contact fields are open", () => expect(who("birth_bs", undefined)).toEqual(ALL));
});

import { grantLabel, fieldLabel } from "./privacy";
describe("grant wording", () => {
  const now = Date.UTC(2026, 10, 28, 0, 0, 0);
  it("always when there is no expiry", () => expect(grantLabel(null, now)).toBe("सधैं"));
  it("hours left for a once-grant", () => expect(grantLabel(new Date(now + 5 * 3600e3 - 60e3).toISOString(), now)).toBe("करिब ५ घण्टा बाँकी"));
  it("last hour", () => expect(grantLabel(new Date(now + 20 * 60e3).toISOString(), now)).toBe("१ घण्टाभित्र सकिन्छ"));
  it("labels fall back to the key", () => {
    expect(fieldLabel("phone")).toBe("फोन नम्बर");
    expect(fieldLabel("zzz")).toBe("zzz");
  });
});
