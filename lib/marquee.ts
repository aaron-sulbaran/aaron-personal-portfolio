// The scrolling track title: timings and the pure math behind it. A title that
// fits never moves; one that overflows rests at its start, scrolls slowly to
// its end, rests there, and returns, then repeats.
export const MARQUEE = {
  startHoldMs: 2000,
  endHoldMs: 1500,
  speedPxPerSecond: 35,
  fadePx: 16, // the soft mask on the clipped edge; the end of the title scrolls clear of it
  fitTolerancePx: 1,
} as const;

export type MarqueePlan = {
  distancePx: number;
  scrollMs: number;
  cycleMs: number;
  // WAAPI keyframes for translateX over one cycle: rest, scroll, rest, return.
  offsets: readonly [number, number, number, number, number];
  translatesPx: readonly [number, number, number, number, number];
};

export const overflowPx = (contentWidth: number, boxWidth: number): number => Math.max(0, contentWidth - boxWidth);

export const overflows = (contentWidth: number, boxWidth: number): boolean =>
  overflowPx(contentWidth, boxWidth) > MARQUEE.fitTolerancePx;

export const scrollDistancePx = (contentWidth: number, boxWidth: number): number =>
  overflows(contentWidth, boxWidth) ? Math.ceil(overflowPx(contentWidth, boxWidth) + MARQUEE.fadePx) : 0;

export const scrollDurationMs = (distancePx: number): number =>
  distancePx <= 0 ? 0 : Math.round((distancePx / MARQUEE.speedPxPerSecond) * 1000);

export function marqueePlan(contentWidth: number, boxWidth: number): MarqueePlan | null {
  const distancePx = scrollDistancePx(contentWidth, boxWidth);
  if (distancePx === 0) return null;
  const scrollMs = scrollDurationMs(distancePx);
  const { startHoldMs, endHoldMs } = MARQUEE;
  const cycleMs = startHoldMs + scrollMs + endHoldMs + scrollMs;
  return {
    distancePx,
    scrollMs,
    cycleMs,
    offsets: [0, startHoldMs / cycleMs, (startHoldMs + scrollMs) / cycleMs, (startHoldMs + scrollMs + endHoldMs) / cycleMs, 1],
    translatesPx: [0, 0, -distancePx, -distancePx, 0],
  };
}
