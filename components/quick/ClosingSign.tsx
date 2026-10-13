import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { quickClosing } from "@/lib/content/quick";
import { CLOSE_KEY } from "@/lib/quick/years";

// The end of the lane: what I am looking for next, and the ways to reach me.
// It is the last checkpoint, so the line (or the road) ends here.

const links = quickClosing.links.map((key) => siteContent.connect.links.find((link) => link.key === key)!);
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export function ClosingSign({ line, className = "", node }: { line: string; className?: string; node?: ReactNode }) {
  const { primary } = siteContent.connect;
  return (
    <section id={CLOSE_KEY} data-quick-key={CLOSE_KEY} aria-labelledby="quick-close" className={`group/item relative ${className}`}>
      {node}
      <h2 id="quick-close" className="font-display text-[2.75rem] leading-none text-foreground md:text-[3.5rem]">
        {quickClosing.label}
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground md:text-body-lg">{line}</p>
      <ul className="mt-8 flex flex-wrap gap-2 font-label text-label">
        <li>
          <a href={primary.href} {...external(primary.href)} className="inline-flex rounded-full bg-accent px-4 py-2 text-background transition-colors hover:bg-accent-hover">
            {primary.label}
          </a>
        </li>
        {links.map((link) => (
          <li key={link.key}>
            <a href={link.href} {...external(link.href)} className="inline-flex rounded-full px-4 py-2 text-foreground ring-1 ring-inset ring-border transition-colors hover:text-accent hover:ring-accent">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
