import { siteContent } from "@/lib/content";

// About intro lifted from the former /about route. Anchors the #about jump
// target; WhoIAm, UpToNow, and Connect follow it in the document. Heading is an
// h2 to preserve the single-h1 hierarchy of the consolidated page.
export function AboutIntro() {
  const { label, heading, lede } = siteContent.about;

  return (
    <section
      id="about"
      aria-label={label}
      className="relative w-full scroll-mt-24 px-6 pb-16 pt-32 md:px-10 md:pb-24 md:pt-40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-10">
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
          <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
          <span>{label}</span>
        </div>
        <h2 className="font-serif text-[clamp(4rem,10vw,8rem)] italic leading-[0.95] tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="max-w-xl text-lg leading-[1.55] text-muted md:text-xl">
          {lede}
        </p>
      </div>
    </section>
  );
}
