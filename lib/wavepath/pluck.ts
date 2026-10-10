import { PLUCK } from "./constants";

export interface PluckState { s: Float32Array; age: Float32Array; amp: Float32Array; count: number; nearJ: number; nearSide: number }
export const createPlucks = (): PluckState => ({ s: new Float32Array(PLUCK.max), age: new Float32Array(PLUCK.max), amp: new Float32Array(PLUCK.max), count: 0, nearJ: -1, nearSide: 0 });

const DECAY_S = Math.max(0.2, PLUCK.recovery * 0.6);

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
