import { easeToward } from "@/lib/waveform/field";
import { MUSIC, SPECTRUM_BINS } from "./constants";

export interface MusicState { share: number; bins: Float32Array }
export const createMusic = (): MusicState => ({ share: 0, bins: new Float32Array(SPECTRUM_BINS) });

export function bandAt(bins: Float32Array, u: number): number {
  const x = Math.min(1, Math.max(0, u)) * (bins.length - 1);
  const i = Math.floor(x);
  const j = Math.min(bins.length - 1, i + 1);
  return bins[i] + (bins[j] - bins[i]) * (x - i);
}

// The music's hold on the dots: `share` eases to 1 while the soundtrack plays
// (0 otherwise: "Not now" and "paused" are the still shape), and each bin
// follows the levelled analyser times share and intensity at the band
// field's own speed (attack 0.052s, release 0.174s).
export function stepMusic(m: MusicState, dt: number, on: boolean, levelled: Float32Array): boolean {
  m.share = easeToward(m.share, on ? 1 : 0, on ? MUSIC.rise : MUSIC.fall, dt);
  if (!on && m.share < 1e-3) m.share = 0;
  const amount = m.share * MUSIC.intensity;
  const rise = 1 - Math.exp(-dt / MUSIC.attackS);
  const fall = 1 - Math.exp(-dt / MUSIC.releaseS);
  let moving = m.share > 0;
  for (let b = 0; b < m.bins.length; b++) {
    const target = (levelled[b] ?? 0) * amount;
    const before = m.bins[b];
    m.bins[b] = before + (target - before) * (target > before ? rise : fall);
    if (target === 0 && m.bins[b] < 1e-4) m.bins[b] = 0;
    if (m.bins[b] > 0) moving = true;
  }
  return moving;
}
