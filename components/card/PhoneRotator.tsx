"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { siteContent } from "@/lib/content";
import type { Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { isKeyboardFocus } from "@/lib/input/modality";
import { PAGER_PHOTO_SIZES } from "@/lib/photoSizes";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { GroupCaptions, GroupLayer, RotatorAnnounce, RotatorFill } from "./GroupParts";
import { rotatorTrack } from "./RotatingPhoto";
import { useRotator } from "./useRotator";

// Round six on a phone, grouping A: a page holds one paragraph, and when it
// has a group of photos they take turns inside the page's stage on the
// desktop's rules (useRotator). The frame is the group's largest photo fitted
// whole and each photo is drawn at its own fit centred in it, so the stage
// never changes size and nothing is cropped. Small marks in a pill inside the
// current photo's bottom right corner say where the group is (in a group of
// two shapes the pill glides to the next photo's corner with the change),
// well away from the page dots. A tap on the stage steps the group (Enter or
// Space when it has focus) and a swipe still turns the page. It holds while a
// finger is down on the pager, while its page is not current and while the
// stage has keyboard focus; under reduced motion it never turns on its own.

type Props = { gallery: Gallery; photos: readonly number[]; frame: Box; boxes: readonly Box[]; active: boolean; pressing: boolean };

const g = siteContent.modals.gallery;
const pill: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 78%, transparent)" };

export function PhoneRotator({ gallery, photos, frame, boxes, active, pressing }: Props) {
  const count = photos.length;
  const reduced = useReducedMotionLive();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const { index, step, runs } = useRotator(rootRef, frameRef, { count, reduced, held: pressing || focused, active });
  const { rotate, ease } = GALLERY;
  const captionOf = (photo: number) => gallery.photos[photo].captionShort ?? gallery.photos[photo].caption;
  const shown = boxes[index];
  const marksAt: CSSProperties = {
    right: (frame.width - shown.width) / 2 + rotate.marksInsetPx,
    bottom: (frame.height - shown.height) / 2 + rotate.marksInsetPx,
    transition: reduced ? "none" : `right ${rotate.changeMs}ms ${ease.css}, bottom ${rotate.changeMs}ms ${ease.css}`,
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  // A pointer that moved further than a tap was the pager's swipe, and one
  // held longer only held the group; neither steps it.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const start = down.current;
    down.current = null;
    if (start && (Math.hypot(e.clientX - start.x, e.clientY - start.y) > rotate.tapPx || e.timeStamp - start.t > rotate.holdMs)) return;
    step(index + 1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    step(index + 1);
  };
  const hasCaptions = photos.some((photo) => captionOf(photo));

  return (
    <div ref={rootRef} className="flex shrink-0 flex-col gap-3" data-rotator="" data-rotator-index={index} data-rotator-runs={runs ? "" : undefined}>
      <div className="relative w-full shrink-0" style={{ height: frame.height }} data-pager-stage="">
        <div
          ref={frameRef}
          role="button"
          tabIndex={active ? 0 : -1}
          aria-label={g.groupStep(index + 1, count)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer rounded-xl"
          style={{ width: frame.width, height: frame.height }}
          onPointerDown={onPointerDown}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={(e) => setFocused(isKeyboardFocus(e.currentTarget))}
          onBlur={() => setFocused(false)}
          data-rotator-frame=""
        >
          {photos.map((photo, i) => (
            <GroupLayer key={photo} gallery={gallery} photo={photo} box={boxes[i]} frame={frame} layer={i} current={i === index} sizes={PAGER_PHOTO_SIZES} />
          ))}
          <div aria-hidden="true" className="pointer-events-none absolute z-[3] flex items-center gap-1 rounded-full px-1.5 py-1" style={{ ...pill, ...marksAt }} data-rotator-marks="">
            {photos.map((photo, i) =>
              i === index ? (
                <span key={photo} className="relative block h-1 w-3 overflow-hidden rounded-full" style={rotatorTrack} data-rotator-mark={i}>
                  <RotatorFill key={index} reduced={reduced} runs={runs} />
                </span>
              ) : (
                <span key={photo} className="block h-1 w-1 rounded-full bg-muted" data-rotator-mark={i} />
              ),
            )}
          </div>
        </div>
      </div>
      {hasCaptions && <GroupCaptions photos={photos} index={index} caption={captionOf} />}
      <RotatorAnnounce runs={runs} index={index} count={count} caption={captionOf(photos[index])} />
    </div>
  );
}
