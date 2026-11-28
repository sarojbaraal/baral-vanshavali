// The old preview dashboard read the people table directly and no longer works (access is through get_people only).
// The family tree, search and profiles all live in the app now.
import { redirect } from "next/navigation";

export default function PreviewMoved() {
  redirect("/app?tab=tree");
}
