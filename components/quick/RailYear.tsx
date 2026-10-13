"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/quick/gsap";
import { QUICK_MOTION, timings } from "@/lib/quick/motion";

// The rail's big year: it follows the item in view (any data-year inside the
// track) and counts through the years between, one tick at a time. It is a
// readout, not a checkpoint, so it follows the reader both ways. Under reduced
// motion it changes at once. Decoration: every item shows its own years.

type Props = { trackRef: RefObject<HTMLElement | null>; first: string; runKey: string; speed: number; forceReduced: boolean };

export function RailYear({ trackRef, first, runKey, speed, forceReduced }: Props) {
  const yearRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const year = yearRef.current;
    if (!track || !year) return;
    const { yearTickS } = timings(speed);
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
      const reduce = forceReduced || Boolean(context.conditions?.reduce);
      const shown = { value: Number(year.textContent) || Number(first) };
      const write = () => {
        year.textContent = String(Math.round(shown.value));
      };
      const tickTo = (target: number) => {
        gsap.killTweensOf(shown);
        if (reduce) {
          shown.value = target;
          write();
          return;
        }
        const steps = Math.abs(target - Math.round(shown.value));
        if (!steps) return;
        context.add(() => gsap.to(shown, { value: target, duration: steps * yearTickS, ease: "none", snap: { value: 1 }, onUpdate: write }));
      };
      const triggers = [...track.querySelectorAll<HTMLElement>("[data-year]")].map((el) =>
        ScrollTrigger.create({
          trigger: el,
          start: `top ${QUICK_MOTION.yearLine * 100}%`,
          end: `bottom ${QUICK_MOTION.yearLine * 100}%`,
          onToggle: (self) => {
            if (self.isActive) tickTo(Number(el.dataset.year));
          },
        }),
      );
      return () => {
        gsap.killTweensOf(shown);
        for (const trigger of triggers) trigger.kill();
      };
    });
    return () => mm.revert();
  }, [trackRef, first, runKey, speed, forceReduced]);

  return (
    <span ref={yearRef} className="block font-display text-display-md tabular-nums text-foreground">
      {first}
    </span>
  );
}
