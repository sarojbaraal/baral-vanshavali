// After submit_message succeeds, ask the notify-message edge function to e-mail it. Best effort: the message is already
// saved in the in-app inbox, so a mail failure must never show as an error to the sender.
import type { SupabaseClient } from "@supabase/supabase-js";

export function mailMessage(db: SupabaseClient, result: unknown): void {
  const id = (result as { id?: string } | null)?.id;
  if (!id) return;
  db.functions.invoke("notify-message", { body: { id } }).catch(() => {});
}
