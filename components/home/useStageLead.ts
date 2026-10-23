"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { HeroScene } from "@/lib/coil/heroStill";
import { getDeal, subscribeDeal } from "@/lib/home/deal";
import { gsap } from "@/lib/gsap";

// The sticky stage's reach up the page. The Coil's canvas is a stage (at least a
// screen tall, and as tall as the cards section's frame) that sticks at the top
// of the screen; to cover the home's first screen before the click it must
// start at the page's first pixel, so the rail it sticks in reaches up over the
// first screen by the first screen's own height (--run-lead, set here on the
// section; the rail and the stage read it in CSS). The stage then sticks through
// the deal's one-screen scroll and lets go where the cards section's frame ends
// (components/home/StageRail.tsx). Once the canvas has no more work on the first
// screen the lead is let go and the stage is just the section again: with no
// scene to draw it (reduced motion, no WebGL), at once; the moment the deal is
// over, whatever the reader is looking at. A reader the deal left inside the
// sticky range (a scroll that stopped short, an upward interrupt) has the stage
// pinned over the first screen; the lead goes at once and the stage glides down
// to the section's top (a transform, no layout per frame), so it never covers
// the first screen's text or its "Back to my cards". A reader already at or past
// the section's top sees no change; neither does a load that never dealt (a
// return to the home by client navigation). A replay brings the lead back.
//
// On a phone the frame (the Coil's own region) is shorter than the stage, which
// is a screen tall: --stage-overhang is how far the released stage reaches below
// the frame, over the columns, which the dealt Coil is masked off (CSS).

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
      const first = document.querySelector<HTMLElement>("[data-first-screen]");
      let lead = 0;
      if (first && !released.current) lead = section.getBoundingClientRect().top - first.getBoundingClientRect().top;
      section.style.setProperty("--run-lead", `${Math.round(Math.max(0, lead))}px`);
      const frame = section.querySelector("[data-coil-frame]")?.getBoundingClientRect();
      const overhang = frame ? Math.max(0, Math.round(Math.max(window.innerHeight, frame.height) - frame.height)) : 0;
      section.style.setProperty("--stage-overhang", `${overhang}px`);
      section.toggleAttribute("data-overhang", overhang > 1);
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
    const first = document.querySelector("[data-first-screen]");
    if (first) observer.observe(first);
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
