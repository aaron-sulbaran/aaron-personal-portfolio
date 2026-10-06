import { siteContent } from "@/lib/content";
import { Kicker } from "./Kicker";
import type { KickerFace } from "./settings";

// A static copy of components/AboutIntro.tsx with its <Reveal> classes
// replaced by the lab's block markers. Same classes, same layout.
export function AboutCopy({ face }: { face: KickerFace }) {
  const { label, heading, lede } = siteContent.about;
  return (
    <section
      id="about"
      aria-label={label}
      data-sl-section="about"
      className="relative w-full scroll-mt-24 px-6 pb-16 pt-32 md:px-10 md:pb-24 md:pt-40"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-10">
        <Kicker label={label} face={face} />
        <h2 data-sl-block="heading" data-wave-avoid className="font-display text-display-xl text-foreground">
          <span data-sl-inner className="block">
            {heading}
          </span>
        </h2>
        <p data-sl-block="body" data-wave-avoid className="max-w-xl text-lg leading-[1.55] text-muted md:text-xl">
          {lede}
        </p>
      </div>
    </section>
  );
}
