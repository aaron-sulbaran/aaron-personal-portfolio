import { DEFAULT_LABELS, type MetricsLabels } from "./labels";
import type { DepthSpec, HeightCurve, LevelCurve } from "./skyline/maths";
import type { CodexColor, SegmentGap, TokenColorSet } from "./skyline/stack";

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

// Which series the strip's chart shows: Commits (GitHub) or Tokens (Claude Code and Codex).
export type SeriesChoice = "commits" | "tokens";

// The Tokens view and the switch between the two (the metrics lab tunes
// these; /lab/metrics, dev only). The token days are far more skewed than the
// commits (one 7.5B day over a 72M median), so the curve lifts the small days.
// minShare 0 draws each tool's true share of a day; segmentGap is the seam of
// page colour between the two tools' segments, in CSS pixels. The wave is the
// switch carried across the strip (lib/metrics/wave.ts): waveGapMs between
// one figure's mask and the next, waveOffsetMs between the bars and the first
// figure, maskMs for one mask (a figure's out and in each take one).
// namesPerGroup is how many tools the toolkit band names per group before "+N more".
export type TokensSettings = {
  colorSet: TokenColorSet;
  codexColor: CodexColor;
  heightCurve: HeightCurve;
  heightCap: number;
  minShare: number;
  segmentGap: SegmentGap;
  switchMs: number;
  switchStagger: number;
  first: SeriesChoice;
  waveGapMs: number;
  waveOffsetMs: number;
  maskMs: number;
  namesPerGroup: number;
  labels: MetricsLabels;
};

// Aaron's pick (metrics lab, 2026-10-13); the wave timings are his round 3 brief.
export const TOKENS: TokensSettings = {
  colorSet: "official",
  codexColor: "slate",
  heightCurve: "sqrt",
  heightCap: 1,
  minShare: 0.02,
  segmentGap: 0,
  switchMs: 1500,
  switchStagger: 0.42,
  first: "commits",
  waveGapMs: 160,
  waveOffsetMs: 200,
  maskMs: 480,
  namesPerGroup: 5,
  labels: DEFAULT_LABELS,
};
