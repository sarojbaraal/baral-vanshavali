// Types for the Vansavali app. Mirrors the shape returned by the `get_people` RPC.

export type Gender = "M" | "F" | "O" | "" | null;
export type Role = "admin" | "moderator" | "premium" | "general";
export type TabKey = "me" | "fam" | "tree" | "mem" | "mine" | "admin" | "ov" | "pf";

/** unknown is the default; married / divorced show the spouse block in the edit form. */
export type MaritalStatus = "married" | "unmarried" | "divorced" | "unknown";

/** A PDF kept in the private `person-docs` bucket (handwriting, written works). `path` is the object key. */
export interface PersonDoc {
  path: string;
  name: string;
  size: number;
}

export interface VPerson {
  id: string;
  name: string;
  gender: string | null;
  father_id: string | null;
  mother_id: string | null;
  spouse_id: string | null;
  more_spouse_ids?: string[] | null;
  is_living: boolean;
  birth_bs?: string | null;
  death_bs?: string | null;
  /** ✔ the date is proven (documents / certain); otherwise it is an estimate */
  birth_exact?: boolean | null;
  death_exact?: boolean | null;
  marriage_exact?: boolean | null;
  /** "HH:MM" (24 h), when the birth time is known */
  birth_time?: string | null;
  divorce_bs?: string | null;
  divorce_exact?: boolean | null;
  /** तिथि of the death, free text */
  death_tithi?: string | null;
  death_reason?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  maiden_name?: string | null;
  married_name?: string | null;
  birth_place?: string | null;
  death_place?: string | null;
  education?: string | null;
  occupation?: string | null;
  marriage_bs?: string | null;
  marital_status?: MaritalStatus | null;
  /** workplace / organisation (next to education and occupation) */
  organization?: string | null;
  documents?: PersonDoc[] | null;
  email?: string | null;
  facebook?: string | null;
  photo_url?: string | null;
  /** long biography (AI-written until a person edits it) */
  bio?: string | null;
  bio_ai?: boolean | null;
  bio_at?: string | null;
  /** newer AI text waiting for the person to accept (never replaces a self-written bio) */
  bio_draft?: string | null;
  /** facts the AI learned from the self-written bio, reused in later drafts */
  bio_facts?: string[] | null;
  /** who may see each field (owner only): "all" | "near" (branch) | "family" (immediate) | "me" (person + admins); absent = site default */
  privacy?: Record<string, "all" | "near" | "family" | "me"> | null;
  /** fields that exist but are hidden from the viewer ("🔒 गोप्य"); filled by get_people for other people's cards */
  locked_fields?: string[] | null;
  ai_summary?: string | null;
  /** Second-person "तपाईंको कथा" for the person's own home screen. */
  ai_summary_self?: string | null;
  ai_summary_self_at?: string | null;
  ai_tags?: string[] | null;
  is_locked?: boolean;
  /** an admin has hidden this person: only an admin (as admin) is sent them, and nothing printed or exported contains them */
  hidden?: boolean;
  name_only?: boolean;
  created_at: string;
}

export interface VProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null; // legacy: admin | member | pending
  roles?: string[] | null;
  position_person_id?: string | null;
  position_parent_id?: string | null;
  position_grand_id?: string | null;
  claim_father?: string | null;
  claim_grand?: string | null;
  birth_bs?: string | null;
  phone?: string | null;
  location?: string | null;
  suspended_at?: string | null;
  email_reminders?: boolean | null;
  custom_anchor?: { target_id: string; relation_type: string } | null;
}

export type RequestAction = "add" | "update" | "delete";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  requested_by: string;
  action: RequestAction;
  person_id: string | null;
  payload: Record<string, unknown> | null;
  note: string | null;
  status: RequestStatus;
  reject_reason?: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

/** A change_requests row ready to be inserted. */
export interface NewRequest {
  requested_by: string;
  action: RequestAction;
  person_id: string | null;
  payload: Record<string, unknown>;
  note: string | null;
}
