import { siteContent } from "@/lib/content";
import { employerSource } from "@/lib/gallery/timeline";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";

// One job on the timeline: the employer, whose name carries its insider tip (an
// inline tip in the shared label), the role where there is one, and when.
export function TimelineEntry({ entry, unit, compact = false }: { entry: number; unit: number; compact?: boolean }) {
  const { role, when } = siteContent.cards.jobs.timeline[entry];
  return (
    <div data-mask={partId.words(unit)} data-mask-kind="text" className="flex flex-col gap-1" data-timeline-entry={entry}>
      <p className={`font-display leading-tight text-foreground ${compact ? "text-xl" : "text-2xl"}`}>
        <InlineCopy source={employerSource(entry)} />
      </p>
      {role && <p className="font-label text-label text-accent">{role}</p>}
      <p className="font-label text-label text-accent">{when}</p>
    </div>
  );
}
