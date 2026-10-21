import { FOOTER_GAP_PX, HERO_LIFT_PX, ISLE } from "./constants";

// The desktop isle riding clear of what it would cover, pure. The isle is fixed
// to the bottom left of the screen; the footer scrolling in would run under it
// and cover the period, and in the hero the Coil and Band toggle holds the same
// corner.

// How far an element whose bottom edge is `bottomOffset` above the viewport's
// bottom must rise to sit `gap` above a footer whose top edge is `footerTop`
// from the viewport's top. 0 while the footer is still below it.
export function footerLift(footerTop: number, viewportHeight: number, bottomOffset: number = ISLE.bottomPx, gap: number = FOOTER_GAP_PX): number {
  return Math.max(0, viewportHeight - bottomOffset - footerTop + gap);
}

// While the band is still ahead of the reader (the hero, the book) the isle
// stands this far above its dock line.
export const heroLift = (ahead: boolean): number => (ahead ? HERO_LIFT_PX : 0);
