// Where the reader is against the band, and the boxes the hand-off to the isle
// travels between. Pure: the band's rect and the viewport in, a zone or a box
// out.

export type Zone = "ahead" | "in" | "past";

// A band whose top edge is below this share of the viewport is not on screen
// yet; a player opened then docks instead of opening out of sight.
export const AHEAD_TOP = 0.75;

export function zoneOf(rect: { top: number; bottom: number }, viewportHeight: number, line: number): Zone {
  if (rect.bottom <= line * viewportHeight) return "past";
  if (rect.top >= viewportHeight * AHEAD_TOP) return "ahead";
  return "in";
}

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

// The pill's dock (lib/waveform/dock DOCK): the capsule's left edge and the gap
// under it. The width is the capsule at rest with a title in it.
export const ISLE = { insetPx: 24, bottomPx: 54, heightPx: 36, widthPx: 190 } as const;
export const BAR = { insetPx: 12, bottomPx: 12, heightPx: 56 } as const;

export function isleBox(viewportHeight: number): Box {
  return { left: ISLE.insetPx, top: viewportHeight - ISLE.bottomPx - ISLE.heightPx, width: ISLE.widthPx, height: ISLE.heightPx };
}

export function barBox(viewportWidth: number, viewportHeight: number): Box {
  return { left: BAR.insetPx, top: viewportHeight - BAR.bottomPx - BAR.heightPx, width: viewportWidth - BAR.insetPx * 2, height: BAR.heightPx };
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
