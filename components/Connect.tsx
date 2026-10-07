import { ArrowUpRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { Block } from "./sections/Block";
import { Kicker } from "./sections/Kicker";

// Stays a Server Component. The kicker, heading and lede arrive by the
// sections grammar, the heading and lede line by line; the link list is one
// block whose rows draw their rules and lift out of a clip in turn. The rule
// under each link is this section's; controls' Fill (with line={0}, since
// this section owns the rule) replaces the plain anchor when it lands.
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
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="group -mx-4 flex min-h-[56px] items-baseline px-4 py-5 text-foreground transition-colors duration-200 hover:text-accent"
              >
                <span className="-my-[0.15em] flex min-w-0 flex-1 overflow-clip py-[0.15em]">
                  <span data-sections-rowinner className="flex min-w-0 flex-1 items-baseline gap-4">
                    <span className="w-28 shrink-0 font-label text-label text-muted transition-colors duration-200 group-hover:text-accent md:w-32">
                      {link.label}
                    </span>
                    <span className="flex-1 truncate font-display text-2xl md:text-3xl">{link.value}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 self-center text-muted transition-colors duration-200 group-hover:text-accent"
                    />
                  </span>
                </span>
              </a>
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
