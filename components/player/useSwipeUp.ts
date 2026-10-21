"use client";

import { useEffect, type RefObject } from "react";
import { ISLAND } from "@/lib/player/constants";

// A swipe up on the island closes it. Gestures that start on the track list
// (which scrolls) or a slider are left alone.
export function useSwipeUp(target: RefObject<HTMLElement | null>, enabled: boolean, onSwipe: () => void) {
  useEffect(() => {
    const el = target.current;
    if (!el || !enabled) return;
    let startY: number | null = null;
    const down = (event: PointerEvent) => {
      const own = event.target instanceof Element && event.target.closest("[data-player-tracks], input[type=range]");
      startY = own ? null : event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (startY !== null && startY - event.clientY > ISLAND.swipeUpPx) onSwipe();
      startY = null;
    };
    const cancel = () => {
      startY = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", cancel);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [target, enabled, onSwipe]);
}
