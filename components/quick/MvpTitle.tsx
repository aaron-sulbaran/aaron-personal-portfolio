"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { GALLERY } from "@/lib/gallery/constants";
import { textIn } from "@/lib/gallery/reveal";
import { gsap } from "@/lib/gsap";
import { quickCopy } from "@/lib/content/quick";
import { TITLE_UNFOLD } from "@/lib/quick/motion";
import type { TitleMode } from "@/lib/quick/settings";
import { useTransitionState } from "@/lib/quick/transitionStore";

// The page's title, M(inimum) V(iable) P(ortfolio). The three capitals read
// alone, then each word's rest slides out from its capital, left to right, one
// after another, once the page has settled. Hovering or focusing the title, or
// tapping it on a touch screen, plays the unfold again. The full width is
// reserved from the first paint (the rests are only clipped and transparent), so
// nothing below the title ever moves. Reduced motion, and the "spelled" mode,
// show the whole title at once. The heading is named "Minimum Viable Portfolio"
// once; the drawn parts are hidden from assistive tech.

export const LANE_HEADING_ID = "express-lane-title";

type Props = {
  mode?: TitleMode;
  delayMs?: number;
  staggerMs?: number;
  forceReduced?: boolean;
};

export function MvpTitle({ mode = "unfold", delayMs = TITLE_UNFOLD.delayMs, staggerMs = TITLE_UNFOLD.staggerMs, forceReduced = false }: Props) {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const replayRef = useRef<() => void>(() => {});
  const { phase } = useTransitionState();
  const settled = phase === "idle";
  const [open, setOpen] = useState(mode === "spelled" || forceReduced);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !settled || mode === "spelled" || forceReduced) return;
    const rests = [...root.querySelectorAll<HTMLElement>("[data-mvp-rest]")];
    const unfold = textIn("ltr");
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      let busy = false;
      const play = (delayS: number) => {
        busy = true;
        gsap.fromTo(
          rests,
          { ...unfold.from, x: "-0.4em", opacity: 0 },
          {
            ...unfold.to,
            x: 0,
            opacity: 1,
            duration: GALLERY.mask.lengthMs / 1000,
            ease: GALLERY.ease.gsap,
            stagger: staggerMs / 1000,
            delay: delayS,
            clearProps: "clipPath,transform,opacity",
            onComplete: () => {
              root.dataset.state = "open";
              setOpen(true);
              busy = false;
            },
          },
        );
      };
      replayRef.current = () => {
        if (!busy) play(0);
      };
      if (root.dataset.state !== "open") play(delayMs / 1000);
      return () => {
        replayRef.current = () => {};
      };
    });
    return () => mm.revert();
  }, [settled, mode, delayMs, staggerMs, forceReduced]);

  const replay = () => replayRef.current();
  return (
    <h1
      ref={rootRef}
      id={LANE_HEADING_ID}
      tabIndex={-1}
      aria-label={quickCopy.title}
      data-lane-line=""
      data-mvp-title=""
      data-mvp-mode={mode}
      data-state={open ? "open" : "closed"}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") replay();
      }}
      onFocus={replay}
      onClick={replay}
      className="group/mvp w-fit font-display text-display text-foreground focus-visible:outline-none"
    >
      <span aria-hidden="true">
        {quickCopy.titleParts.map(({ capital, rest }, index) => (
          <Fragment key={capital}>
            {index > 0 && " "}
            <span className="inline-block whitespace-nowrap">
              {capital}
              <span
                data-mvp-rest=""
                className="inline-block text-[0.45em] tracking-normal text-muted motion-safe:group-data-[state=closed]/mvp:opacity-0 motion-safe:group-data-[state=closed]/mvp:[clip-path:inset(-25%_102%_-25%_-2%)]"
              >
                ({rest})
              </span>
            </span>
          </Fragment>
        ))}
      </span>
    </h1>
  );
}
