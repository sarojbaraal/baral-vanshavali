// Bikram Sambat helpers: AD → BS conversion (so dates can be typed in either calendar) and display in Nepali.
// Everything is stored and shown in BS; AD is only an input convenience.
import { adToBs, bsToAd } from "@sbmdkl/nepali-date-converter";
import { MONTHS_NE, ageN, bsYear, na, np } from "./text";

/** Range the conversion tables cover. */
export const AD_MIN_YEAR = 1924;
export const AD_MAX_YEAR = 2042;

const z = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" (AD) → "YYYY-MM-DD" (BS), or null when the date is invalid / outside the supported years. */
export function adToBsStr(ad: string): string | null {
  const [y, m, d] = na(ad).split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d || y < AD_MIN_YEAR || y > AD_MAX_YEAR) return null;
  try {
    return adToBs(`${y}-${z(m)}-${z(d)}`);
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD" (BS) → "YYYY-MM-DD" (AD), or null. */
export function bsToAdStr(bs: string): string | null {
  const [y, m, d] = na(bs).split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  try {
    return bsToAd(`${y}-${z(m)}-${z(d)}`);
  } catch {
    return null;
  }
}

/** Today's exact BS date [year, month, day] (falls back to null outside the table). */
export function todayBs(now: Date = new Date()): [number, number, number] | null {
  const s = adToBsStr(`${now.getFullYear()}-${z(now.getMonth() + 1)}-${z(now.getDate())}`);
  return s ? (s.split("-").map(Number) as [number, number, number]) : null;
}

/** Stored BS value → Nepali words and digits: "२०४४ बैशाख २२", "२०४४ बैशाख" or "२०४४". Empty → "". */
export function neDate(s?: string | null): string {
  if (!s) return "";
  const [y, m, d] = na(s).split("-").map((x) => parseInt(x, 10) || 0);
  if (!y) return np(s);
  return [np(y), m >= 1 && m <= 12 ? MONTHS_NE[m - 1] : "", m && d ? np(d) : ""].filter(Boolean).join(" ");
}

export const WEEKDAYS_NE = ["आइतबार", "सोमबार", "मङ्गलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];

/** Days until the next occurrence of a BS month/day birthday-style date from `today`, or null when unknown. */
export function daysUntilBs(stored: string | null | undefined, now: Date = new Date()): number | null {
  const [, m, d] = na(stored || "").split("-").map((x) => parseInt(x, 10) || 0);
  const t = todayBs(now);
  if (!t || !m || !d) return null;
  for (const yy of [t[0], t[0] + 1]) {
    const ad = bsToAdStr(`${yy}-${z(m)}-${z(d)}`);
    if (!ad) continue;
    const [ay, am, ad2] = ad.split("-").map(Number);
    const diff = Math.round((new Date(ay, am - 1, ad2).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5);
    if (diff >= 0) return diff;
  }
  return null;
}

/** Days in a BS month (from the conversion tables), or null outside them. */
function bsMonthDays(y: number, m: number): number | null {
  const a = bsToAdStr(`${y}-${z(m)}-01`);
  const b = m === 12 ? bsToAdStr(`${y + 1}-01-01`) : bsToAdStr(`${y}-${z(m + 1)}-01`);
  if (!a || !b) return null;
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** Exact age as years / months / days between two full BS dates (end defaults to today). Null when either date is incomplete. */
export function ageYMD(birth?: string | null, end?: string | null, now: Date = new Date()): { y: number; m: number; d: number } | null {
  const p = (x?: string | null) => na(x || "").split("-").map((v) => parseInt(v, 10) || 0);
  const [by, bm, bd] = p(birth);
  if (!by || !bm || !bd) return null;
  const e = end ? p(end) : todayBs(now);
  if (!e || !e[0] || !e[1] || !e[2]) return null;
  let [y, m, d] = [e[0] - by, e[1] - bm, e[2] - bd];
  if (d < 0) {
    m--;
    const pm = e[1] === 1 ? 12 : e[1] - 1;
    d += bsMonthDays(pm === 12 && e[1] === 1 ? e[0] - 1 : e[0], pm) ?? 30;
  }
  if (m < 0) { y--; m += 12; }
  return y < 0 ? null : { y, m, d };
}

/** "३५ वर्ष ४ महिना १२ दिन" (zero parts are left out). */
export function ageText(a: { y: number; m: number; d: number }): string {
  return [a.y ? `${np(a.y)} वर्ष` : "", a.m ? `${np(a.m)} महिना` : "", a.d ? `${np(a.d)} दिन` : ""].filter(Boolean).join(" ") || "० दिन";
}

/** "04:30" → "बिहान ४:३० बजे" */
export function neTime(t?: string | null): string {
  const m = /^(\d{2}):(\d{2})$/.exec(t || "");
  if (!m) return "";
  const h = +m[1];
  const part = h < 4 ? "राति" : h < 12 ? "बिहान" : h < 16 ? "दिउँसो" : h < 20 ? "साँझ" : "राति";
  return `${part} ${np(h % 12 || 12)}:${m[2].replace(/\d/g, (c) => np(c))} बजे`;
}

/** Date in words with its proof mark: "२०४५ भदौ १२ ✔ प्रमाणित" or "२०४५ भदौ १२ (अनुमानित)". Empty date → "". */
export function dateProof(date?: string | null, exact?: boolean | null): string {
  const t = neDate(date);
  return t ? `${t} ${exact ? "✔" : "(अनुमानित)"}` : "";
}

/** The age to show: years / months / days when the birth date is proven (and the end date too, for the dead), else whole years. */
export function ageLabel(p: { birth_bs?: string | null; death_bs?: string | null; birth_exact?: boolean | null; death_exact?: boolean | null; is_living?: boolean | null }, now: Date = new Date()): string {
  const living = p.is_living !== false;
  if (p.birth_exact && (living || p.death_exact)) {
    const a = ageYMD(p.birth_bs, living ? null : p.death_bs, now);
    if (a) return ageText(a);
  }
  const y = ageN(p.birth_bs, living ? null : p.death_bs, now);
  return y == null ? "" : `${np(y)} वर्ष`;
}

/** "२० वर्ष ३ महिना ५ दिन (६ वर्ष २ महिना अगाडि)": the age at death and how long ago. Whole years unless the dates are proven. Empty for the living. */
export function deceasedLine(p: { birth_bs?: string | null; death_bs?: string | null; birth_exact?: boolean | null; death_exact?: boolean | null; is_living?: boolean | null }, now: Date = new Date()): string {
  if (p.is_living !== false) return "";
  const atDeath = (() => {
    if (!p.birth_bs || !p.death_bs) return "";
    if (p.birth_exact && p.death_exact) {
      const a = ageYMD(p.birth_bs, p.death_bs, now);
      if (a) return ageText(a);
    }
    const y = ageN(p.birth_bs, p.death_bs, now);
    return y == null ? "" : `${np(y)} वर्ष`;
  })();
  const ago = (() => {
    if (!p.death_bs) return "";
    if (p.death_exact) {
      const a = ageYMD(p.death_bs, null, now);
      if (a) return `${ageText(a)} अगाडि`;
    }
    const d = parseInt(na(p.death_bs).slice(0, 4), 10);
    const y = d ? bsYear(now) - d : NaN;
    return y > 0 ? `${np(y)} वर्ष अगाडि` : y === 0 ? "यसै वर्ष" : "";
  })();
  return [atDeath, ago && `(${ago})`].filter(Boolean).join(" ");
}
