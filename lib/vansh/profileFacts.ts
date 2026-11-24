// The facts shown on a person's profile and on the printed life-sheet (only what is recorded and visible).
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { ageLabel, dateProof, neTime } from "./bs";
import { maritalLabel } from "./text";

export interface Fact {
  k: string;
  v: string;
}

export function profileFacts(g: Graph, p: VPerson, opts: { showEmail?: boolean; nm?: (p: VPerson) => string } = {}): Fact[] {
  const out: Fact[] = [];
  const add = (k: string, v?: string | null) => {
    const t = (v || "").toString().trim();
    if (t) out.push({ k, v: t });
  };
  const age = ageLabel(p);
  add("जन्म मिति (वि.सं.)", dateProof(p.birth_bs, p.birth_exact) + (age && p.is_living !== false ? ` · उमेर ${age}` : ""));
  add("जन्म समय", neTime(p.birth_time));
  add("जन्म स्थान", p.birth_place);
  if (p.is_living === false) {
    add("मृत्यु मिति (वि.सं.)", dateProof(p.death_bs, p.death_exact) || "दिवङ्गत");
    if (p.birth_exact && p.death_exact && age) add("मृत्युमा उमेर", age);
    add("मृत्यु स्थान", p.death_place);
  }
  add("हालको ठेगाना", p.is_living === false ? "" : g.addrOf(p));
  add("शिक्षा", p.education);
  add("पेशा", p.occupation);
  add("कार्यरत संस्था", p.organization);
  add("बैवाहिक स्थिति", p.marital_status && p.marital_status !== "unknown" ? maritalLabel(p.marital_status) : "");
  add("विवाह मिति (वि.सं.)", dateProof(p.marriage_bs, p.marriage_exact));
  const sp = g.spousesOf(p).map((id) => g.byId[id]).filter(Boolean);
  add(p.gender === "F" ? "पति" : p.gender === "M" ? "पत्नी" : "जीवनसाथी", sp.map((x) => (opts.nm ? opts.nm(x) : x.name)).join(", "));
  add("फोन", p.phone);
  if (opts.showEmail) add("इमेल", p.email);
  return out;
}

/** "हरि बराल → राम बराल → …" style lineage line, oldest first, up to `max` fathers. */
export function fatherLine(g: Graph, p: VPerson, nm: (p: VPerson) => string, max = 6): string[] {
  const names: string[] = [];
  let cur: VPerson | undefined = p;
  while (cur && names.length < max) {
    names.unshift(nm(cur));
    cur = cur.father_id ? g.byId[cur.father_id] : undefined;
  }
  return names;
}
