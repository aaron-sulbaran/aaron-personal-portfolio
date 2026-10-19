// The trip bar's mapping from how deep the reader is in the rail to where
// Misuki is on the bar. The bar spaces its stops evenly; the rail's year rows
// are as tall as their cards, so the car runs piecewise: between two stops it
// covers the bar's even step while the reader covers that stretch of the rail.
// She reaches a stop on the same scroll that lights its year. Pure.

const clamp01 = (n: number) => (Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)));

// stops: each stop's depth in the track (0 to 1, rising). Returns 0 to 1 along the bar.
export function barPosition(depth: number, stops: readonly number[]): number {
  const n = stops.length;
  if (n === 0) return clamp01(depth);
  if (n === 1) return depth >= stops[0] ? 1 : 0;
  const d = clamp01(depth);
  if (d <= stops[0]) return 0;
  if (d >= stops[n - 1]) return 1;
  let i = 0;
  while (i < n - 2 && d >= stops[i + 1]) i += 1;
  const span = stops[i + 1] - stops[i];
  const t = span > 0 ? (d - stops[i]) / span : 1;
  return (i + t) / (n - 1);
}

// Where stop i sits along the bar, 0 to 1.
export const stopAt = (i: number, count: number) => (count > 1 ? i / (count - 1) : 0);
