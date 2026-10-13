import { rampOf } from "./maths";

// A stacked day: two tools in one bar, the lower tool from the base. In the
// skyline the bar is cut across its height; in the flat view the square is
// cut across its rows, the lower tool at the bottom. One share drives both.

// The lower tool's share of the bar, 0 to 1. A day with nothing, or only the
// lower tool, is all lower (1); a day with only the upper tool is 0.
// `minShare` keeps a tool that has any tokens at least that share of the bar,
// so a sliver stays visible; 0 is the true proportion.
export const lowerShare = (lower: number, upper: number, minShare = 0): number => {
  const lo = lower > 0 ? lower : 0;
  const up = upper > 0 ? upper : 0;
  if (up === 0) return 1;
  if (lo === 0) return 0;
  const floor = Math.max(0, Math.min(0.5, minShare));
  const share = lo / (lo + up);
  return Math.min(1 - floor, Math.max(floor, share));
};

// The two segments' heights: the lower tool's and the upper's, summing to the bar.
export const segmentHeights = (height: number, share: number): [number, number] => {
  const lower = height * Math.max(0, Math.min(1, share));
  return [lower, height - lower];
};

// The flat cell's cut, in grid units: the square from y0 to y0 + w is the
// upper tool above `split` and the lower tool below it (y grows down the
// screen in the flat view).
export const splitAt = (y0: number, w: number, share: number): number => y0 + w * (1 - Math.max(0, Math.min(1, share)));

// The token colour sets the lab compares. Each is a pair of custom properties
// in app/globals.css (light and dark), never a raw colour here.
export type TokenColorSet = "brand" | "official" | "sea" | "ink";
export const TOKEN_SETS: readonly TokenColorSet[] = ["brand", "official", "sea", "ink"];

// The seam between the two segments, in CSS pixels. The two brand sets put
// two colours of close brightness side by side, so they part by a pixel of
// page; the sea sets already differ in lightness.
export type SegmentGap = 0 | 1 | 2;
export const SEGMENT_GAPS: readonly SegmentGap[] = [0, 1, 2];
export const defaultGap = (set: TokenColorSet): SegmentGap => (set === "brand" || set === "official" ? 1 : 0);

export const tokenColors = (set: TokenColorSet) => ({
  claude: `var(--tokens-${set}-claude)`,
  codex: `var(--tokens-${set}-codex)`,
});

// Each tool's four steps toward the page, the same rule as the accent's ramp.
export const tokenRamps = (set: TokenColorSet, lightestShare: number) => {
  const c = tokenColors(set);
  return { claude: rampOf(c.claude, lightestShare), codex: rampOf(c.codex, lightestShare) };
};
