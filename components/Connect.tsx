import { Fragment } from "react";
import { BrandIcon } from "@/components/BrandIcons";
import { Fill, FillArrow, FillSeed } from "@/components/fx/Fill";
import { splitAfterAt } from "@/lib/connect";
import { siteContent } from "@/lib/content";
import { CTA_CLASS, CTA_OVER_CLASS, FILL_PICK } from "@/lib/fx/fill";
import { InlineCopy } from "./inline/InlineCopy";
import { Block } from "./sections/Block";
import { SectionHeading } from "./sections/SectionTitle";

// Measured, not guessed: an address fits one line at 2xl from 1024 and at 3xl
// from 1280; below 1024 even 2xl's "name@" outgrows the cell, so it is xl and
// wraps after the at sign. break-words only ever acts on a cell narrower than
// any segment (a 360px phone). The arrow's box is one line of the value tall,
// so it sits centered on the first line whether or not the value wraps. On a
// phone the label column is narrow and the value a step smaller below 400px,
// so "@imaaronsulbaran" (the longest handle) stays on one line from 360 up.
const VALUE_SIZE = "text-lg min-[400px]:text-xl lg:text-2xl xl:text-3xl";

// A mailto opens in place; every web link opens in a new tab.
const isWeb = (href: string) => href.startsWith("https://");

function breakAfterAt(value: string) {
  return splitAfterAt(value).map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}

// Stays a Server Component. The heading and body arrive by the sections
// grammar, line by line; the section's label names the landmark (aria-label)
// and the nav, and is not drawn, since the heading says it; "Book some time" is the
// one big link and lifts out of its clip as a single-row block; the link list
// is one block whose rows draw their rules and lift out of a clip in turn.
// The rule under each link is this section's, so the row's Fill rises from
// line 0.
export function Connect() {
  const { label, heading, body, primary, links } = siteContent.connect;
  return (
    <section id="connect" data-wave-anchor="connect" aria-label={label} className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <SectionHeading>{heading}</SectionHeading>
          <Block kind="body" as="p" className="mt-5 max-w-md text-base leading-relaxed text-muted md:text-lg" data-wave-words>
            <InlineCopy source={body} />
          </Block>
          <Block kind="links" as="div" className="mt-8" data-wave-words>
            <div data-sections-row>
              <span className="-my-[0.15em] block overflow-clip py-[0.15em]">
                <span data-sections-rowinner className="block w-fit">
                  <Fill as="a" {...FILL_PICK.cta} href={primary.href} target="_blank" rel="noopener noreferrer" className={CTA_CLASS} overClassName={CTA_OVER_CLASS}>
                    {primary.label}
                    <FillSeed className="h-8 w-8">
                      <FillArrow dir="up-right" />
                    </FillSeed>
                  </Fill>
                </span>
              </span>
            </div>
          </Block>
        </div>
        <Block kind="links" as="ul" className="md:col-span-7" data-wave-words>
          {links.map((link, i) => (
            <li key={link.key} data-sections-row className="relative">
              <Fill
                as="a"
                {...FILL_PICK.connect}
                shape="rect"
                line={0}
                href={link.href}
                target={isWeb(link.href) ? "_blank" : undefined}
                rel={isWeb(link.href) ? "noopener noreferrer" : undefined}
                className="-mx-4 flex min-h-[56px] items-baseline px-4 py-5 text-foreground"
                overClassName="flex items-baseline px-4 py-5"
              >
                <span className="-my-[0.15em] flex min-w-0 flex-1 overflow-clip py-[0.15em]">
                  <span data-sections-rowinner className="flex min-w-0 flex-1 items-baseline gap-4">
                    <span className={`flex h-[1lh] w-20 shrink-0 items-center self-start text-muted sm:w-28 md:w-32 ${VALUE_SIZE}`}>
                      <BrandIcon name={link.icon} className="h-6 w-6 md:h-7 md:w-7" />
                      <span className="sr-only">{link.label}</span>
                    </span>
                    <span data-connect-value className={`min-w-0 flex-1 break-words font-display ${VALUE_SIZE}`}>
                      {breakAfterAt(link.handle)}
                    </span>
                    <span className={`flex h-[1lh] shrink-0 items-center self-start ${VALUE_SIZE}`}>
                      <FillArrow dir="up-right" size={20} className="text-muted" />
                    </span>
                  </span>
                </span>
              </Fill>
              {i < links.length - 1 && (
                <span data-sections-hair aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-left bg-border" />
              )}
            </li>
          ))}
        </Block>
      </div>
    </section>
  );
}
