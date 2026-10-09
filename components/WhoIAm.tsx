import { siteContent } from "@/lib/content";
import { InlineCopy } from "./inline/InlineCopy";
import { Block } from "./sections/Block";
import { Kicker } from "./sections/Kicker";
import { StickyColumn } from "./sections/StickyColumn";

const BODY = "text-balance text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]";
const SUB_BODY = "text-balance text-lg leading-[1.6] text-foreground md:text-xl md:leading-[1.55]";

// Stays a Server Component, and is the page's #about (the About screen is
// gone). The label, the lowercase heading and the small print hold (sticky,
// desktop) while the labeled blocks pass, each block's label drawing its rule
// and its words masking in line by line.
export function WhoIAm() {
  const { label, heading, blocks, smallPrint } = siteContent.whoIAm;
  return (
    <section id="about" aria-label={label} className="relative w-full scroll-mt-24 px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-12 md:gap-16">
        <StickyColumn className="md:col-span-4">
          <div className="flex flex-col gap-6">
            <Kicker label={label} />
            <Block kind="heading" as="h2" className="font-display text-section">
              {heading}
            </Block>
            <Block kind="body" as="p" split="block" className="max-w-xs text-sm leading-relaxed text-muted">
              <span data-sections-inner className="block">
                {smallPrint}
              </span>
            </Block>
          </div>
        </StickyColumn>
        <div className="flex flex-col gap-14 md:col-span-8 md:gap-20">
          {blocks.map((block) => (
            <div key={block.label} className="flex flex-col gap-5">
              <Kicker label={block.label} />
              <Block kind="body" as="p" className={BODY}>
                <InlineCopy source={block.body} />
              </Block>
              {block.sub && (
                <div className="mt-2 flex flex-col gap-4">
                  <Kicker label={block.sub.label} />
                  <Block kind="body" as="p" className={SUB_BODY}>
                    <InlineCopy source={block.sub.body} />
                  </Block>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
