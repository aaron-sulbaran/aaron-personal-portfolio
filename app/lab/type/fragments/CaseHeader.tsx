import Image from "next/image";
import { siteContent } from "@/lib/content";
import { role } from "../Specimen";

// app/work/[slug]/page.tsx, the case page's header for Capital One: back
// link, logo, role line, title, and the summary (body, stays Inter).
const item = siteContent.workItems[0];

export function CaseHeader() {
  return (
    <div className="mx-auto max-w-4xl">
      <a
        href="#case"
        className="mb-12 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-200 hover:text-accent md:mb-16"
        {...role("controls", 14)}
      >
        {siteContent.work.backLabel}
      </a>

      <div className="mb-10 flex flex-wrap items-center gap-5 md:mb-14">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-glass shadow-[0_10px_24px_-14px_rgba(10,10,10,0.4)] md:h-24 md:w-24">
          <Image src={item.logo} alt={`${item.title} logo`} fill sizes="96px" className="object-contain p-3" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted" {...role("meta", 14)}>
            {item.role}, {item.year}
          </span>
          <p className="font-display text-display-page text-foreground">{item.title}</p>
        </div>
      </div>

      <p className="max-w-2xl text-xl leading-[1.55] text-foreground md:text-2xl">{item.summary}</p>
    </div>
  );
}
