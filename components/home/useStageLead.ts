"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { HeroScene } from "@/lib/coil/heroStill";
import { getDeal, subscribeDeal } from "@/lib/home/deal";

// The sticky stage's reach up the page. The Coil's canvas is a stage as tall as
// the cards section that sticks at the top of the screen; to sit in the
// teaser's slot before the click it must start at page 1's foot, so the rail it
// sticks in reaches up over the teaser by the teaser's own height (--run-lead,
// set here on the section; the rail and the stage read it in CSS). Once the
// wheel has no more work there, the lead is let go and the stage is just the
// section again: with no scene to draw it (reduced motion, no WebGL), at once;
// after the deal, as soon as the reader has reached the section's top (so
// nothing jumps under them), or at once if this load never dealt it (a return
// to the home by client navigation). A replay brings the lead back.

export function useStageLead(sectionRef: RefObject<HTMLElement | null>, scene: HeroScene, reducedMotion: boolean) {
  const released = useRef(false);
  const sawDealing = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const measure = () => {
      const teaser = document.querySelector<HTMLElement>("[data-teaser]");
      const lead = teaser && !released.current ? Math.max(0, section.getBoundingClientRect().top - teaser.getBoundingClientRect().top) : 0;
      section.style.setProperty("--run-lead", `${Math.round(lead)}px`);
    };
    const update = () => {
      const state = getDeal();
      if (state.phase === "dealing") sawDealing.current = true;
      let next = released.current;
      if (reducedMotion || scene === "still") next = true;
      else if (state.phase === "idle") {
        next = false;
        sawDealing.current = false;
      } else if (state.phase === "dealt" && (!sawDealing.current || section.getBoundingClientRect().top <= 0)) next = true;
      if (next !== released.current) {
        released.current = next;
        measure();
      }
    };
    measure();
    update();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    const teaser = document.querySelector("[data-teaser]");
    if (teaser) observer.observe(teaser);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", update, { passive: true });
    const unsubscribe = subscribeDeal(update);
    void document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", update);
      unsubscribe();
    };
  }, [sectionRef, scene, reducedMotion]);
}
