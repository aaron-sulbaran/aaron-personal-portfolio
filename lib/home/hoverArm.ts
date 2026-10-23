import { COIL } from "@/lib/coil/constants";

// Hover focus waits for a real pointer move, as wheel capture does (the input
// model, lib/coil/capture.ts): a pointer parked where a layout change put a
// column title under it (the columns arriving at the end of the deal, a reload)
// is no hover, and must not turn the Coil. After a reset the pointer counts as
// where it last was (a browser may send an event for a pointer that has not
// moved, from the same place); a move farther than rearmPx from there arms hover
// focus. With no place known (the page just loaded) the first event is only the
// place the pointer is. Pure; the controller (components/home/HomeController.tsx)
// owns the one state.

export type Point = { x: number; y: number };

export type HoverArm = {
  armed: boolean;
  anchor: Point | null;
  last: Point | null;
  rearmPx: number;
};

export function createHoverArm(rearmPx: number = COIL.capture.rearmPx): HoverArm {
  return { armed: false, anchor: null, last: null, rearmPx };
}

// Back to waiting for a real move (the deal just ended): from where the pointer last was.
export function disarmHover(arm: HoverArm): void {
  arm.armed = false;
  arm.anchor = arm.last;
}

// A pointer event at (x, y), client px. True when this move armed hover focus.
export function moveHover(arm: HoverArm, x: number, y: number): boolean {
  arm.last = { x, y };
  if (arm.armed) return false;
  if (!arm.anchor) {
    arm.anchor = { x, y };
    return false;
  }
  if (Math.hypot(x - arm.anchor.x, y - arm.anchor.y) <= arm.rearmPx) return false;
  arm.armed = true;
  return true;
}
