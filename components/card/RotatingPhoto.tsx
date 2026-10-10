"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { siteContent } from "@/lib/content";
import { groupFrame, type Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { isKeyboardFocus } from "@/lib/input/modality";
import { galleryRowSizes } from "@/lib/photoSizes";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { GroupCaptions, GroupLayer, RotatorAnnounce, RotatorFill, rotatorTrack } from "./GroupParts";
import { useRotator } from "./useRotator";

// A row's photos taking turns in one frame beside words that never change
// (the gallery lab, rounds five and six). The frame is the group's largest
// box and each photo is drawn in its own box centred in it, so nothing changes
// size; the caption under it changes with the photo. The dots under the
// captions say where it is (the current one fills over the interval) and step
// it, as do the arrow keys; the clock and the change are useRotator's, held
// while a mouse is over it, keyboard focus is inside it, or it is paused.

type Props = { gallery: Gallery; photos: readonly number[]; boxes: readonly Box[] };

const g = siteContent.modals.gallery;

export function RotatingPhoto({ gallery, photos, boxes }: Props) {
  const count = photos.length;
  const frame = groupFrame(boxes);
  const reduced = useReducedMotionLive();
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { index, step, runs } = useRotator(rootRef, frameRef, { count, reduced, paused, held: hovered || focused });

  const go = (next: number, focusDot: boolean) => {
    const target = step(next);
    if (focusDot) rootRef.current?.querySelector<HTMLElement>(`[data-rotator-dot="${target}"]`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(index + (e.key === "ArrowRight" ? 1 : -1), (e.target as HTMLElement).hasAttribute("data-rotator-dot"));
  };
  // A mouse click focuses a dot with no ring; only keyboard focus holds the photos.
  const onFocus = (e: FocusEvent<HTMLDivElement>) => setFocused(isKeyboardFocus(e.target));
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  const onHover = (over: boolean) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setHovered(over);
  };
  const sizesOf = (photo: number, i: number) => galleryRowSizes(gallery.photos[photo].width / gallery.photos[photo].height, boxes[i]);
  const hasCaptions = photos.some((photo) => gallery.photos[photo].caption);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription={g.roleCarousel}
      aria-label={g.rotatorLabel(count)}
      className="flex shrink-0 flex-col gap-2.5"
      style={{ width: frame.width }}
      onPointerEnter={onHover(true)}
      onPointerLeave={onHover(false)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-rotator=""
      data-rotator-index={index}
      data-rotator-runs={runs ? "" : undefined}
    >
      <div ref={frameRef} className="relative shrink-0" style={{ width: frame.width, height: frame.height }} data-rotator-frame="">
        {photos.map((photo, i) => (
          <GroupLayer key={photo} gallery={gallery} photo={photo} box={boxes[i]} frame={frame} layer={i} current={i === index} sizes={sizesOf(photo, i)} />
        ))}
      </div>
      {hasCaptions && <GroupCaptions photos={photos} index={index} caption={(photo) => gallery.photos[photo].caption} />}
      <div data-mask={partId.rotator(photos[0])} data-mask-kind="text" className="flex items-center justify-between gap-3">
        <div className="-ml-1 flex items-center">
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              aria-label={g.photoOf(i + 1, count)}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i, false)}
              className="group inline-flex h-8 items-center justify-center px-1"
              data-rotator-dot={i}
            >
              {i === index ? (
                <span className="relative block h-1.5 w-5 overflow-hidden rounded-full" style={rotatorTrack}>
                  <RotatorFill key={index} reduced={reduced} runs={runs} />
                </span>
              ) : (
                <span className="block h-1.5 w-1.5 rounded-full bg-muted transition-colors duration-200 group-hover:bg-foreground" />
              )}
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? g.playPhotos : g.pausePhotos}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
            data-rotator-pause={paused ? "paused" : "playing"}
          >
            {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <RotatorAnnounce runs={runs} index={index} count={count} caption={gallery.photos[photos[index]].caption} />
    </div>
  );
}
