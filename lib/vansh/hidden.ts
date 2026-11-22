// "लुकाइएको सदस्य": an admin can hide a person. The server never sends them to anyone but an admin acting as admin, and
// anything that leaves the screen (printed charts, life-sheets, wall posters, PDF/Excel for people) is built from
// printable(): hidden people are dropped, and every link to them (parent, spouse) is cut, so they appear nowhere.
import type { VPerson } from "./types";

export const isHidden = (p?: VPerson | null): boolean => !!p?.hidden;

export function printable(people: VPerson[]): VPerson[] {
  const hid = new Set(people.filter((p) => p.hidden).map((p) => p.id));
  if (!hid.size) return people;
  return people
    .filter((p) => !hid.has(p.id))
    .map((p) => {
      const touched =
        (p.father_id && hid.has(p.father_id)) ||
        (p.mother_id && hid.has(p.mother_id)) ||
        (p.spouse_id && hid.has(p.spouse_id)) ||
        p.more_spouse_ids?.some((i) => hid.has(i));
      if (!touched) return p;
      return {
        ...p,
        father_id: p.father_id && hid.has(p.father_id) ? null : p.father_id,
        mother_id: p.mother_id && hid.has(p.mother_id) ? null : p.mother_id,
        spouse_id: p.spouse_id && hid.has(p.spouse_id) ? null : p.spouse_id,
        more_spouse_ids: p.more_spouse_ids ? p.more_spouse_ids.filter((i) => !hid.has(i)) : p.more_spouse_ids,
      };
    });
}
