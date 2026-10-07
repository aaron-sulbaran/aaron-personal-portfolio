import { siteContent } from "@/lib/content";
import { Block } from "./sections/Block";
import { Kicker } from "./sections/Kicker";

// About intro, the #about jump target; WhoIAm, UpToNow and Connect follow it.
// The heading is an h2 under the page's single h1. Stays a Server Component;
// the heading and lede each mask in as one block (Aaron's pick).
export function AboutIntro() {
  const { label, heading, lede } = siteContent.about;
  return (
    <section id="about" aria-label={label} className="relative w-full scroll-mt-24 px-6 pb-16 pt-32 md:px-10 md:pb-24 md:pt-40">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-10">
        <Kicker label={label} />
        <Block kind="heading" as="h2" split="block" className="font-display text-display-xl text-foreground">
          <span data-sections-inner className="block">
            {heading}
          </span>
        </Block>
        <Block kind="body" as="p" split="block" className="max-w-xl text-lg leading-[1.55] text-muted md:text-xl">
          <span data-sections-inner className="block">
            {lede}
          </span>
        </Block>
      </div>
    </section>
  );
}
