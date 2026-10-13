import type { ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { quickClosing } from "@/lib/content/quick";

// The end of every variant: what I am looking for next, and the ways to reach me.
// It is the last checkpoint, so the line (or the road) ends here.

const links = quickClosing.links.map((key) => siteContent.connect.links.find((link) => link.key === key)!);
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export function ClosingSign({ className = "", node, centered = false }: { className?: string; node?: ReactNode; centered?: boolean }) {
  const { primary } = siteContent.connect;
  return (
    <section data-quick-key="close" aria-labelledby="quick-close" className={`group/item relative ${centered ? "md:text-center" : ""} ${className}`}>
      {node}
      <h2 id="quick-close" className="font-label text-label text-accent">
        {quickClosing.label}
      </h2>
      <p className="mt-2 max-w-xl font-display text-[2rem] leading-[1.1] text-foreground md:text-[2.5rem]">{quickClosing.line}</p>
      <ul className={`mt-6 flex flex-wrap gap-2 font-label text-label ${centered ? "md:justify-center" : ""}`}>
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
