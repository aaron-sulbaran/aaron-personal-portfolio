import { COIL, type CoilConstants } from "./constants";

// The deal's one speed curve (docs/superpowers/specs/2026-10-22-wheel-deal-motion.md
// section 3). One scalar drives every layout of the strand, the wheel, the
// band and the helix: its offset s, in cards. Wheel, band and helix all pose
// slot j from (j + s) * angStep, so the angular speed is continuous across the
// layout changes by construction; this module is the only place s is decided
// while the deal runs.
//
// The speed in cards per second, from the click:
//   omega(t) = omega0 + (peak - omega0) * up(t) - (peak - idle) * down(t)
//   up   = power2.out over [0, upMs]            the spin-up, responding on the first frame
//   down = smoothstep over [slowStart, slowEnd] the band slowing to the idle pace
// Both ends of both ramps have zero slope, so omega is C1 across every phase
// boundary, never dwells at zero, and ends at exactly the idle pace the
// conveyor carries on with. It is integrated once per deal (Simpson, 1 ms)
// into a table, so s(ms) is a lookup and every pinned frame is deterministic.
// Never chain eased tweens on rotation: they would stall at the joins.

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// GSAP's power2 family (a cubic), so the DOM tweens and this curve agree by name.
export const power2Out = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const power2InOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

export type DealSpeed = {
  startCardsPerSecond: number; // omega0: the wheel's pace at the click
  peakCardsPerSecond: number;
  idleCardsPerSecond: number;
  upMs: number;
  slowStartMs: number;
  slowMs: number;
};

// A coarse pointer (a phone, which can drop to 30 Hz) peaks lower: at most
// coarsePeakCardsPerSecond, never above the fine peak.
export function peakFor(c: CoilConstants, coarse: boolean): number {
  const t = c.deal.timeline;
  return coarse ? Math.min(t.peakCardsPerSecond, t.coarsePeakCardsPerSecond) : t.peakCardsPerSecond;
}

export function dealSpeedOf(startCardsPerSecond: number, c: CoilConstants = COIL, coarse = false): DealSpeed {
  const t = c.deal.timeline;
  return {
    startCardsPerSecond,
    peakCardsPerSecond: peakFor(c, coarse),
    idleCardsPerSecond: c.idleCardsPerSecond,
    upMs: t.upMs,
    slowStartMs: t.slowStartMs,
    slowMs: t.slowMs,
  };
}

// Cards per second, ms after the click.
export function dealOmega(ms: number, p: DealSpeed): number {
  const up = power2Out(ms / p.upMs);
  const down = smoothstep((ms - p.slowStartMs) / p.slowMs);
  return p.startCardsPerSecond + (p.peakCardsPerSecond - p.startCardsPerSecond) * up - (p.peakCardsPerSecond - p.idleCardsPerSecond) * down;
}

// The scene's clock runs this long: the pull has landed and the field is open.
export function sceneMs(c: CoilConstants = COIL): number {
  const t = c.deal.timeline;
  return Math.max(t.pullStartMs + t.pullMs, t.openStartMs + c.deal.open.ms);
}

// s(ms) - s(0) in cards at every whole millisecond up to `untilMs`, Simpson
// over each millisecond (the speed at its two ends and its middle).
export function integrateDealSpeed(p: DealSpeed, untilMs: number): Float32Array {
  const steps = Math.max(1, Math.ceil(untilMs));
  const table = new Float32Array(steps + 1);
  const h = 1 / 1000;
  let sum = 0;
  let left = dealOmega(0, p);
  for (let i = 0; i < steps; i++) {
    const middle = dealOmega(i + 0.5, p);
    const right = dealOmega(i + 1, p);
    sum += (h / 6) * (left + 4 * middle + right);
    table[i + 1] = sum;
    left = right;
  }
  return table;
}

// s(ms) - s(0): a lookup, linear between the table's milliseconds. Past the
// table's end the strand has been at the idle pace for a while, so it carries
// on at it.
export function dealOffsetAt(table: Float32Array, ms: number, idleCardsPerSecond: number = COIL.idleCardsPerSecond): number {
  const last = table.length - 1;
  if (ms <= 0) return 0;
  if (ms >= last) return table[last] + (idleCardsPerSecond * (ms - last)) / 1000;
  const i = Math.floor(ms);
  return table[i] + (table[i + 1] - table[i]) * (ms - i);
}
