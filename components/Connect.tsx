import { ArrowUpRight } from "lucide-react";
import { siteContent } from "@/lib/content";

export function Connect() {
  const { label, heading, lede, links } = siteContent.connect;
  return (
    <section
      aria-label={label}
      className="relative w-full border-t border-border/70 px-6 py-24 md:px-10 md:py-40"
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted">
            <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
            <span>{label}</span>
          </div>
          <h2 className="mt-6 font-serif text-section italic">{heading}</h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-muted md:text-lg">
            {lede}
          </p>
        </div>

        <ul className="md:col-span-7">
          {links.map((link) => (
            <li key={link.key} className="border-b border-border/70 last:border-b-0">
              <a
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="group flex min-h-[56px] items-baseline gap-4 py-5 text-foreground transition-colors duration-200 hover:text-accent"
              >
                <span className="w-28 shrink-0 text-[11px] font-medium uppercase tracking-caps text-muted transition-colors duration-200 group-hover:text-accent md:w-32">
                  {link.label}
                </span>
                <span className="flex-1 truncate font-serif text-2xl italic md:text-3xl">
                  {link.value}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 translate-y-[3px] text-muted transition-all duration-200 group-hover:-translate-y-[1px] group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
