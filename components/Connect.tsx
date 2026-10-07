import { Fill, FillArrow } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "./Reveal";

export function Connect() {
  const { label, heading, lede, links } = siteContent.connect;
  return (
    <section
      id="connect"
      aria-label={label}
      className="relative w-full border-t border-border px-6 py-24 md:px-10 md:py-40 scroll-mt-24"
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-12 md:gap-16">
        <Reveal className="md:col-span-5">
          <div
            data-wave-avoid
            className="reveal-item flex items-center gap-3 text-sm text-muted"
            style={revealIndex(0)}
          >
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{label}</span>
          </div>
          <div className="mt-6">
            <h2 data-wave-avoid className="reveal-mask font-display text-section" style={revealIndex(1)}>
              <span className="block">{heading}</span>
            </h2>
          </div>
          <p
            data-wave-avoid
            className="reveal-item mt-5 max-w-sm text-base leading-relaxed text-muted md:text-lg"
            style={revealIndex(2)}
          >
            {lede}
          </p>
        </Reveal>

        <Reveal as="ul" data-wave-avoid className="md:col-span-7">
          {links.map((link, i) => (
            <li
              key={link.key}
              className="reveal-item border-b border-border last:border-b-0"
              style={revealIndex(i)}
            >
              <Fill
                as="a"
                {...FILL_PICK.connect}
                shape="rect"
                line={0}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="-mx-4 flex min-h-[56px] items-baseline gap-4 px-4 py-5 text-foreground"
                overClassName="flex items-baseline gap-4 px-4 py-5"
              >
                <span className="w-28 shrink-0 font-label text-label text-muted md:w-32">{link.label}</span>
                <span className="flex-1 truncate font-display text-2xl md:text-3xl">{link.value}</span>
                <FillArrow dir="up-right" size={20} className="self-center text-muted" />
              </Fill>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
