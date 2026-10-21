import { DOCK } from "@/lib/waveform/dock";

// The isle at the footer, pure. The isle (the pill, the lab's docked sheet, the
// phone's bottom bar) is fixed to the bottom of the screen, so the footer
// scrolling in would run under it and cover the period. These numbers say how
// far to ride up so the isle's bottom edge clears the footer's top edge.

// The pill's capsule and the docked sheet end this far above the viewport's bottom.
export const ISLE_BOTTOM_PX = DOCK.baselineFromBottomPx - DOCK.capsulePx / 2;
export const BAR_BOTTOM_PX = 12;
export const FOOTER_GAP_PX = 14;

// How far an element whose bottom edge is `bottomOffset` above the viewport's
// bottom must rise to sit `gap` above a footer whose top edge is `footerTop`
// from the viewport's top. 0 while the footer is still below it.
export function footerLift(footerTop: number, viewportHeight: number, bottomOffset: number, gap: number = FOOTER_GAP_PX): number {
  return Math.max(0, viewportHeight - bottomOffset - footerTop + gap);
}

// Whether the isle and the footer would meet right now.
export const footerReaches = (lift: number): boolean => lift > 0;
