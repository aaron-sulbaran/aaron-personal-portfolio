import { AHEAD_TOP, ISLE } from "./constants";

// Where the reader is against the band, and the boxes the hand-off to the isle
// travels between. Pure: the band's rect and the viewport in, a zone or a box
// out.

export type Zone = "ahead" | "in" | "past";

// "past": the band's bottom edge has risen to the hand-off line. "ahead": the
// band's top edge is still below the fold, so a player opened then has no band
// to open in. "in": the band is on screen between them.
export function zoneOf(rect: { top: number; bottom: number }, viewportHeight: number, line: number): Zone {
  if (rect.bottom <= line * viewportHeight) return "past";
  if (rect.top >= viewportHeight * AHEAD_TOP) return "ahead";
  return "in";
}

// The zone from the two ScrollTrigger reads the host keeps: past wins, then
// ahead. A page with no band (a route other than the home page) is all ahead.
export const zoneFrom = (past: boolean, ahead: boolean): Zone => (past ? "past" : ahead ? "ahead" : "in");

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const toBox = (rect: { left: number; top: number; width: number; height: number }): Box => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

export function lerpBox(from: Box, to: Box, t: number): Box {
  const mix = (a: number, b: number) => a + (b - a) * t;
  return { left: mix(from.left, to.left), top: mix(from.top, to.top), width: mix(from.width, to.width), height: mix(from.height, to.height) };
}

// The collapsed pill's box on its dock, for the desktop hand-off's end.
export function isleBox(viewportHeight: number): Box {
  return { left: ISLE.insetPx, top: viewportHeight - ISLE.bottomPx - ISLE.heightPx, width: ISLE.widthPx, height: ISLE.heightPx };
}

// Corners round from the card's radius to a full pill as the box shrinks to
// the target's height.
export function cornerRadius(from: number, box: Box): number {
  return Math.min(box.height / 2, from);
}

// The pill's note and title ghosting in over the last 40 percent of the way to
// the isle, so the glass reads as the pill forming; on the way back it is gone
// before the box has opened to 60 percent.
export function ghostOpacity(progress: number): number {
  return Math.min(1, Math.max(0, (progress - 0.6) / 0.4));
}
