import type { Metadata } from "next";
import { RecruitingDashboard } from "@/components/recruiting/RecruitingDashboard";
import { siteContent } from "@/lib/content";
import { profaBlack } from "@/lib/fonts";
import { loadRecruitingFeed } from "@/lib/recruiting/data";
import { formatStamp } from "@/lib/recruiting/format";

// Private dashboard. middleware.ts gates every request under /recruiting on
// the signed cookie; this page never consults NEXT_PUBLIC_SITE_MODE, so it is
// reachable while the holding page is up. ISR every 15 minutes (the feed is
// re-fetched on that cadence in lib/recruiting/data.ts); never indexed.
export const revalidate = 900;

export const metadata: Metadata = {
  title: "Recruiting",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function RecruitingPage() {
  const feed = await loadRecruitingFeed();
  const copy = siteContent.recruiting;

  return (
    <main id="main" className="relative min-h-screen px-6 pb-24 pt-20 md:px-10 md:pb-32 md:pt-28">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:gap-12">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{copy.label}</span>
            {feed && (
              <>
                <span aria-hidden="true">·</span>
                <span className="normal-case tracking-normal">
                  {feed.staleSince
                    ? `${copy.stalePrefix} ${formatStamp(feed.staleSince)}`
                    : `${copy.updatedPrefix} ${formatStamp(feed.data.generated)}`}
                </span>
              </>
            )}
          </div>
          <h1 className={`text-display-sm text-foreground ${profaBlack.className}`}>
            {feed ? copy.heading : copy.unavailable.heading}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            {feed ? copy.body : copy.unavailable.body}
          </p>
        </header>

        {feed && <RecruitingDashboard data={feed.data} />}
      </div>
    </main>
  );
}
