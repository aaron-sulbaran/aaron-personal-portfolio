"use client";

import { type RefObject } from "react";

// Presentational index that sits under the settled deck / carousel. It names the
// active card (its number + short title) so a visitor knows what a card is before
// opening it. All the dynamic text is written imperatively by TileRing via the
// refs below (see writeActiveCard) so hovering/swiping never re-renders the 20
// tiles. This component holds layout and styling only, never animation logic.
//
// Desktop: a home-state subtitle inviting the visitor to hover, crossfading in
// place with a `NN · Title` line that names the hovered card (the parent toggles
// both opacities together). Mobile: the inkwell-style stack of faded previous
// title / current `NN · Title` / faded next title for the centered card, always
// visible since the carousel always has a focused card.

type DeckIndexProps = {
  isMobile: boolean;
  heading: string;
  // Desktop home-state line ("hover a card ..."), shown when nothing is hovered.
  subtitle: string;
  subtitleRef: RefObject<HTMLParagraphElement>;
  numRef: RefObject<HTMLSpanElement>;
  titleRef: RefObject<HTMLSpanElement>;
  // Desktop: wraps the single index line so the parent can fade it in/out.
  lineRef: RefObject<HTMLDivElement>;
  // Mobile: faded previous / next card titles around the current one.
  prevRef: RefObject<HTMLSpanElement>;
  nextRef: RefObject<HTMLSpanElement>;
};

export function DeckIndex({
  isMobile,
  heading,
  subtitle,
  subtitleRef,
  numRef,
  titleRef,
  lineRef,
  prevRef,
  nextRef,
}: DeckIndexProps) {
  return (
    <>
      <p className="font-serif text-2xl italic text-foreground md:text-3xl">
        {heading}
      </p>

      {isMobile ? (
        <div className="flex flex-col items-center gap-1.5">
          <span
            ref={prevRef}
            className="text-[11px] font-medium uppercase tracking-caps text-muted opacity-50"
          />
          <div className="flex items-baseline justify-center gap-2">
            <span
              ref={numRef}
              className="text-[11px] font-medium tabular-nums tracking-caps text-muted"
            />
            <span aria-hidden="true" className="text-[11px] text-muted">
              ·
            </span>
            <span
              ref={titleRef}
              className="text-[13px] font-medium uppercase tracking-caps text-foreground"
            />
          </div>
          <span
            ref={nextRef}
            className="text-[11px] font-medium uppercase tracking-caps text-muted opacity-50"
          />
        </div>
      ) : (
        // The subtitle defines the row height; the index line is overlaid on it
        // (absolute) so they swap in place with no layout shift as the parent
        // crossfades their opacities on hover / un-hover.
        <div className="relative">
          <p
            ref={subtitleRef}
            className="text-[11px] font-medium uppercase tracking-caps text-muted transition-opacity duration-300"
          >
            {subtitle}
          </p>
          <div
            ref={lineRef}
            className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-300"
          >
            <span
              ref={numRef}
              className="text-[11px] font-medium tabular-nums tracking-caps text-muted"
            />
            <span aria-hidden="true" className="text-[11px] text-muted">
              ·
            </span>
            <span
              ref={titleRef}
              className="text-[13px] font-medium uppercase tracking-caps text-foreground"
            />
          </div>
        </div>
      )}
    </>
  );
}
