"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { HeroScene } from "@/lib/coil/heroStill";
import { getDeal, subscribeDeal } from "@/lib/home/deal";

// The sticky stage's reach up the page. The Coil's canvas is a stage as tall as
// the cards section that sticks at the top of the screen; to sit in the
// teaser's slot before the click it must start at page 1's foot, so the rail it
// sticks in reaches up over the teaser by the teaser's own height, or less where
// the stage is shorter than that and must still hold the slot (--run-lead,
// set here on the section; the rail and the stage read it in CSS). Once the
// wheel has no more work there, the lead is let go and the stage is just the
// section again: with no scene to draw it (reduced motion, no WebGL), at once;
// after the deal, as soon as the reader has reached the section's top (so
// nothing jumps under them), or at once if this load never dealt it (a return
// to the home by client navigation). A replay brings the lead back.

// The room kept below the slot inside the stage, px.
const SLOT_ROOM_PX = 24;
// The reader has reached the cards section when its top is this close to the
// top of the screen (a scroll lands on whole device pixels, so not exactly 0).
const REACHED_PX = 4;

export function useStageLead(sectionRef: RefObject<HTMLElement | null>, scene: HeroScene, reducedMotion: boolean) {
  const released = useRef(false);
  const sawDealing = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const measure = () => {
      const teaser = document.querySelector<HTMLElement>("[data-teaser]");
      let lead = 0;
      if (teaser && !released.current) {
        const sectionTop = section.getBoundingClientRect().top;
        lead = sectionTop - teaser.getBoundingClientRect().top;
        // A stage shorter than the teaser's foot (a phone's: the Coil's own
        // region, not the whole section) starts lower, so the slot is inside it.
        const slot = document.querySelector("[data-coil-wheel]")?.getBoundingClientRect();
        const stage = section.querySelector("[data-coil-frame]")?.getBoundingClientRect();
        if (slot && stage) lead = Math.min(lead, stage.height + sectionTop - slot.bottom - SLOT_ROOM_PX);
      }
      section.style.setProperty("--run-lead", `${Math.round(Math.max(0, lead))}px`);
    };
    const update = () => {
      const state = getDeal();
      if (state.phase === "dealing") sawDealing.current = true;
      let next = released.current;
      if (reducedMotion || scene === "still") next = true;
      else if (state.phase === "idle") {
        next = false;
        sawDealing.current = false;
      } else if (state.phase === "dealt" && (!sawDealing.current || section.getBoundingClientRect().top <= REACHED_PX)) next = true;
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
