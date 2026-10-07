import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { Block } from "./sections/Block";
import { Kicker } from "./sections/Kicker";
import { StickyColumn } from "./sections/StickyColumn";

// Stays a Server Component, in the sections lab's "beside" layout: the kicker
// and heading hold in the left column (sticky on desktop) while the items
// pass in one column on the right, each drawing its hairline and then rising
// out of its clip, in turn. `after` is the section's one mount point, full
// width below the items (metrics mounts ContributionSkyline there); without
// it nothing renders.
export function UpToNow({ after }: { after?: ReactNode } = {}) {
  const { label, heading, items } = siteContent.upToNow;
  return (
    <section id="up-to-now" aria-label={label} className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
        <StickyColumn className="md:col-span-5">
          <div className="flex flex-col gap-6">
            <Kicker label={label} />
            <Block kind="heading" as="h2" className="font-display text-section md:max-w-[12ch]">
              {heading}
            </Block>
          </div>
        </StickyColumn>
        <ol className="flex flex-col gap-12 md:col-span-7 md:gap-16">
          {items.map((item, i) => (
            <Block key={i} kind="item" as="li" index={i}>
              <div data-sections-hair aria-hidden="true" className="mb-5 h-px w-full origin-left bg-border md:mb-6" />
              <div className="-my-[0.15em] overflow-clip py-[0.15em]">
                <p data-sections-text className="text-lg leading-[1.55] text-foreground md:text-xl">
                  {item}
                </p>
              </div>
            </Block>
          ))}
        </ol>
      </div>
      {after ? (
        <div data-up-to-now-slot className="mx-auto mt-28 max-w-6xl md:mt-36">
          {after}
        </div>
      ) : null}
    </section>
  );
}
