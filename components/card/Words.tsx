import { siteContent } from "@/lib/content";
import type { Gallery } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { TimelineEntry } from "./TimelineEntry";

// One word unit: a paragraph through InlineCopy (bold, italic, tips, pops and
// links live through the one delegated layer), or a jobs timeline entry.
export function Words({ gallery, unit, compact = false, className = "" }: { gallery: Gallery; unit: number; compact?: boolean; className?: string }) {
  const word = gallery.words[unit];
  if (word.kind === "entry") return <TimelineEntry entry={word.index} unit={unit} compact={compact} />;
  return (
    <p data-mask={partId.words(unit)} data-mask-kind="text" data-mask-split="" className={`text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55]"} ${className}`}>
      <InlineCopy source={siteContent.cards[gallery.key].modal.blocks[word.index]} />
    </p>
  );
}
