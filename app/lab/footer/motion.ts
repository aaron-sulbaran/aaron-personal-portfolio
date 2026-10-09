// The wordmark's motion, pure: the swell near the pointer, the press on
// click (a damped spring per letter), and the rise out of the baseline the
// first time the footer is seen. Clocks in seconds unless a name says ms.

// 1 at the pointer, 0 at `radius` and beyond, smooth at both ends.
export function falloff(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  const t = Math.abs(distance) / radius;
  if (t >= 1) return 0;
  const s = 1 - t * t;
  return s * s;
}

export function swellWeight(base: number, amount: number, distance: number, radius: number): number {
  return base + amount * falloff(distance, radius);
}

// A letter's vertical scale while pressed: 1 is untouched, 1 - depth is flat.
export function pressTarget(depth: number, influence: number): number {
  return 1 - Math.min(1, Math.max(0, depth)) * Math.min(1, Math.max(0, influence));
}

// Frame-rate independent easing toward a target over time constant `tau`.
export function approach(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  return target + (current - target) * Math.exp(-dt / tau);
}

export type Spring = { x: number; v: number };

// One step of a unit-mass spring (stiffness k, damping ratio zeta), split
// into substeps of at most 4ms so a long frame never explodes it.
export function springStep(s: Spring, target: number, stiffness: number, zeta: number, dt: number): Spring {
  const steps = Math.max(1, Math.ceil(dt / 0.004));
  const h = dt / steps;
  const c = 2 * zeta * Math.sqrt(stiffness);
  let { x, v } = s;
  for (let i = 0; i < steps; i++) {
    v += (-stiffness * (x - target) - c * v) * h;
    x += v * h;
  }
  return { x, v };
}

export function springAtRest(s: Spring, target: number, eps = 1e-4): boolean {
  return Math.abs(s.x - target) < eps && Math.abs(s.v) < eps * 10;
}

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export type RiseEase = "expo" | "cubic" | "back";
const EASE: Record<RiseEase, (t: number) => number> = { expo: easeOutExpo, cubic: easeOutCubic, back: easeOutBack };

// How far letter `index` has risen (0 below the baseline, 1 in place) after
// `elapsedMs` of the rise, each letter starting `staggerMs` after the last.
export function riseProgress(elapsedMs: number, index: number, durationMs: number, staggerMs: number, ease: RiseEase = "expo"): number {
  const local = elapsedMs - index * staggerMs;
  if (local <= 0) return 0;
  if (durationMs <= 0 || local >= durationMs) return 1;
  return EASE[ease](local / durationMs);
}

export function riseTotalMs(count: number, durationMs: number, staggerMs: number): number {
  return Math.max(0, count - 1) * staggerMs + durationMs;
}

// The lean of the Profa comparison: toward the pointer, strongest close in.
export function leanAngle(maxDeg: number, dx: number, influence: number, radius: number): number {
  if (radius <= 0) return 0;
  const side = Math.max(-1, Math.min(1, dx / radius));
  return maxDeg * side * influence;
}

// Frame-rate independent easing by a share `k` of the way each 60fps frame:
// to + (from - to) * (1 - k)^(dt * 60). The shutter's pivot rides it.
export function easeToward(from: number, to: number, k: number, dt: number): number {
  if (k >= 1) return to;
  return to + (from - to) * Math.pow(1 - Math.max(0, k), Math.max(0, dt) * 60);
}

// The shutter pivot's target, toward the pointer: the pointer's offset from
// the period's center (stage px, y down) over the pivot's reach, held to
// the unit disc, y up. Over the period it follows the pointer; from afar it
// leans the whole reach toward it.
export function pivotTarget(dx: number, dy: number, reachPx: number): [number, number] {
  if (reachPx <= 0) return [0, 0];
  const x = dx / reachPx;
  const y = -dy / reachPx;
  const r = Math.hypot(x, y);
  return r > 1 ? [x / r, y / r] : [x, y];
}

// The letter under the pointer for the waist slice: inside the word's band
// and within a letter's half width (plus a margin) of its center, the
// nearest such letter; -1 when the pointer is over none.
export function hoveredLetter(
  px: number,
  py: number,
  centersX: readonly number[],
  halfWidths: readonly number[],
  top: number,
  bottom: number,
  margin: number,
): number {
  if (py < top || py > bottom) return -1;
  let best = -1;
  let bestDx = Infinity;
  centersX.forEach((cx, i) => {
    const dx = Math.abs(px - cx);
    if (dx <= (halfWidths[i] ?? 0) + margin && dx < bestDx) {
      best = i;
      bestDx = dx;
    }
  });
  return best;
}
