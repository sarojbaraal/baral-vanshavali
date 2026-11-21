"use client";
// The signed-in member's data for the public home page (which has no app provider): profile + the people they may see.
// One request is shared by everything on the page; `reload` fetches again after something changed (e.g. a new story).
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { myRoles } from "@/lib/vansh/graph";
import { clearAuthHint } from "@/lib/vansh/authHint";
import type { VPerson, VProfile } from "@/lib/vansh/types";

export interface MemberData {
  name: string;
  people: VPerson[];
  meId: string | null;
  /** acting role is admin or moderator */
  staff: boolean;
}

let cache: Promise<MemberData | null> | null = null;

async function load(): Promise<MemberData | null> {
  const db = createClient();
  const { data } = await db.auth.getSession();
  if (!data.session) return null;
  const { data: pr } = await db.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
  const p = pr as VProfile | null;
  if (!p || p.suspended_at) return null;
  const rs = myRoles(p) as string[];
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("vv_role");
  } catch {}
  const role = saved && rs.includes(saved) ? saved : rs[0] || null;
  const { data: ppl, error } = await db.rpc("get_people", { p_role: role, p_as_person: null });
  if (error) return null;
  return { name: p.full_name || "", people: (ppl as VPerson[]) || [], meId: p.position_person_id || null, staff: role === "admin" || role === "moderator" };
}

export function useMember(): { d: MemberData | null; reload: () => Promise<void> } {
  const [d, setD] = useState<MemberData | null>(null);
  useEffect(() => {
    let off = false;
    (cache ||= load().catch(() => null)).then((x) => {
      if (!x) clearAuthHint(); // no session: the signed-out page may show
      if (!off) setD(x);
    });
    return () => {
      off = true;
    };
  }, []);
  const reload = useCallback(async () => {
    cache = load().catch(() => null);
    setD(await cache);
  }, []);
  return { d, reload };
}
