// The name's cursor repel: a low resolution displacement buffer laid over the
// name's rect (greeting included). Each cell holds a 2D offset in CSS px. A
// pointer stroke pushes the cells near its path away from it, harder and wider
// the faster it moves; every cell then springs back to zero, critically
// damped, so the grain flows back in with no overshoot and no ringing. The
// composite shader offsets its grain or dot lookup by the sampled vector.
//
// Adapted from the repelling effect in rinblog.org (direction is cell minus
// pointer, falloff from the pointer to a radius, positions stored in the
// handler and resolved once per frame): here the particles are the cells of a
// field and the return is an analytic spring, not a per-frame lerp.
//
// Pure, no DOM, zero allocation per frame: the scene owns one field and one
// byte array and reuses them.

export const REPEL = {
  cols: 96,
  rows: 40,
  // A slow drift nudges a little; a fast swipe parts a wide swath.
  slow: { speed: 150, radius: 40, push: 3 },
  fast: { speed: 2600, radius: 220, push: 28 },
  // Below this speed the push fades toward zero (a still pointer does nothing).
  creepSpeed: 60,
  // The push rises from zero on the path itself to its full strength this far
  // out (a fraction of the radius), so the grain parts and thins along the
  // path instead of tearing open in a blank swath.
  core: 0.3,
  maxPush: 28,
  // Critically damped return: from rest at d0, d(t) = d0 (1 + wt) e^(-wt),
  // under 1 percent of d0 at 0.9s for w = 7.5.
  refillS: 0.9,
  omega: 7.5,
  // Below this (px and px/s) a cell is at rest.
  restEpsilon: 0.02,
} as const;

export type RepelRect = { x: number; y: number; w: number; h: number };
export type RepelPoint = { x: number; y: number };

export type RepelField = {
  readonly cols: number;
  readonly rows: number;
  readonly d: Float32Array; // offsets, x then y per cell, row 0 at the rect's top
  readonly v: Float32Array; // their velocities
  active: boolean; // any cell away from rest
};

