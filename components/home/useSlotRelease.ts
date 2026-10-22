"use client";

import { useEffect, type RefObject } from "react";
import { getDeal, subscribeDeal } from "@/lib/home/deal";

// The teaser's wheel slot is room for the wheel until the wheel becomes the
// Coil; after the deal it is a blank circle between page 1's text and the
// cards, on a phone most of a screen of nothing. Once a scene has dealt the
// cards and the slot is entirely above the reader, it closes up (data-gone),
// and the page is held where it was: the cards section stays under the reader
// whatever the page lost above it (the scroll is set once, in the same frame,
// never while the reader is still scrolling, so a touch fling is not cut
// short). A reader still looking at the slot keeps it until they scroll away.
// With no scene (reduced motion, no WebGL) the slot holds the wheel still and
// never closes. A replay opens it again.

// The reader has stopped scrolling this long before the page is moved under them.
const IDLE_MS = 140;

export function useSlotRelease(slotRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    let timer = 0;
    const holdSection = (toggle: () => void) => {
      const section = document.getElementById("work");
      const before = section?.getBoundingClientRect().top ?? 0;
      toggle();
      const moved = (section?.getBoundingClientRect().top ?? 0) - before;
      if (Math.abs(moved) > 0.5) window.scrollBy({ top: moved, behavior: "instant" });
    };
    const evaluate = () => {
      timer = 0;
      const state = getDeal();
      const dealtByScene = state.phase === "dealt" && state.spent && document.querySelector('section[data-scene="on"]') !== null;
      const gone = slot.hasAttribute("data-gone");
      if (dealtByScene && !gone && slot.getBoundingClientRect().bottom <= 0) holdSection(() => slot.setAttribute("data-gone", ""));
      else if (!dealtByScene && gone) holdSection(() => slot.removeAttribute("data-gone"));
    };
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(evaluate, IDLE_MS);
    };
    soon();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    const unsubscribe = subscribeDeal(soon);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      unsubscribe();
    };
  }, [slotRef]);
}
