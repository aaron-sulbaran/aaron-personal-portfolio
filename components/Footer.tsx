import { siteContent } from "@/lib/content";
import { lastUpdatedMonth } from "@/lib/buildDate";

// `dock`: the home page's playback pill docks over the page end from md up,
// so the footer's bottom padding keeps its last row clear of the capsule.
export function Footer({ dock = false }: { dock?: boolean }) {
  const { tagline, copyright } = siteContent.footer;
  const clearance = dock ? "md:pb-28 md:pt-14" : "md:py-14";
  return (
    <footer className={`w-full border-t border-border px-6 py-10 md:px-10 ${clearance}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-[12px] text-muted md:flex-row md:items-center md:justify-between">
        <p className="font-display text-base text-foreground md:text-lg">{tagline(lastUpdatedMonth())}</p>
        <p className="tracking-wide">{copyright}</p>
      </div>
    </footer>
  );
}
