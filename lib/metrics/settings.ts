import type { DepthSpec, HeightCurve, LevelCurve } from "./skyline/maths";

// Aaron's pick (lab round 4, settings key v5): the Full skyline look inside Up
// to now, six months, flat until seen, the bevel at height zero.
export const SKYLINE = {
  window: "6mo",
  lightestShare: 30,
  heightCurve: "power" as HeightCurve,
  levelCurve: "linear" as LevelCurve,
  heightCap: 1,
  durationMs: 1300,
  // World corner radius per unit of cell width: the flat cell's 0.17 at width 0.78, kept as the bar rises.
  prismRadius: 0.17 / 0.78,
  depth: { mode: "bevel", lift: 1.5, edge: 0.08, hi: 100, paper: 3 } as DepthSpec,
} as const;

// The seen rule: the morph starts when the block's top crosses 60 percent of
// the viewport and 60 percent of the chart is in view with the scroll settled
// (under 300px/s for 120ms), or slow enough to watch the whole morph.
export const MORPH = { triggerPct: 60, inViewShare: 0.6, settledMs: 120, settleSpeed: 300, durationMs: 1300 } as const;
