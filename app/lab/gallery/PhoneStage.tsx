"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef } from "react";
import type { LabPhoto } from "./cards";
import { gallerySizes } from "./layout";
import { autoAdvanceMs, gestureOf, initialStage, stageReducer } from "./stage";
import { partId } from "./timing";

// The phone stage: one 3:4 photo at the top, tap or swipe for the next,
// arrow keys from anywhere in the dialog, dots for where you are, and one
// gentle auto-advance pass that stops on the last photo or at a touch.
// Crossfade only, no drift. Under reduced motion the swap is instant and
// nothing advances on its own.

type Props = {
  photos: LabPhoto[];
  // The photos' indices in the card, for the sizes and the masks.
  order: number[];
  maxHeightPx: number;
  autoSeconds: number;
  crossfadeMs: number;
  startAfterMs: number;
  reduced: boolean;
  flown: boolean;
  scale: number;
  desktopPhotoWidth: number;
};

export function PhoneStage({ photos, order, maxHeightPx, autoSeconds, crossfadeMs, startAfterMs, reduced, flown, scale, desktopPhotoWidth }: Props) {
  const tickMs = autoAdvanceMs(autoSeconds, photos.length, reduced);
  const [state, dispatch] = useReducer(stageReducer, initialStage(photos.length, tickMs !== null));
  const down = useRef<{ x: number; y: number } | null>(null);
  const firstTick = useRef(true);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tickMs === null || !state.auto) return;
    const wait = firstTick.current ? startAfterMs + tickMs : tickMs;
    const id = window.setTimeout(() => {
      firstTick.current = false;
      dispatch({ type: "tick" });
    }, wait);
    return () => window.clearTimeout(id);
  }, [state.index, state.auto, tickMs, startAfterMs]);

  // Arrow keys anywhere in the dialog (focus starts on the close button), but
  // never while a form control outside it, such as a lab slider, has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const target = e.target as HTMLElement | null;
      const inDialog = !!rootRef.current?.closest("[data-gallery-dialog]")?.contains(target);
      if (!inDialog && target !== document.body) return;
      e.preventDefault();
      dispatch({ type: e.key === "ArrowRight" ? "next" : "prev" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fade = reduced ? 0 : crossfadeMs;
  const current = photos[state.index];

  return (
    <div ref={rootRef} role="group" aria-roledescription="carousel" aria-label={`Photos, ${photos.length}`} className="flex flex-col items-center gap-3">
      <div
        className="relative aspect-[3/4] w-full cursor-pointer select-none [touch-action:pan-y]"
        style={{ maxWidth: maxHeightPx * 0.75 }}
        data-stage-frame=""
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY };
          dispatch({ type: "touch" });
        }}
        onPointerUp={(e) => {
          const start = down.current;
          down.current = null;
          if (!start) return;
          const gesture = gestureOf((e.clientX - start.x) / scale, (e.clientY - start.y) / scale);
          if (gesture) dispatch({ type: gesture === "prev" ? "prev" : "next" });
        }}
        onPointerCancel={() => {
          down.current = null;
        }}
      >
        <div data-mask={partId.stage} data-mask-kind="photo" {...(flown ? { "data-mask-flown": "", "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
          <div data-mask-media="" className="absolute inset-0">
            {photos.map((photo, i) => (
              <div
                key={`${photo.src}-${order[i]}`}
                aria-hidden={i !== state.index}
                className="absolute inset-0 transition-opacity ease-linear"
                style={{ opacity: i === state.index ? 1 : 0, transitionDuration: `${fade}ms` }}
              >
                <Image src={photo.src} alt={photo.alt} fill quality={90} draggable={false} sizes={gallerySizes(photo.width / photo.height, desktopPhotoWidth)} className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {photos.length > 1 && (
        <div className="flex items-center gap-1">
          {photos.map((photo, i) => (
            <button
              key={`dot-${order[i]}`}
              type="button"
              aria-label={`Photo ${i + 1} of ${photos.length}`}
              aria-current={i === state.index ? "true" : undefined}
              onClick={() => dispatch({ type: "goto", index: i })}
              className="group inline-flex h-6 w-6 items-center justify-center"
            >
              <span className={`block h-1.5 w-1.5 rounded-full transition-colors duration-200 ${i === state.index ? "bg-accent" : "bg-border group-hover:bg-muted"}`} />
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live={state.auto ? "off" : "polite"}>
        {`Photo ${state.index + 1} of ${photos.length}: ${current?.alt ?? ""}`}
      </p>
    </div>
  );
}
