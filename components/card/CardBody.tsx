"use client";

import { useRef, useState } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { shapeKey, trimsKey } from "@/lib/gallery/paginate";
import { repage } from "@/lib/gallery/plan";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardPager, type PagerLayout } from "./CardPager";
import { CardRows } from "./CardRows";
import { CardWords } from "./CardWords";
import { useMaskIn } from "./useMaskIn";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout (the desktop rows from 1024px up; below, the
// pager for a card with photos and its words alone for a card without) and
// its mask-in, which starts at the landing after a flight and at once otherwise,
// and never touches the photo a parked flown card covers. A phone's pager
// measures its pages and lays them out so every page has a photo and words
// (lib/gallery/paginate), and the mask-in is laid again on the pages that
// follow (before the first paint, so nothing is seen).
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

const UNMEASURED: PagerLayout = { shape: {}, trims: {}, room: "" };

export function CardBody({ gallery, layout, renderMedia, flying, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotionLive();
  const [measured, setMeasured] = useState<PagerLayout>(UNMEASURED);
  const base = gallery.pages;
  const pages = layout === "pager" ? repage(base, measured.shape) : base;
  const paged = layout === "pager" && pages.length > 0;
  useMaskIn(rootRef, {
    reduced,
    runKey: `${gallery.key}|${layout}|${shapeKey(measured.shape)}|${trimsKey(measured.trims)}`,
    startMs: maskStartMs(flying),
    stepsFor: (lines) => cardSteps(gallery, layout, flying, lines, layout === "pager" ? pages : undefined),
  });
  return (
    <div ref={rootRef} data-card-body={layout} className={paged ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {layout === "rows" ? (
        <CardRows gallery={gallery} renderMedia={renderMedia} flying={flying} onClose={onClose} />
      ) : paged ? (
        <CardPager gallery={gallery} base={base} pages={pages} renderMedia={renderMedia} onClose={onClose} layout={measured} onLayout={setMeasured} />
      ) : (
        <CardWords gallery={gallery} renderMedia={renderMedia} flying={flying} onClose={onClose} />
      )}
    </div>
  );
}
