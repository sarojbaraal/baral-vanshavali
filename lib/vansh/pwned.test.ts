import { describe, it, expect, vi, afterEach } from "vitest";
import { pwnedCount } from "./pwned";

afterEach(() => vi.unstubAllGlobals());

describe("pwnedCount", () => {
  it("finds the password's hash suffix and sends only a 5-character prefix", async () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const f = vi.fn().mockResolvedValue({ ok: true, text: async () => "0000000000000000000000000000000000A:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n" });
    vi.stubGlobal("fetch", f);
    expect(await pwnedCount("password")).toBe(9545824);
    expect(f.mock.calls[0][0]).toBe("https://api.pwnedpasswords.com/range/5BAA6");
  });
  it("0 when not listed, and 0 (skip) when the service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "ABCDE:1\r\n" }));
    expect(await pwnedCount("a-very-unlikely-passphrase-91823")).toBe(0);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await pwnedCount("password")).toBe(0);
  });
});
