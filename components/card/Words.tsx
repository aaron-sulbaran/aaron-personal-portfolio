import { siteContent } from "@/lib/content";
import type { Gallery } from "@/lib/gallery/card";
import { phoneCopy } from "@/lib/gallery/omit";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";

// One word unit: a paragraph through InlineCopy (bold, italic, tips, pops and
// links live through the one delegated layer). trim: on a phone's page too
// short for all of it, how many of its phone omissions are left out (lib/gallery/omit).
export function Words({ gallery, unit, compact = false, className = "", trim = 0 }: { gallery: Gallery; unit: number; compact?: boolean; className?: string; trim?: number }) {
  const word = gallery.words[unit];
  const { blocks, phoneOmit } = siteContent.cards[gallery.key].modal;
  return (
    <p data-mask={partId.words(unit)} data-mask-kind="text" data-mask-split="" className={`text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55] lg:text-body-card"} ${className}`}>
      <InlineCopy source={phoneCopy(blocks[word.index], phoneOmit?.[word.index], trim)} />
    </p>
  );
}
