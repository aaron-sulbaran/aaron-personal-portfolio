"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { GALLERY } from "@/lib/gallery/constants";
import { quickCopy } from "@/lib/content/quick";
import { TITLE_UNFOLD } from "@/lib/quick/motion";
import type { TitleMode } from "@/lib/quick/settings";
import { useTransitionState } from "@/lib/quick/transitionStore";

// The page's title, M(inimum) V(iable) P(ortfolio). It reads as a tight "MVP"
// at first, then each word's rest slides out from its capital, in line, left to
// right: the rest's slot opens from 0 to its measured width (the capitals after
// it travel right as the room opens) while its text reveals under the slot's
// edge. It plays once, the first time the title has been in view for the delay;
// a click or tap, or Enter or Space while the title has focus, collapses it and
// plays it again. There is no hover trigger. The room the finished title needs is
// reserved by an invisible copy of it in the same grid cell, so nothing below
// ever moves. Below 480px the title is sized from the viewport (the finished
// title is about 7.63em wide, the page gutters 3rem) so it fits on one line and
// the reserved room is no taller than the collapsed title. Reduced
// motion, and the "spelled" mode, show the whole title at once. The heading is
// named "Minimum Viable Portfolio" once; the drawn parts are hidden from
// assistive tech.

export const LANE_HEADING_ID = "express-lane-title";

type Props = {
  mode?: TitleMode;
  delayMs?: number;
  staggerMs?: number;
  durationMs?: number;
  forceReduced?: boolean;
};

const SLOT_CLOSED_CLIP = "inset(-25% 0% -25% 0%)";
const COLLAPSE_SHARE = 0.55;
const COLLAPSE_EASE = "power2.inOut";

function Word({ capital, rest, last, live }: { capital: string; rest: string; last: boolean; live: boolean }) {
  const closedSlot = live ? "motion-safe:group-data-[state=closed]/mvp:w-0 motion-safe:group-data-[state=closed]/mvp:[clip-path:inset(-25%_0%_-25%_0%)]" : "";
  const closedRest = live ? "motion-safe:group-data-[state=closed]/mvp:opacity-0" : "";
  return (
    <span className="inline-block whitespace-nowrap">
      {capital}
      <span data-mvp-slot={live ? "" : undefined} className={`inline-block align-baseline ${closedSlot}`}>
        <span className="inline-block whitespace-nowrap">
          <span data-mvp-rest={live ? "" : undefined} className={`inline-block text-[0.45em] tracking-normal text-muted ${closedRest}`}>
            ({rest})
          </span>
          {!last && <span className="whitespace-pre"> </span>}
        </span>
      </span>
    </span>
  );
}

function Spelled({ live }: { live: boolean }) {
  const parts = quickCopy.titleParts;
  return (
    <>
      {parts.map(({ capital, rest }, index) => (
        <Fragment key={capital}>
          <Word capital={capital} rest={rest} last={index === parts.length - 1} live={live} />
        </Fragment>
      ))}
    </>
  );
}

export function MvpTitle({ mode = "unfold", delayMs = TITLE_UNFOLD.delayMs, staggerMs = TITLE_UNFOLD.staggerMs, durationMs = TITLE_UNFOLD.durationMs, forceReduced = false }: Props) {
  const rootRef = useRef<HTMLHeadingElement>(null);
  const replayRef = useRef<() => void>(() => {});
  const { phase } = useTransitionState();
  const settled = phase === "idle";
  const [open, setOpen] = useState(mode === "spelled" || forceReduced);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !settled || mode === "spelled" || forceReduced) return;
    const slots = [...root.querySelectorAll<HTMLElement>("[data-mvp-slot]")];
    const rests = [...root.querySelectorAll<HTMLElement>("[data-mvp-rest]")];
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const durationS = durationMs / 1000;
      const staggerS = staggerMs / 1000;
      let busy = false;
      let cancelled = false;
      let timeline: gsap.core.Timeline | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let observer: IntersectionObserver | undefined;

      const naturalWidth = (slot: HTMLElement) => (slot.firstElementChild as HTMLElement).getBoundingClientRect().width;
      const finish = () => {
        gsap.set([...slots, ...rests], { clearProps: "width,clipPath,opacity" });
        root.dataset.state = "open";
        setOpen(true);
        busy = false;
      };
      const play = (collapseFirst: boolean) => {
        busy = true;
        const widths = slots.map(naturalWidth);
        timeline?.kill();
        timeline = gsap.timeline({ onComplete: finish });
        timeline.set(slots, { clipPath: SLOT_CLOSED_CLIP }, 0);
        if (collapseFirst) {
          const collapseS = durationS * COLLAPSE_SHARE;
          timeline.fromTo(slots, { width: (i: number) => widths[i] }, { width: 0, duration: collapseS, ease: COLLAPSE_EASE, stagger: { each: staggerS / 2, from: "end" } }, 0);
          timeline.to(rests, { opacity: 0, duration: collapseS * 0.6, ease: "power1.in", stagger: { each: staggerS / 2, from: "end" } }, 0);
        }
        const start = timeline.duration();
        timeline.fromTo(slots, { width: 0 }, { width: (i: number) => widths[i], duration: durationS, ease: GALLERY.ease.gsap, stagger: staggerS }, start);
        timeline.fromTo(rests, { opacity: 0 }, { opacity: 1, duration: durationS * 0.7, ease: "power1.out", stagger: staggerS }, start);
      };

      replayRef.current = () => {
        if (!busy) play(true);
      };
      if (root.dataset.state !== "open") {
        const ready = document.fonts?.ready ?? Promise.resolve();
        void ready.then(() => {
          if (cancelled) return;
          observer = new IntersectionObserver(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting)) return;
              observer?.disconnect();
              timer = setTimeout(() => play(false), delayMs);
            },
            { threshold: 0.5 },
          );
          observer.observe(root);
        });
      }
      return () => {
        cancelled = true;
        observer?.disconnect();
        clearTimeout(timer);
        timeline?.kill();
        busy = false;
        replayRef.current = () => {};
      };
    });
    return () => mm.revert();
  }, [settled, mode, delayMs, staggerMs, durationMs, forceReduced]);

  const replay = () => replayRef.current();
  return (
    <h1
      ref={rootRef}
      id={LANE_HEADING_ID}
      tabIndex={-1}
      aria-label={quickCopy.title}
      data-lane-line=""
      data-lane-whole=""
      data-mvp-title=""
      data-mvp-mode={mode}
      data-state={open ? "open" : "closed"}
      onClick={replay}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        replay();
      }}
      className="group/mvp grid w-fit max-w-full cursor-default font-display text-display text-foreground focus-visible:outline-none max-[480px]:text-[length:calc((100vw_-_3rem)/7.9)]"
    >
      <span aria-hidden="true" data-mvp-ghost="" className="invisible col-start-1 row-start-1 select-none">
        <Spelled live={false} />
      </span>
      <span aria-hidden="true" className="col-start-1 row-start-1">
        <Spelled live />
      </span>
    </h1>
  );
}
