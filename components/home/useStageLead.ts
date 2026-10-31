"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { HeroScene } from "@/lib/coil/heroStill";
import { getDeal, subscribeDeal } from "@/lib/home/deal";
import { gsap } from "@/lib/gsap";
import { ctaStickPx, stageLeadPx } from "@/lib/home/stageLead";

// The sticky stage's reach up the page. The Coil's canvas is a stage as tall as
// the cards section's frame that sticks at the top of the screen; to hold the
// ribbon at page 1's foot before the click it must start above the ribbon, so the
// rail it sticks in reaches up over page 1's foot by the stage's lead
// (--run-lead, set here on the section; the rail and the stage read it in CSS;
// lib/home/stageLead.ts works it out: the distance from the ribbon's middle less
// room for the wheel, to the section's top). Once the canvas has no more work
// there, the lead is let go and the stage is just the section again: with no
// scene to draw it (reduced motion, no WebGL), at once; the moment the deal is
// over, whatever the reader is looking at. A reader the deal left inside the
// sticky range (a scroll that stopped short, an upward interrupt) has the stage
// pinned over page 1's foot; the lead goes at once and the stage glides down to
// the section's top (a transform, no layout per frame), so it never covers page
// 1's text or its "Back to my cards". A reader already at or past the section's
// top sees no change; neither does a load that never dealt (a return to the home
// by client navigation). A replay brings the lead back.
//
// "Deal me in" and its line go with the ribbon while the stage is stuck: the same
// measure puts the button's pin where the button is when the stage sticks, for as
// long as the stage's range (--cta-stick and --cta-room on page 1's foot), so the
// page scrolling on from the stick never lifts the button into the ribbon above it.

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
      const slot = document.querySelector("[data-coil-ribbon]")?.getBoundingClientRect();
      const frame = section.querySelector("[data-coil-frame]")?.getBoundingClientRect();
      const foot = document.querySelector<HTMLElement>("[data-intro-foot]");
      // Page 2's phone band (the pane beside the columns is not rendered): the scene sizes the wheel as on the band it was tuned on.
      const phone = section.querySelector("[data-coil-pane]")?.getClientRects().length === 0;
      let lead = 0;
      let stick: number | null = null;
      if (slot && frame && !released.current) {
        lead = stageLeadPx({ sectionTop: section.getBoundingClientRect().top, slotCenter: slot.top + slot.height / 2, frameHeight: frame.height, canvasWidth: frame.width, phone });
        if (foot && slot.height > 0) {
          stick = ctaStickPx({ frameHeight: frame.height, canvasWidth: frame.width, slotHeight: slot.height, gapPx: parseFloat(getComputedStyle(foot).rowGap) || 0, phone });
        }
      }
      const run = `${Math.round(Math.max(0, lead))}px`;
      section.style.setProperty("--run-lead", run);
      // The button goes with the ribbon while the stage is stuck (app/globals.css .intro-foot__cta-pin):
      // it sticks where it was when the stage stuck, for the stage's own range, and is an ordinary
      // block again once the stage has no lead.
      if (foot) {
        foot.style.setProperty("--cta-room", lead > 0 && stick !== null ? run : "0px");
        if (lead > 0 && stick !== null) foot.style.setProperty("--cta-stick", `${Math.round(stick)}px`);
        else foot.style.removeProperty("--cta-stick");
      }
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
    const foot = document.querySelector("[data-intro-foot]");
    if (foot) observer.observe(foot);
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
