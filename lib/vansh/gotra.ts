// The shared gotra / ved / pravar facts belong to the बराल line only. Someone born into another family (e.g. a daughter-in-law
// born Niraula) has her own birth family's gotra, so those facts must not be shown or written for her.
import type { Graph } from "./graph";
import type { VPerson } from "./types";

/** Last word of a name, ignoring "(नयाँ)" notes and "<placeholder>" parts. */
export function lastWord(name?: string | null): string {
  const raw = String(name || "");
  const hadPlaceholder = /<[^>]*>/.test(raw); // "<प्रकाश छोरो> निरौला": the word after it is the surname
  const w = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return w.length > 1 || (hadPlaceholder && w.length === 1) ? w[w.length - 1] : "";
}

/** Surname the person was born with: a man's own; a woman's is her father's (her written surname is often her husband's). */
export function birthSurname(g: Graph, p: VPerson): string {
  if (p.gender === "F") {
    const f = p.father_id ? g.byId[p.father_id] : undefined;
    return f ? lastWord(f.name) : "";
  }
  return lastWord(p.name);
}

export const isBaralByBirth = (g: Graph, p: VPerson): boolean => birthSurname(g, p) === "बराल";
