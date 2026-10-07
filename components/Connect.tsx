import { Fragment } from "react";
import { Fill, FillArrow } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { Block } from "./sections/Block";
import { Kicker } from "./sections/Kicker";

// Measured, not guessed: an address fits one line at 2xl from 1024 and at 3xl
// from 1280; below 1024 even 2xl's "name@" outgrows the cell, so it is xl and
// wraps after the at sign. break-words only ever acts on a cell narrower than
// any segment (a 360px phone). The arrow's box is one line of the value tall,
// so it sits centered on the first line whether or not the value wraps.
const VALUE_SIZE = "text-xl lg:text-2xl xl:text-3xl";

function breakAfterAt(value: string) {
  return value.split(/(?<=@)/).map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}

// Stays a Server Component. The kicker, heading and lede arrive by the
// sections grammar, the heading and lede line by line; the link list is one
// block whose rows draw their rules and lift out of a clip in turn. The rule
// under each link is this section's, so the row's Fill rises from line 0.
export function Connect() {
  const { label, heading, lede, links } = siteContent.connect;
  return (
    <section id="connect" aria-label={label} className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <Kicker label={label} />
          <Block kind="heading" as="h2" className="mt-6 font-display text-section">
            {heading}
          </Block>
          <Block kind="body" as="p" className="mt-5 max-w-sm text-base leading-relaxed text-muted md:text-lg">
            {lede}
          </Block>
        </div>
        <Block kind="links" as="ul" className="md:col-span-7">
          {links.map((link, i) => (
            <li key={link.key} data-sections-row className="relative">
              <Fill
                as="a"
                {...FILL_PICK.connect}
                shape="rect"
                line={0}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="-mx-4 flex min-h-[56px] items-baseline px-4 py-5 text-foreground"
                overClassName="flex items-baseline px-4 py-5"
              >
                <span className="-my-[0.15em] flex min-w-0 flex-1 overflow-clip py-[0.15em]">
                  <span data-sections-rowinner className="flex min-w-0 flex-1 items-baseline gap-4">
                    <span className="w-28 shrink-0 font-label text-label text-muted md:w-32">{link.label}</span>
                    <span data-connect-value className={`min-w-0 flex-1 break-words font-display ${VALUE_SIZE}`}>
                      {breakAfterAt(link.value)}
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
