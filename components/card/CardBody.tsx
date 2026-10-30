"use client";

import { useRef, useState } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { CARD_PHONE_SPLITS } from "@/lib/gallery/constants";
import { phonePages, splitWords } from "@/lib/gallery/plan";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardPager } from "./CardPager";
import { CardRows } from "./CardRows";
import { CardWords } from "./CardWords";
import { useMaskIn } from "./useMaskIn";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout (the desktop rows from 1024px up; below, the
// pager for a card with photos and its words alone for a card without) and
// its mask-in, which starts at the landing after a flight and at once otherwise,
// and never touches the photo a parked flown card covers. A card that splits
// its phone pages (CARD_PHONE_SPLITS) is told by its pager which paragraphs
// need a page of their own; the pages follow, and the mask-in is laid again
// on them (before the first paint, so nothing is seen).
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia, flying, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotionLive();
  const [split, setSplit] = useState<readonly number[]>([]);
  const splits = layout === "pager" && CARD_PHONE_SPLITS.has(gallery.key);
  const pages = splits ? splitWords(phonePages(gallery.plan, gallery.grouping), split) : phonePages(gallery.plan, gallery.grouping);
  const paged = layout === "pager" && pages.length > 0;
  useMaskIn(rootRef, { reduced, runKey: `${gallery.key}|${layout}|${split.join(",")}`, startMs: maskStartMs(flying), stepsFor: (lines) => cardSteps(gallery, layout, flying, lines, splits ? pages : undefined) });
  return (
    <div ref={rootRef} data-card-body={layout} className={paged ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {layout === "rows" ? (
        <CardRows gallery={gallery} renderMedia={renderMedia} flying={flying} />
      ) : paged ? (
        <CardPager gallery={gallery} pages={pages} renderMedia={renderMedia} onClose={onClose} split={split} onSplit={splits ? setSplit : undefined} />
      ) : (
        <CardWords gallery={gallery} renderMedia={renderMedia} flying={flying} />
      )}
    </div>
  );
}
