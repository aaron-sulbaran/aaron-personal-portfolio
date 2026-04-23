import { siteContent } from "@/lib/content";

export function WhoIAm() {
  const { label, paragraph } = siteContent.whoIAm;
  return (
    <section
      id="about"
      aria-label={label}
      className="relative w-full px-6 py-24 md:px-10 md:py-40"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-4">
          <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{label}</span>
          </div>
        </div>
        <div className="md:col-span-8">
          <p className="text-balance text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]">
            {paragraph}
          </p>
        </div>
      </div>
    </section>
  );
}
