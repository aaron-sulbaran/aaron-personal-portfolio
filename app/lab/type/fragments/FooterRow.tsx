import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// components/Footer.tsx: the tagline (display, stays Profa Black) and the
// copyright, the one tracked label on the site.
export function FooterRow({ month }: { month: string }) {
  const { tagline, copyright } = siteContent.footer;
  return (
    <footer className="w-full border-t border-border py-10 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-[12px] text-muted md:flex-row md:items-center md:justify-between">
        <p className="font-display text-base text-foreground md:text-lg">{tagline(month)}</p>
        <p className="tracking-wide" {...role("credit", 12)}>
          {copyright}
        </p>
      </div>
    </footer>
  );
}
