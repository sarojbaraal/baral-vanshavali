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
