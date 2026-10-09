"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { LAB_COPY, type LabCard } from "./cards";
import { Caption } from "./parts";
import { gallerySizes, type Box } from "./rows";
import { rotatorTrack } from "./RotatingPhoto";
import type { Settings } from "./settings";
import { partId } from "./timing";
import { useRotator } from "./useRotator";

// Round six on a phone, A: a page holds one paragraph, and when that
// paragraph has a group of photos they take turns inside the page's stage on
// the desktop rotator's rules (useRotator: the interval, the change in the
// rotator's direction, the caption changing with the photo). The frame is
// the group's largest photo fitted whole, each photo drawn at its own fit
// inside it, so the stage never changes size and no photo is cropped. Small
// marks in a pill inside the current photo's bottom right corner say where
// the group is, well away from the page dots (in a group of mixed shapes the
// pill glides to the next photo's corner with the change); a tap on the stage steps the group (Enter or
// Space when it has focus), a swipe still turns the page. It holds while a
// finger is down on the pager, while its page is not the current one, and
// while the stage has keyboard focus; under reduced motion it never turns on
// its own and a tap steps it with no transition.

type Props = {
  card: LabCard;
  photos: number[];
  frame: Box;
  boxes: Box[];
  aspects: number[];
  innerWidth: number;
  s: Settings;
  reduced: boolean;
  active: boolean;
  pressing: boolean;
  scale: number;
};

// A pointer that moves further than this between down and up is a swipe;
// one held longer is someone looking at the photo, which the hold already
// paused, so neither steps the group.
const TAP_PX = 10;
const TAP_MS = 500;
const MARKS_INSET = 8;
const pill: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 78%, transparent)" };

export function PhoneRotator({ card, photos, frame, boxes, aspects, innerWidth, s, reduced, active, pressing, scale }: Props) {
  const count = photos.length;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const { index, step, runs, intervalMs } = useRotator(rootRef, frameRef, { count, s, reduced, hovered: pressing, focused, active });
  const captionOf = (p: number) => card.photos[p].captionShort ?? card.photos[p].caption;
  const hasCaptions = photos.some((p) => captionOf(p));
  const topOf = (box: Box) => (s.rotateAlign === "bottom" ? frame.height - box.height : (frame.height - box.height) / 2);
  const shown = boxes[index];
  const marksAt: CSSProperties = {
    right: (frame.width - shown.width) / 2 + MARKS_INSET,
    bottom: frame.height - topOf(shown) - shown.height + MARKS_INSET,
    transition: reduced ? "none" : `right ${s.rotateMs}ms cubic-bezier(0.22, 1, 0.36, 1), bottom ${s.rotateMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const start = down.current;
    down.current = null;
    if (start && (Math.hypot(e.clientX - start.x, e.clientY - start.y) / scale > TAP_PX || e.timeStamp - start.t > TAP_MS)) return;
    step(index + 1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    step(index + 1);
  };

  return (
    <div ref={rootRef} className="flex shrink-0 flex-col gap-3" data-rotator="" data-rotator-index={index} data-rotator-runs={runs ? "" : undefined}>
      <div className="relative w-full shrink-0" style={{ height: frame.height }} data-pager-stage="">
        <div
          ref={frameRef}
          role="button"
          tabIndex={active ? 0 : -1}
          aria-label={LAB_COPY.groupStep(index + 1, count)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer rounded-xl"
          style={{ width: frame.width, height: frame.height }}
          onPointerDown={onPointerDown}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
          onBlur={() => setFocused(false)}
          data-rotator-frame=""
        >
          {photos.map((p, i) => {
            const box = boxes[i];
            const photo = card.photos[p];
            const top = topOf(box);
            // As on a still page: a vertical stand-in cropped to a wider shape
            // keeps its top, where the faces are.
            const standInTop = photo.width / photo.height < aspects[p] - 0.01;
            return (
              <div
                key={p}
                className="absolute"
                style={{ left: (frame.width - box.width) / 2, top, width: box.width, height: box.height }}
                aria-hidden={i !== index}
                data-rotator-layer={i}
                data-photo-frame={p}
                data-current={i === index ? "" : undefined}
              >
                <div data-mask={partId.photo(p)} data-mask-kind="photo" {...(p === card.flownPhoto ? { "data-mask-flown": "", "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
                  <div data-mask-media="" className="absolute inset-0">
                    <div data-rotator-media="" className="absolute inset-0">
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        quality={90}
                        draggable={false}
                        sizes={gallerySizes(photo.width / photo.height, aspects[p], innerWidth)}
                        className={`object-cover ${standInTop ? "object-[50%_18%]" : ""}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div aria-hidden="true" className="pointer-events-none absolute z-[3] flex items-center gap-1 rounded-full px-1.5 py-1" style={{ ...pill, ...marksAt }} data-rotator-marks="">
            {photos.map((p, i) =>
              i === index ? (
                <span key={p} className="relative block h-1 w-3 overflow-hidden rounded-full" style={rotatorTrack} data-rotator-mark={i} data-current="">
                  <span
                    key={`${index}-${intervalMs}`}
                    className="absolute inset-0 rounded-full bg-accent"
                    style={reduced ? undefined : { animationDuration: `${intervalMs}ms`, animationPlayState: runs ? "running" : "paused" }}
                    data-rotator-fill={reduced ? "still" : "timed"}
                  />
                </span>
              ) : (
                <span key={p} className="block h-1 w-1 rounded-full bg-muted" data-rotator-mark={i} />
              ),
            )}
          </div>
        </div>
      </div>
      {hasCaptions && (
        <div className="grid shrink-0 overflow-clip" data-rotator-captions="">
          {photos.map((p, i) => {
            const caption = captionOf(p);
            return (
              <div key={p} className="[grid-area:1/1]" aria-hidden={i !== index} data-rotator-caption={i} data-current={i === index ? "" : undefined}>
                {caption && <Caption id={partId.caption(p)} text={caption} />}
              </div>
            );
          })}
        </div>
      )}
      <p className="sr-only" aria-live={runs ? "off" : "polite"}>
        {LAB_COPY.announce(index + 1, count, captionOf(photos[index]) ?? "")}
      </p>
    </div>
  );
}
