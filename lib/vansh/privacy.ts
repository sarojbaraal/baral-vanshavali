import { np } from "./text";
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

/** names of the fields a member can ask for (same list as the server's lockable_fields) */
export const FIELD_LABEL: Record<string, string> = {
  phone: "फोन नम्बर", address: "ठेगाना", facebook: "Facebook", birth_bs: "जन्ममिति", birth_time: "जन्म समय",
  birth_place: "जन्मस्थान", photo_url: "फोटो", marriage_bs: "विवाह मिति", divorce_bs: "सम्बन्ध विच्छेद मिति",
  education: "शिक्षा", occupation: "पेशा", organization: "कार्यरत संस्था",
};
export const fieldLabel = (k: string) => FIELD_LABEL[k] || k;

/** "२४ घण्टाभित्र" / "सधैं" for a grant */
export function grantLabel(expires: string | null | undefined, now = Date.now()): string {
  if (!expires) return "सधैं";
  const h = Math.ceil((new Date(expires).getTime() - now) / 3600e3);
  return h <= 1 ? "१ घण्टाभित्र सकिन्छ" : `करिब ${np(String(h))} घण्टा बाँकी`;
}

export const REQUEST_STATUS: Record<string, string> = {
  pending: "पर्खाइमा", approved: "स्वीकृत", denied: "अस्वीकृत", cancelled: "रद्द",
};
