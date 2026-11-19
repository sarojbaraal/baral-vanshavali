import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import HistoryPage from "@/components/history/HistoryPage";

export const metadata: Metadata = {
  title: "इतिहास",
  description: "घृतकौशिक गोत्रीय बराल वंशको उत्पत्ति, चार थर, हस्तलिखित वंशवृक्ष र फैलावट — प्रमाणको स्तरसहित।",
};

export default function Page() {
  return (
    <PageShell active="history">
      <HistoryPage />
    </PageShell>
  );
}
