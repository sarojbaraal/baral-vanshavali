// Free replacement for Supabase's "leaked password protection" (a Pro-plan feature).
// Uses the public HaveIBeenPwned range API: only the first 5 characters of the password's SHA-1 are sent, never the
// password itself. If the service cannot be reached the check is skipped, so signing up never breaks because of it.
export const PWNED_MSG = "यो पासवर्ड इन्टरनेटमा चोरी भएका पासवर्डको सूचीमा भेटियो। कृपया अर्को पासवर्ड रोज्नुहोस्।";

/** Number of times the password appears in known breaches (0 = not found, or the check could not run). */
export async function pwnedCount(password: string): Promise<number> {
  try {
    if (!password || typeof crypto === "undefined" || !crypto.subtle) return 0;
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
    const hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return 0;
    const rest = hex.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [suffix, n] = line.trim().split(":");
      if (suffix === rest) return Number(n) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