export function createRepelField(cols: number = REPEL.cols, rows: number = REPEL.rows): RepelField {
  return { cols, rows, d: new Float32Array(cols * rows * 2), v: new Float32Array(cols * rows * 2), active: false };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Radius and push for a pointer moving at `speed` CSS px per second.
export function strokeStrength(speed: number): { radius: number; push: number } {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const t = smooth(clamp01((s - REPEL.slow.speed) / (REPEL.fast.speed - REPEL.slow.speed)));
  const creep = clamp01(s / REPEL.creepSpeed);
  return {
    radius: lerp(REPEL.slow.radius, REPEL.fast.radius, t),
    push: lerp(REPEL.slow.push, REPEL.fast.push, t) * creep,
  };
}

// One pointer segment (from, to) that took `dt` seconds, in the same CSS px
// space as `rect`. Cells within the stroke's radius of the segment are raised
// to at least its push along the direction away from the path (never beyond:
// a slow drift repeated over one spot stays a small nudge), then clamped. The
// push profile is zero on the path, full at REPEL.core of the radius and zero
// again at the radius.
export function injectStroke(field: RepelField, rect: RepelRect, from: RepelPoint, to: RepelPoint, dt: number) {
  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const length = Math.hypot(sx, sy);
  if (!(dt > 0) || !(length >= 0.5) || !(rect.w > 0) || !(rect.h > 0)) return;
  const { radius, push } = strokeStrength(length / dt);
  if (push <= 0) return;
  const { cols, rows, d } = field;
  const cw = rect.w / cols;
  const ch = rect.h / rows;
  // Only the cells in the segment's bounding box plus the radius.
  const c0 = Math.max(0, Math.floor((Math.min(from.x, to.x) - radius - rect.x) / cw));
  const c1 = Math.min(cols - 1, Math.ceil((Math.max(from.x, to.x) + radius - rect.x) / cw));
  const r0 = Math.max(0, Math.floor((Math.min(from.y, to.y) - radius - rect.y) / ch));
  const r1 = Math.min(rows - 1, Math.ceil((Math.max(from.y, to.y) + radius - rect.y) / ch));
  if (c0 > c1 || r0 > r1) return;
  const ux = sx / length;
  const uy = sy / length;
  const max = REPEL.maxPush;
  let touched = false;
  for (let row = r0; row <= r1; row++) {
    const py = rect.y + (row + 0.5) * ch;
    for (let col = c0; col <= c1; col++) {
      const px = rect.x + (col + 0.5) * cw;
      // The closest point on the segment, and the way out from it.
      const along = Math.min(length, Math.max(0, (px - from.x) * ux + (py - from.y) * uy));
      let ox = px - (from.x + ux * along);
      let oy = py - (from.y + uy * along);
      const dist = Math.hypot(ox, oy);
      if (dist >= radius) continue;
      if (dist > 1e-6) {
        ox /= dist;
        oy /= dist;
      } else {
        // On the path itself: out along the segment's normal.
        ox = -uy;
        oy = ux;
      }
      const s = dist / radius;
      const amount = push * (1 - smooth(s)) * smooth(Math.min(1, s / REPEL.core));
      if (amount <= 0) continue;
      const i = 2 * (row * cols + col);
      const current = d[i] * ox + d[i + 1] * oy;
      if (current >= amount) continue;
      let nx = d[i] + ox * (amount - current);
      let ny = d[i + 1] + oy * (amount - current);
      const size = Math.hypot(nx, ny);
      if (size > max) {
        nx *= max / size;
        ny *= max / size;
      }
      d[i] = nx;
      d[i + 1] = ny;
      touched = true;
    }
  }
  if (touched) field.active = true;
}

// Advances every cell's spring by dt seconds, exactly (the analytic critically
// damped step, stable for any dt). A velocity that would carry a cell past
// zero is capped first, so no offset ever changes sign or grows back.
export function stepRepel(field: RepelField, dt: number) {
  if (!field.active) return;
  const { d, v } = field;
  const w = REPEL.omega;
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const e = Math.exp(-w * step);
  const eps = REPEL.restEpsilon;
  let moving = false;
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    let vel = v[i];
    // Moving toward zero faster than w |x| would cross it: cap.
    if (vel * x < 0 && Math.abs(vel) > w * Math.abs(x)) vel = -w * x;
    // Moving away from zero (a fresh push has no velocity of its own): none.
    if (vel * x > 0) vel = 0;
    const c = vel + w * x;
    let nx = (x + c * step) * e;
    let nv = (vel - w * c * step) * e;
    if (Math.abs(nx) < eps && Math.abs(nv) < eps) {
      nx = 0;
      nv = 0;
    } else {
      moving = true;
    }
    d[i] = nx;
    v[i] = nv;
  }
  field.active = moving;
}

// Largest offset in the field, CSS px.
export function maxOffset(field: RepelField) {
  let max = 0;
  for (let i = 0; i < field.d.length; i += 2) max = Math.max(max, Math.hypot(field.d[i], field.d[i + 1]));
  return max;
}

// RGBA bytes for a DataTexture: x and y offsets as 128 + 127 * d / maxPush,
// so rest is the midpoint and the clamp lands on 1 and 255.
export function encodeRepel(field: RepelField, bytes: Uint8Array) {
  const { d } = field;
  const k = 127 / REPEL.maxPush;
  for (let i = 0, j = 0; i < d.length; i += 2, j += 4) {
    bytes[j] = Math.round(Math.min(255, Math.max(1, 128 + d[i] * k)));
    bytes[j + 1] = Math.round(Math.min(255, Math.max(1, 128 + d[i + 1] * k)));
    bytes[j + 2] = 128;
    bytes[j + 3] = 255;
  }
}
