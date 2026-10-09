"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { LAB_COPY, type LabCard } from "./cards";
import { Caption } from "./parts";
import { groupFrame } from "./plan";
import { gallerySizes, type Box } from "./rows";
import type { Settings } from "./settings";
import { partId } from "./timing";
import { useRotator } from "./useRotator";

// Round five on desktop: a row's photos take turns in one frame beside its
// words, which never change. The frame holds the group's largest box, and
// each photo is drawn at its own box inside it, so nothing changes size. The
// caption under it changes with the photo; the dots under the caption say
// where it is (the current one fills over the interval), and a person steps
// it with them or the arrow keys. The clock and the change are useRotator's
// (shared with a phone page's stage from round six): it stops while hovered,
// keyboard-focused, mostly off screen or paused.

type Props = { card: LabCard; photos: number[]; boxes: Box[]; s: Settings; reduced: boolean };

// The current dot's track: the accent, faint, so it reads as the current one
// before its fill starts (bg-accent/NN emits nothing with var() colors).
export const rotatorTrack = { backgroundColor: "color-mix(in srgb, var(--color-accent) 28%, transparent)" };

export function RotatingPhoto({ card, photos, boxes, s, reduced }: Props) {
  const count = photos.length;
  const frame = groupFrame(boxes);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { index, step, runs, intervalMs } = useRotator(rootRef, frameRef, { count, s, reduced, paused, hovered, focused });

  const go = (next: number, focusDot: boolean) => {
    const target = step(next);
    if (focusDot) rootRef.current?.querySelector<HTMLElement>(`[data-rotator-dot="${target}"]`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    go(index + (e.key === "ArrowRight" ? 1 : -1), (e.target as HTMLElement).hasAttribute("data-rotator-dot"));
  };
  // A mouse click focuses a dot without a focus ring; only keyboard focus
  // holds the photo, so a click does not stop it for good.
  const onFocus = (e: FocusEvent<HTMLDivElement>) => setFocused((e.target as HTMLElement).matches(":focus-visible"));
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  const onHover = (over: boolean) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setHovered(over);
  };

  const current = card.photos[photos[index]];
  const hasCaptions = photos.some((p) => card.photos[p].caption);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={LAB_COPY.rotatorLabel(count)}
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
        {photos.map((p, i) => {
          const box = boxes[i];
          const photo = card.photos[p];
          const top = s.rotateAlign === "bottom" ? frame.height - box.height : (frame.height - box.height) / 2;
          return (
            <div
              key={p}
              className="absolute"
              style={{ left: (frame.width - box.width) / 2, top, width: box.width, height: box.height }}
              aria-hidden={i !== index}
              data-rotator-layer={i}
              data-current={i === index ? "" : undefined}
            >
              <div data-mask={partId.photo(p)} data-mask-kind="photo" {...(p === card.flownPhoto ? { "data-mask-flown": "", "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
                <div data-mask-media="" className="absolute inset-0">
                  <div data-rotator-media="" className="absolute inset-0">
                    <Image src={photo.src} alt={photo.alt} fill quality={90} sizes={gallerySizes(photo.width / photo.height, box.width / box.height, box.width)} className="object-cover" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasCaptions && (
        <div className="grid overflow-clip" data-rotator-captions="">
          {photos.map((p, i) => {
            const caption = card.photos[p].caption;
            return (
              <div key={p} className="[grid-area:1/1]" aria-hidden={i !== index} data-rotator-caption={i} data-current={i === index ? "" : undefined}>
                {caption && <Caption id={partId.caption(p)} text={caption} />}
              </div>
            );
          })}
        </div>
      )}
      <div data-mask={partId.rotator(photos[0])} data-mask-kind="text" data-mask-clip="">
        <div data-mask-inner="" className="flex items-center justify-between gap-3">
          <div className="-ml-1 flex items-center">
            {photos.map((p, i) => (
              <button
                key={p}
                type="button"
                aria-label={LAB_COPY.pageOf(i + 1, count)}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i, false)}
                className="group inline-flex h-8 items-center justify-center px-1"
                data-rotator-dot={i}
              >
                {i === index ? (
                  <span className="relative block h-1.5 w-5 overflow-hidden rounded-full" style={rotatorTrack}>
                    <span
                      key={`${index}-${intervalMs}`}
                      className="absolute inset-0 rounded-full bg-accent"
                      style={reduced ? undefined : { animationDuration: `${intervalMs}ms`, animationPlayState: runs ? "running" : "paused" }}
                      data-rotator-fill={reduced ? "still" : "timed"}
                    />
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
              aria-label={paused ? LAB_COPY.playPhotos : LAB_COPY.pausePhotos}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
              data-rotator-pause={paused ? "paused" : "playing"}
            >
              {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live={runs ? "off" : "polite"}>
        {LAB_COPY.announce(index + 1, count, current?.caption ?? "")}
      </p>
    </div>
  );
}
