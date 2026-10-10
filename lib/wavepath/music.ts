import { SPECTRUM_BINS } from "./constants";

export interface MusicState { share: number; bins: Float32Array }
export const createMusic = (): MusicState => ({ share: 0, bins: new Float32Array(SPECTRUM_BINS) });

export function bandAt(bins: Float32Array, u: number): number {
  const x = Math.min(1, Math.max(0, u)) * (bins.length - 1);
  const i = Math.floor(x);
  const j = Math.min(bins.length - 1, i + 1);
  return bins[i] + (bins[j] - bins[i]) * (x - i);
}
