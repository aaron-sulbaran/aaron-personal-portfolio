import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExpressLane } from "@/components/quick/ExpressLane";
import { HOLDING_MODE } from "@/lib/holding";
import { quickCopy } from "@/lib/content/quick";

export const metadata: Metadata = {
  title: quickCopy.title,
  description: quickCopy.intro,
  robots: { index: true, follow: true },
};

// The MVP page, once the Express lane (docs/superpowers/specs/2026-10-13-express-lane-design.md):
// server-rendered whole, so every year, card and link reads at first paint; the
// rail's motion only follows scroll. It never imports the Coil, so the scene's
// chunk is never requested here.
export default function QuickPage() {
  if (HOLDING_MODE) redirect("/");
  return (
    <main id="main" className="mx-auto max-w-5xl px-6 pb-32 pt-32 md:pt-40">
      <style href="quick-print" precedence="medium">{`
        @media print {
          nav, footer, a.skip-link, [data-pill], [data-rush], [data-trip-bar] { display: none !important; }
        }
      `}</style>
      <ExpressLane visit />
    </main>
  );
}
