import { siteContent } from "@/lib/content";
import { lastUpdatedMonth } from "@/lib/buildDate";

export function Footer() {
  const { tagline, copyright } = siteContent.footer;
  return (
    <footer className="w-full border-t border-border px-6 py-10 md:px-10 md:pb-28 md:pt-14">
      <div data-wave-avoid className="mx-auto flex max-w-6xl flex-col gap-2 text-[12px] text-muted md:flex-row md:items-center md:justify-between">
        <p className="font-display text-base text-foreground md:text-lg">{tagline(lastUpdatedMonth())}</p>
        <p className="tracking-wide">{copyright}</p>
      </div>
    </footer>
  );
}
