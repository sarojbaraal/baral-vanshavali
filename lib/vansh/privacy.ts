// Owner-controlled field privacy. The same rules as the server's get_people (supabase/migrations/20261127*.sql):
// the settings preview uses canSee() so it never promises more than the server gives.
export type Level = "all" | "near" | "family" | "me";
export type FieldKey =
  | "phone" | "address" | "facebook" | "birth_bs" | "birth_place" | "photo_url"
  | "marriage_bs" | "divorce_bs" | "education" | "occupation" | "organization";
export type Viewer = "family" | "branch" | "far" | "trusted";

/** what a field is when the owner has not chosen: phone and address stay close, the rest is open */
export const DEFAULT: Partial<Record<FieldKey, Level>> = { phone: "near", address: "near" };
const CONTACT: FieldKey[] = ["phone", "address"];

/** Can this viewer see the field, given what the owner chose (undefined = not chosen)? */
export function canSee(k: FieldKey, level: Level | undefined, viewer: Viewer): boolean {
  if (level === "me") return false;
  if (level === "family") return viewer === "family";
  if (level === "near") return viewer === "family" || viewer === "branch";
  if (level === "all") return true;
  // not chosen: contact details stay hidden from ordinary members, trusted roles see them
  if (CONTACT.includes(k)) return viewer === "trusted";
  return true;
}
