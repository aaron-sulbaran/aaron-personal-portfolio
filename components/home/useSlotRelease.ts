"use client";

import { useEffect } from "react";
import { RELAYOUT_EVENT } from "@/components/soundtrack/path/pathView";
import { ScrollTrigger } from "@/lib/gsap";
import { getDeal, subscribeDeal } from "@/lib/home/deal";

// The first screen's ribbon slot ([data-coil-ribbon]) is room for the ribbon
// until the ribbon becomes the Coil; after the deal it is a blank band between
// the first screen's text and the cards. Once a scene is dealing or has dealt
// the cards and the slot is entirely above the reader, it closes up (data-gone),
// and the page is held where it was: the cards section stays under the reader
// whatever the page lost above it. The scroll is set once, in the same frame,
// and never while the reader is still scrolling (a touch fling is not cut
// short): the moment the reader stops. On a click that is the end of the deal's
// own scroll, a second before the deal ends, so the layout settling (a
// ScrollTrigger refresh follows a height change) is over before the cards are
// the reader's. A reader still looking at the slot keeps it until they scroll
// away. With no scene (reduced motion, no WebGL) the slot holds the ribbon's
// still and never closes. A replay opens it again. The scene keeps the slot's
// last place for the ribbon (scene/renderer.ts), so closing it mid-deal moves
// nothing.

// The reader has stopped scrolling this long before the page is moved under them.
const IDLE_MS = 140;

export function useSlotRelease() {
  useEffect(() => {
    const slot = document.querySelector<HTMLElement>("[data-coil-ribbon]");
    if (!slot) return;
    let timer = 0;
    let lastScroll = Number.NEGATIVE_INFINITY;
    const holdSection = (toggle: () => void) => {
      const section = document.getElementById("work");
      const before = section?.getBoundingClientRect().top ?? 0;
      toggle();
      const moved = (section?.getBoundingClientRect().top ?? 0) - before;
      if (Math.abs(moved) > 0.5) window.scrollBy({ top: moved, behavior: "instant" });
      // Everything below moved without anything resizing: what measures the page
      // by its positions (the wave's route, every scroll trigger) measures again,
      // here and now, so no refresh arrives later to interrupt a scroll.
      window.dispatchEvent(new Event(RELAYOUT_EVENT));
      ScrollTrigger.refresh();
    };
    const evaluate = () => {
      timer = 0;
      const state = getDeal();
      const dealtByScene = (state.phase === "dealing" || state.phase === "dealt") && state.spent && document.querySelector('section[data-scene="on"]') !== null;
      const gone = slot.hasAttribute("data-gone");
      if (dealtByScene && !gone && slot.getBoundingClientRect().bottom <= 0) holdSection(() => slot.setAttribute("data-gone", ""));
      else if (!dealtByScene && gone) holdSection(() => slot.removeAttribute("data-gone"));
    };
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(evaluate, IDLE_MS);
    };
    const onScroll = () => {
      lastScroll = performance.now();
      soon();
    };
    // The deal's own changes: at once for a reader who is not scrolling (the page
    // never moves under a gesture that starts right after the deal), else when they stop.
    const onDeal = () => {
      if (performance.now() - lastScroll >= IDLE_MS) {
        window.clearTimeout(timer);
        evaluate();
      } else soon();
    };
    soon();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", soon);
    const unsubscribe = subscribeDeal(onDeal);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", soon);
      unsubscribe();
    };
  }, []);
}
