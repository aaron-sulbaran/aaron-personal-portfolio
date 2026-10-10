"use client";

import { useRef } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardRows } from "./CardRows";
import { CardStack } from "./CardStack";
import { useMaskIn } from "./useMaskIn";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout (the desktop rows from 1024px up, the phone's
// column below) and its mask-in, which starts at the landing after a flight
// and at once otherwise, and never touches the photo a parked flown card covers.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia, flying }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotionLive();
  useMaskIn(rootRef, { reduced, runKey: `${gallery.key}|${layout}`, startMs: maskStartMs(flying), stepsFor: (lines) => cardSteps(gallery, layout, flying, lines) });
  return (
    <div ref={rootRef} data-card-body={layout}>
      {layout === "rows" ? <CardRows gallery={gallery} renderMedia={renderMedia} /> : <CardStack gallery={gallery} renderMedia={renderMedia} />}
    </div>
  );
}
