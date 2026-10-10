"use client";

import { useRef } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { PHONE_GROUPING } from "@/lib/gallery/constants";
import { phonePages } from "@/lib/gallery/plan";
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
// and never touches the photo a parked flown card covers.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia, flying, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotionLive();
  const pages = phonePages(gallery.plan, PHONE_GROUPING);
  const paged = layout === "pager" && pages.length > 0;
  useMaskIn(rootRef, { reduced, runKey: `${gallery.key}|${layout}`, startMs: maskStartMs(flying), stepsFor: (lines) => cardSteps(gallery, layout, flying, lines) });
  return (
    <div ref={rootRef} data-card-body={layout} className={paged ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {layout === "rows" ? (
        <CardRows gallery={gallery} renderMedia={renderMedia} />
      ) : paged ? (
        <CardPager gallery={gallery} pages={pages} renderMedia={renderMedia} onClose={onClose} />
      ) : (
        <CardWords gallery={gallery} renderMedia={renderMedia} />
      )}
    </div>
  );
}
