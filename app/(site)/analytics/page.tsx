// The old analytics page called an RPC that no longer exists and showed sample numbers when it failed.
// Never show invented figures: send people to the app, which computes everything from the real (masked) data.
import { redirect } from "next/navigation";

export default function AnalyticsMoved() {
  redirect("/app");
}
