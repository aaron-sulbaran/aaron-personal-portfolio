import { ArrowUpRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { Kicker, StickyCol } from "./Kicker";
import type { KickerFace } from "./settings";

// A static copy of components/Connect.tsx. Each row's bottom border becomes a
// hairline the grammar can draw, and the row's content sits in a clip so it
// can rise out of it; the link, its target and its hover are unchanged.
export function ConnectCopy({ face, sticky }: { face: KickerFace; sticky: boolean }) {
  const { label, heading, lede, links } = siteContent.connect;
  return (
    <section
      id="connect"
      aria-label={label}
      data-sl-section="connect"
      className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40"
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-12 md:gap-16">
        <StickyCol on={sticky} className="sl-col md:col-span-5">
          <Kicker label={label} face={face} />
          <div className="mt-6">
            <h2 data-sl-block="heading" data-wave-avoid className="font-display text-section">
              <span data-sl-inner className="block">
                {heading}
              </span>
            </h2>
          </div>
          <p data-sl-block="body" data-wave-avoid className="mt-5 max-w-sm text-base leading-relaxed text-muted md:text-lg">
            {lede}
          </p>
        </StickyCol>

        <ul data-sl-block="links" data-wave-avoid className="md:col-span-7">
          {links.map((link, i) => (
            <li key={link.key} data-sl-row className="relative">
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="group flex min-h-[56px] items-baseline py-5 text-foreground transition-colors duration-200 hover:text-accent"
              >
                <span className="-my-[0.15em] flex min-w-0 flex-1 overflow-clip py-[0.15em]">
                  <span data-sl-rowinner className="flex min-w-0 flex-1 items-baseline gap-4">
                    <span className="w-28 shrink-0 text-sm text-muted transition-colors duration-200 group-hover:text-accent md:w-32">
                      {link.label}
                    </span>
                    <span className="flex-1 truncate font-display text-2xl md:text-3xl">{link.value}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 translate-y-[3px] text-muted transition-all duration-200 group-hover:-translate-y-[1px] group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </span>
                </span>
              </a>
              {i < links.length - 1 && <span data-sl-hair aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-border" />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
