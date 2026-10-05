import Image from "next/image";
import { siteContent } from "@/lib/content";
import { useShown } from "../context";
import { BackLabel, RoleLineText } from "../pairs";

// app/work/[slug]/page.tsx, the case page's header for Capital One: back
// link, logo, role line, title, and the summary (body, stays Inter). The role
// line sits above the title as on the site, or below it as a subtitle.
const item = siteContent.workItems[0];

export function CaseHeader() {
  const line = useShown().roleLineCase;
  const roleLine = <RoleLineText line={line} text={`${item.role}, ${item.year}`} />;
  return (
    <div className="mx-auto max-w-4xl">
      <BackLabel />

      <div className="mb-10 flex flex-wrap items-center gap-5 md:mb-14">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-glass shadow-[0_10px_24px_-14px_rgba(10,10,10,0.4)] md:h-24 md:w-24">
          <Image src={item.logo} alt={`${item.title} logo`} fill sizes="96px" className="object-contain p-3" />
        </div>
        <div className="flex flex-col" style={{ gap: line.gap }}>
          {line.placement === "above" && roleLine}
          <p className="font-display text-display-page text-foreground">{item.title}</p>
          {line.placement === "below" && roleLine}
        </div>
      </div>

      <p className="max-w-2xl text-xl leading-[1.55] text-foreground md:text-2xl">{item.summary}</p>
    </div>
  );
}
