// The band's run leaving with the scroll (lib/wavepath/constants, BAND_SWEEP_S). Pure: the band's view keeps the level and reads
// the scroll; these say where the scroll has the run, where its tail falls at a level, and how far the level may move in a frame.

// How far the scroll has swept the run off: 0 (the band's bottom edge at or below the release line, `line` px down the viewport)
// keeps the whole run, 1 (that edge at the viewport's top or above) none of it.
export const sweepLevel = (bandBottom: number, line: number): number => (line > 0 ? Math.min(1, Math.max(0, 1 - bandBottom / line)) : 0);

// The run's tail at a level, as arc s: one soft tail's width (`fade`) before the run's left end keeps it whole, its right end
// (`runLen`) keeps none, so the run leaves to the right and comes back from the right, dithered over the soft tail like the train.
export const tailAtLevel = (level: number, runLen: number, fade: number): number => -fade + level * (runLen + fade);

// The level a frame of `dt` seconds later: toward the scroll's level, but a whole sweep takes at least `shortestS` seconds. A step
// that is under the cap lands on the scroll's level, so a steady scroll is tracked exactly; 0 jumps straight there.
export function chaseLevel(level: number, target: number, dt: number, shortestS: number): number {
  if (shortestS <= 0 || !Number.isFinite(level)) return target;
  const most = Math.max(0, dt) / shortestS;
  return level + Math.max(-most, Math.min(most, target - level));
}
