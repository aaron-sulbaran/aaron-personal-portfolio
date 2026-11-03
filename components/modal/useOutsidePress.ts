"use client";

import { useRef, type PointerEvent } from "react";
import { closesOnPress, type Press } from "@/lib/outsidePress";

// A tap or click on a modal's backdrop closes it (the rule is lib/outsidePress):
// spread what this returns on the fixed layer that holds the panel. Pointer
// events, not mouse events, because a touch screen does not send a mouse press
// to a plain div (iOS Safari), so a tap on the backdrop did nothing; and a
// press is judged where it goes down and where it comes up, never on the way
// (a drag that starts in the panel, a text selection, the card pager's swipe and
// a scroll of the backdrop all end without closing it). The panel needs no
// handler: a press that goes down on it is not on the backdrop. After a close
// the click that follows the press is swallowed, so on a touch screen it cannot
// land on whatever the modal was covering. Escape, the close button and focus
// return are the modal's own and unchanged.
export function useOutsidePress(onClose: () => void) {
  const start = useRef<Press | null>(null);
  const press = (event: PointerEvent<HTMLElement>): Press => ({ onBackdrop: event.target === event.currentTarget, x: event.clientX, y: event.clientY });
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      start.current = event.isPrimary && event.button === 0 ? press(event) : null;
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const began = start.current;
      start.current = null;
      if (!closesOnPress(began, press(event))) return;
      swallowNextClick();
      onClose();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

const SWALLOW_MS = 400;

function swallowNextClick() {
  const stop = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), SWALLOW_MS);
}
