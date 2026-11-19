// The facts shown on a person's profile and on the printed life-sheet (only what is recorded and visible).
import type { Graph } from "./graph";
import type { VPerson } from "./types";
import { neDate } from "./bs";
import { ageN, maritalLabel, np } from "./text";

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
  const age = ageN(p.birth_bs, p.death_bs);
  add("जन्म मिति (वि.सं.)", neDate(p.birth_bs) + (age !== null && p.is_living !== false ? ` · उमेर ${np(age)} वर्ष` : ""));
  add("जन्म स्थान", p.birth_place);
  if (p.is_living === false) {
    add("मृत्यु मिति (वि.सं.)", neDate(p.death_bs) || "दिवङ्गत");
    add("मृत्यु स्थान", p.death_place);
  }
  add("हालको ठेगाना", p.is_living === false ? "" : g.addrOf(p));
  add("शिक्षा", p.education);
  add("पेशा", p.occupation);
  add("कार्यरत संस्था", p.organization);
  add("बैवाहिक स्थिति", p.marital_status && p.marital_status !== "unknown" ? maritalLabel(p.marital_status) : "");
  add("विवाह मिति (वि.सं.)", neDate(p.marriage_bs));
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
