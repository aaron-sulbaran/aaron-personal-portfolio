import { siteContent } from "@/lib/content";

export function Footer() {
  const { tagline, copyright } = siteContent.footer;
  return (
    <footer className="w-full border-t border-border/70 px-6 py-10 md:px-10 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 text-[12px] text-muted md:flex-row md:items-center md:justify-between">
        <p className="font-serif text-base italic text-foreground md:text-lg">{tagline}</p>
        <p className="tracking-wide">{copyright}</p>
      </div>
    </footer>
  );
}
