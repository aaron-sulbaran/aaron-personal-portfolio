import { siteContent } from "@/lib/content";
import { Block } from "./sections/Block";
import { Kicker } from "./sections/Kicker";
import { StickyColumn } from "./sections/StickyColumn";

// Stays a Server Component. The label holds (sticky, desktop) while the
// paragraph passes, the paragraph masking in line by line.
export function WhoIAm() {
  const { label, paragraph } = siteContent.whoIAm;
  return (
    <section id="who-i-am" aria-label={label} className="relative w-full scroll-mt-24 px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-12 md:gap-16">
        <StickyColumn className="md:col-span-4">
          <Kicker label={label} />
        </StickyColumn>
        <div className="md:col-span-8">
          <Block kind="body" as="p" className="text-balance text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]">
            {paragraph}
          </Block>
        </div>
      </div>
    </section>
  );
}
