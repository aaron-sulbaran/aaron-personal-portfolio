// The seen-morph rule, pure: the morph to the skyline may start only when the
// chart is in view and will stay in view long enough to be watched. "In view"
// is a share of the chart's height inside the viewport. "Watched" is either a
// settled scroll (under a speed for a short hold) or a scroll slow enough that
// the chart keeps that share for the whole morph. No DOM here, so Node can
// check it without a browser.

export const visibleShare = (top: number, height: number, viewport: number): number =>
  height > 0 ? Math.max(0, Math.min(top + height, viewport) - Math.max(top, 0)) / height : 0;

// Scroll distance, in the direction of travel (1 down the page, -1 up), before
// the chart's visible share falls under `share`. A chart still arriving gains
// share first; the runway ends where it starts to leave.
export const runway = (top: number, height: number, viewport: number, share: number, dir: 1 | -1): number => {
  const limit = viewport + height;
  let seen = visibleShare(top, height, viewport) >= share;
  for (let d = 4; d <= limit; d += 4) {
    const inView = visibleShare(top - dir * d, height, viewport) >= share;
    if (seen && !inView) return d;
    seen = seen || inView;
  }
  return limit;
};

export type GateInput = {
  top: number;
  height: number;
  viewport: number;
  share: number; // 0 to 1
  speed: number; // px per second, absolute
  dir: 1 | -1;
  settled: boolean;
  durationMs: number;
};

export const gateOpen = (g: GateInput): boolean => {
  if (visibleShare(g.top, g.height, g.viewport) < g.share) return false;
  if (g.settled || g.speed <= 0) return true;
  return (runway(g.top, g.height, g.viewport, g.share, g.dir) / g.speed) * 1000 >= g.durationMs;
};

// Scroll speed over a short window, and when it was last above the settle
// speed. A scroll that stops sends no more events, so "settled" is measured
// from the last fast sample, never from a final slow one.
export function createSpeedometer(windowMs = 100) {
  const samples: { t: number; y: number }[] = [];
  let speed = 0;
  let dir: 1 | -1 = 1;
  let lastFastAt = -Infinity;
  return {
    push(t: number, y: number, fastAbove: number) {
      samples.push({ t, y });
      while (samples.length > 2 && t - samples[0].t > windowMs) samples.shift();
      const first = samples[0];
      const span = t - first.t;
      if (span >= 12) {
        speed = (Math.abs(y - first.y) / span) * 1000;
        if (y !== first.y) dir = y > first.y ? 1 : -1;
      }
      if (speed >= fastAbove) lastFastAt = t;
    },
    read(now: number, settledMs: number) {
      const last = samples[samples.length - 1];
      const idle = !last || now - last.t > windowMs;
      return { speed: idle ? 0 : speed, dir, settled: now - lastFastAt >= settledMs, lastFastAt };
    },
    reset() {
      samples.length = 0;
      speed = 0;
      lastFastAt = -Infinity;
    },
  };
}
