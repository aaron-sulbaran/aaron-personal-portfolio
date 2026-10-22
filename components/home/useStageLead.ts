"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { HeroScene } from "@/lib/coil/heroStill";
import { getDeal, subscribeDeal } from "@/lib/home/deal";
import { gsap } from "@/lib/gsap";

// The sticky stage's reach up the page. The Coil's canvas is a stage as tall as
// the cards section that sticks at the top of the screen; to sit in the
// teaser's slot before the click it must start at page 1's foot, so the rail it
// sticks in reaches up over the teaser by the teaser's own height, or less where
// the stage is shorter than that and must still hold the slot (--run-lead,
// set here on the section; the rail and the stage read it in CSS). Once the
// wheel has no more work there, the lead is let go and the stage is just the
// section again: with no scene to draw it (reduced motion, no WebGL), at once;
// the moment the deal is over, whatever the reader is looking at. A reader the
// deal left inside the sticky range (a scroll that stopped short, an upward
// interrupt) has the stage pinned over page 1's foot; the lead goes at once
// and the stage glides down to the section's top (a transform, no layout per
// frame), so it never covers page 1's text or its "Back to my cards". A
// reader already at or past the section's top sees no change; neither does a
// load that never dealt (a return to the home by client navigation). A replay
// brings the lead back.

// The room kept below the slot inside the stage, px.
const SLOT_ROOM_PX = 24;
// The stage's glide down to the section once the deal has let go of it.
const GLIDE_S = 0.55;
// A move shorter than this is no move (a scroll lands on whole device pixels).
const REACHED_PX = 1;

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
    const stageEl = () => section.querySelector<HTMLElement>("[data-coil-sticky]");
    const update = () => {
      const state = getDeal();
      if (state.phase === "dealing") sawDealing.current = true;
      let next = released.current;
      if (reducedMotion || scene === "still") next = true;
      else if (state.phase === "idle") {
        next = false;
        sawDealing.current = false;
      } else if (state.phase === "dealt") next = true;
      if (next === released.current) return;
      const stage = stageEl();
      const glide = next && sawDealing.current && !reducedMotion && scene !== "still" && stage !== null;
      const before = glide ? stage.getBoundingClientRect().top : 0;
      released.current = next;
      measure();
      if (!stage) return;
      gsap.killTweensOf(stage);
      gsap.set(stage, { clearProps: "transform" });
      if (!glide) return;
      const moved = before - stage.getBoundingClientRect().top;
      if (Math.abs(moved) > REACHED_PX) gsap.fromTo(stage, { y: moved }, { y: 0, duration: GLIDE_S, ease: "power2.out", clearProps: "transform" });
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
      const stage = stageEl();
      if (stage) gsap.killTweensOf(stage);
    };
  }, [sectionRef, scene, reducedMotion]);
}
