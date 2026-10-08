"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef } from "react";
import type { LabPhoto } from "./cards";
import { gallerySizes, stageLayout, type StageFit } from "./rows";
import { autoAdvanceMs, gestureOf, initialStage, stageReducer } from "./stage";
import { partId } from "./timing";

// The phone stage: one photo at a time, fitted whole (photos keep their own
// shape), tap or swipe for the next, arrow keys from anywhere in the dialog,
// dots for where you are, and one gentle auto-advance pass that stops on the
// last photo or at a touch. The stage takes each photo's height and eases
// between them, or holds the tallest. Crossfade only, no drift. The caption
// under it changes with the photo; every caption shares one grid cell, so the
// longest sets the height and nothing under it moves. Under reduced motion
// the swap is instant and nothing advances on its own.

type Props = {
  photos: LabPhoto[];
  aspects: number[];
  // The photos' indices in the card, for keys and the flown slot.
  order: number[];
  innerWidth: number;
  maxHeightPx: number;
  fit: StageFit;
  easeMs: number;
  autoSeconds: number;
  crossfadeMs: number;
  startAfterMs: number;
  reduced: boolean;
  flownPhoto: number | undefined;
  scale: number;
};

export function PhoneStage({ photos, aspects, order, innerWidth, maxHeightPx, fit, easeMs, autoSeconds, crossfadeMs, startAfterMs, reduced, flownPhoto, scale }: Props) {
  const tickMs = autoAdvanceMs(autoSeconds, photos.length, reduced);
  const [state, dispatch] = useReducer(stageReducer, initialStage(photos.length, tickMs !== null));
  const down = useRef<{ x: number; y: number } | null>(null);
  const firstTick = useRef(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = stageLayout(aspects, innerWidth, maxHeightPx, fit);

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
  const ease = reduced ? 0 : easeMs;
  const stageHeight = layout.heights[state.index] ?? 0;
  const current = photos[state.index];
  const flownFirst = flownPhoto !== undefined && order[0] === flownPhoto;

  return (
    <div ref={rootRef} role="group" aria-roledescription="carousel" aria-label={`Photos, ${photos.length}`} className="flex flex-col gap-3">
      <div
        data-mask={partId.stage}
        data-mask-kind="photo"
        {...(flownFirst ? { "data-mask-flown": "" } : {})}
        className="relative w-full cursor-pointer select-none overflow-hidden [touch-action:pan-y]"
        style={{ height: stageHeight, transition: `height ${ease}ms cubic-bezier(0.22, 1, 0.36, 1)` }}
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
        <div data-mask-media="" className="absolute inset-0">
          {photos.map((photo, i) => {
            const box = layout.boxes[i];
            return (
              <div
                key={`${photo.src}-${order[i]}`}
                aria-hidden={i !== state.index}
                {...(order[i] === flownPhoto ? { "data-tile-slot": "photo" } : {})}
                className="absolute left-1/2 overflow-hidden rounded-xl transition-opacity ease-linear"
                style={{
                  width: box.width,
                  height: box.height,
                  top: `calc(50% - ${box.height / 2}px)`,
                  transform: "translateX(-50%)",
                  opacity: i === state.index ? 1 : 0,
                  transitionDuration: `${fade}ms`,
                }}
              >
                <Image src={photo.src} alt={photo.alt} fill quality={90} draggable={false} sizes={gallerySizes(photo.width / photo.height, aspects[i], innerWidth)} className="object-cover" />
              </div>
            );
          })}
        </div>
      </div>
      {photos.some((p) => p.caption) && (
        <div data-mask={partId.stageCaption} data-mask-kind="text">
          <div data-mask-inner="" className="grid">
            {photos.map((photo, i) => (
              <p
                key={`caption-${order[i]}`}
                aria-hidden={i !== state.index}
                className="text-sm leading-snug text-muted transition-opacity ease-linear [grid-area:1/1]"
                style={{ opacity: i === state.index ? 1 : 0, transitionDuration: `${fade}ms` }}
              >
                {photo.caption ?? ""}
              </p>
            ))}
          </div>
        </div>
      )}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1">
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
        {`Photo ${state.index + 1} of ${photos.length}: ${current?.caption ?? current?.alt ?? ""}`}
      </p>
    </div>
  );
}
