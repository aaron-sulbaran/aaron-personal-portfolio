import { PLUCK } from "./constants";
import type { PathColumns } from "./columns";

// The pointer's pluck (the lab's pathCursor.ts, "pluck" mode alone): crossing
// the line sends a damped ripple along it both ways, like a plucked string.
// Keyed by arc length, so the band and the path share one string. The
// conductor owns the pointer; views only offer their nearest column.
export interface PluckState { s: Float32Array; age: Float32Array; amp: Float32Array; count: number; nearJ: number; nearSide: number }
export interface PointerTrack { x: number; y: number; on: boolean; speed: number; moved: boolean; lastT: number }
export interface Near { j: number; side: number; s: number; d2: number }

const LIFE_S = Math.max(0.6, PLUCK.recovery * 2);
const DECAY_S = Math.max(0.2, PLUCK.recovery * 0.6);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const createPlucks = (): PluckState => ({ s: new Float32Array(PLUCK.max), age: new Float32Array(PLUCK.max), amp: new Float32Array(PLUCK.max), count: 0, nearJ: -1, nearSide: 0 });
export const createPointer = (): PointerTrack => ({ x: 0, y: 0, on: false, speed: 0, moved: false, lastT: 0 });
export const createNear = (): Near => ({ j: -1, side: 0, s: 0, d2: Infinity });

// A pointer sample in client px at event ms: speed eases over 70ms; a jump past 320px is not a stroke.
export function movePointer(p: PointerTrack, x: number, y: number, t: number): void {
  const dt = p.lastT ? Math.max(1e-3, (t - p.lastT) / 1000) : 0;
  const d = Math.hypot(x - p.x, y - p.y);
  if (p.on && dt > 0 && d < 320) p.speed += (d / dt - p.speed) * (1 - Math.exp(-dt / 0.07));
  p.x = x;
  p.y = y;
  p.on = true;
  p.moved = true;
  p.lastT = t;
}

// The drawn column nearest (x, y), in the columns' own px, if nearer than `near`.
export function nearestColumn(cols: PathColumns, x: number, y: number, head: number, tail: number, near: Near): void {
  for (let j = 0; j < cols.count; j++) {
    const s = cols.s[j];
    if (s > head || s < tail) continue;
    const dx = x - cols.x[j];
    const dy = y - cols.y[j];
    const d2 = dx * dx + dy * dy;
    if (d2 >= near.d2) continue;
    near.d2 = d2;
    near.j = j;
    near.s = s;
    near.side = Math.sign(dx * cols.nx[j] + dy * cols.ny[j]);
  }
}

// After a move: the nearest drawn column within PLUCK.radius (j -1 if none). A change of side within four columns plucks.
export function notePointer(p: PluckState, j: number, side: number, s: number, speed: number): void {
  if (p.nearJ >= 0 && j >= 0 && Math.abs(j - p.nearJ) <= 4 && side !== 0 && p.nearSide !== 0 && side !== p.nearSide) {
    const slot = p.count < PLUCK.max ? p.count++ : 0;
    p.s[slot] = s;
    p.age[slot] = 0;
    p.amp[slot] = 0.35 * PLUCK.strength * clamp01(0.35 + speed / 1500);
  }
  p.nearJ = j;
  p.nearSide = side;
}

export function stepPlucks(p: PluckState, dt: number): boolean {
  let k = 0;
  for (let i = 0; i < p.count; i++) {
    const age = p.age[i] + dt;
    if (age >= LIFE_S) continue;
    p.s[k] = p.s[i];
    p.age[k] = age;
    p.amp[k] = p.amp[i];
    k++;
  }
  p.count = k;
  return k > 0;
}

// The ripples' displacement at arc length s, in amplitudes.
export function pluckAt(p: PluckState, s: number): number {
  let sum = 0;
  for (let i = 0; i < p.count; i++) {
    const front = Math.abs(s - p.s[i]) - PLUCK.speed * p.age[i];
    const env = Math.exp(-((front / PLUCK.width) ** 2));
    if (env < 1e-3) continue;
    sum += p.amp[i] * Math.exp(-p.age[i] / DECAY_S) * env * Math.sin((2 * Math.PI * front) / PLUCK.wave);
  }
  return sum;
}
