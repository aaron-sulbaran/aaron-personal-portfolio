import { siteContent } from "@/lib/content";
import { quickClosing, quickCopy } from "@/lib/content/quick";
import { CLOSE_KEY } from "@/lib/quick/years";

// The end of the lane, a short closing row: book some time, then the ways to
// reach me. It sits below What's next, off the rail.

const links = quickClosing.links.map((key) => siteContent.connect.links.find((link) => link.key === key)!);
const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export function ClosingSign({ className = "" }: { className?: string }) {
  const { primary } = siteContent.connect;
  return (
    <section id={CLOSE_KEY} aria-label={quickCopy.closingLabel} className={className}>
      <ul className="flex flex-wrap gap-2 font-label text-label">
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
