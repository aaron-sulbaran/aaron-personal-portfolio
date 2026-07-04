"use client";

import { type RefObject } from "react";

// Presentational left text panel for the settled ring-arc carousel. It names
// the focused card (index, kind, explored status, title, blurb) so a visitor
// knows what a card is before opening it. All the dynamic text is written
// imperatively by TileRing via the refs below (see writeActiveCard) so
// rotating/auto-advancing the carousel never re-renders the 20 tiles. This
// component holds layout and styling only, never animation logic; the parent
// drives the panel container's opacity/slide-in on the transition clock.
//
// Layout mirrors the prototype's [data-panel]: an index row (NN / 20, kind,
// explored status), a large serif italic title, a one-line blurb, a thin
// divider, and a small helper line explaining how to drive the carousel.

type ArcIndexProps = {
  total: number;
  helperLine: string;
  numRef: RefObject<HTMLSpanElement>;
  kindRef: RefObject<HTMLSpanElement>;
  statusRef: RefObject<HTMLSpanElement>;
  titleRef: RefObject<HTMLHeadingElement>;
  blurbRef: RefObject<HTMLParagraphElement>;
  // The live region wrapper; TileRing dips its opacity for a beat when the
  // focused card changes so the text swap reads soft instead of hard.
  swapRef: RefObject<HTMLDivElement>;
};

export function ArcIndex({
  total,
  helperLine,
  numRef,
  kindRef,
  statusRef,
  titleRef,
  blurbRef,
  swapRef,
}: ArcIndexProps) {
  return (
    <>
      {/* aria-live region: announces the focused card whenever TileRing's
          writeActiveCard rotates it (rotation snap, auto-advance, keyboard
          step). Scoped to number + kind + status + title only, NOT the blurb
          or helper line, so a rotation reads as one short phrase ("05 / 20,
          Case study, Anthropic, Unexplored") instead of a paragraph. A plain
          nested flex column (not display:contents) so the live region stays
          intact in Safari/VoiceOver, which has historically dropped ARIA
          semantics on display:contents elements; the inner gap-5 reproduces
          the parent's spacing so this wrapper is visually invisible. */}
      <div ref={swapRef} aria-live="polite" aria-atomic="true" className="flex flex-col gap-5">
        <div className="flex items-baseline gap-4">
          <span className="text-sm font-medium tabular-nums tracking-caps text-foreground">
            <span ref={numRef} /> / {total}
          </span>
          <span
            ref={kindRef}
            className="text-[10.5px] font-medium uppercase tracking-caps text-muted"
          />
          <span
            ref={statusRef}
            className="text-[10.5px] font-medium uppercase tracking-caps text-accent"
          />
        </div>

        <h2
          ref={titleRef}
          className="text-balance font-serif text-[clamp(2.75rem,5vw,4.5rem)] italic leading-[1.02] text-foreground"
        />
      </div>

      <p ref={blurbRef} className="max-w-[26rem] text-base leading-relaxed text-muted" />

      <div className="h-px w-16 bg-border" />

      <p className="max-w-[24rem] text-[12.5px] leading-relaxed text-muted">{helperLine}</p>
    </>
  );
}
