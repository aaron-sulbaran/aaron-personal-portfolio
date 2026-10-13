import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuickBoard } from "@/components/quick/QuickBoard";
import { QuickHeader } from "@/components/quick/QuickHeader";
import { HOLDING_MODE } from "@/lib/holding";
import { quickCopy } from "@/lib/content/quick";

export const metadata: Metadata = {
  title: quickCopy.kicker,
  robots: { index: true, follow: true },
};

export default function QuickPage() {
  if (HOLDING_MODE) redirect("/");
  return (
    <main id="main" className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <style href="quick-print" precedence="medium">{`
        @media print {
          nav, footer, a.skip-link, [data-pill], [data-rush] { display: none !important; }
        }
      `}</style>
      <QuickHeader />
      <QuickBoard variant="ledger" />
    </main>
  );
}
