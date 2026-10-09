import { apertureBlades, placeBlades, type Pivot } from "./aperture";
import { METRICS } from "./glyphs";
import { band, bounds, dBowl, mirrorX, rect, superExponent, type Contour } from "./primitives";

// The "Constructed" face, pure: an original lowercase alphabet for the glyphs
// "build.stuff" needs, built from filled primitives (rectangles, elliptical
// bands, a D bowl) with every end cut flat and every join overlapped. It
// shares the procedural face's metrics (ascender 1, x-height 0.6, y up,
// baseline 0). Two numbers set the weight: the stem (S, how thick a vertical
// is) and the bar (B, how thick a horizontal is), so the swell raises them
// per letter and the face stays monoline at any weight. A letter widens with
// its stems and keeps its counters; its height never moves, so nothing it
// does reaches under the baseline or over the ascender.

const X = METRICS.xHeight;
const A = METRICS.ascender;
// Where a cut-flat t stands, between the x-height and the ascender.
const T_TOP = 0.8;
// The smallest counter a heavy bar may leave; bars clamp to keep it.
const MIN_COUNTER = 0.05;
// Joins overlap by this much, so no hairline opens between two shapes.
const JOIN = 0.004;

// The counters, fixed in units: a letter's width is these plus its stems.
const SHAPE = {
  bowl: { flat: 0.12, reach: 0.13 }, // b and d: the counter's straight run from the stem, and its curved reach past it
  u: { half: 0.13 }, // half the u's counter
  s: { reach: 0.09, spine: 0.05, bar: 0.88 }, // the s: each curve's counter reach, the straight spine, its bars as a share of B
  t: { left: 0.1, right: 0.18, hook: 0.1, hookHeight: 0.26 },
  f: { left: 0.1, right: 0.15, terminal: 0.22, hook: 0.11, hookHeight: 0.26 },
  iDotGap: 0.1,
} as const;

// What one glyph is drawn at. stem and bar are the letter's own (swelled);
// barV and dot are their vertical extents before the press's squash, so a
// pressed letter's bars and dots keep their thickness on screen.
export type GlyphPose = { stem: number; bar: number; barV: number; dot: number; n: number };

export type ConstructedShape = { stem: number; bar: number; roundness: number };
export type ApertureShape = { blades: 3 | 4; scale: number; gap: number };

export function glyphPose(shape: ConstructedShape, swellAmount: number, swell: number, squash = 1): GlyphPose {
  const stem = shape.stem + swellAmount * Math.max(0, swell);
  const bar = shape.bar * (shape.stem > 0 ? stem / shape.stem : 1);
  const sq = Math.max(0.05, squash);
  return { stem, bar, barV: bar / sq, dot: stem / sq, n: superExponent(shape.roundness) };
}

export type BuiltGlyph = { contours: Contour[]; width: number; top: number };

type Builder = (p: GlyphPose) => BuiltGlyph;

// A bowl's bar, clamped so its counter keeps MIN_COUNTER of height.
const bowlBar = (barV: number, halfHeight: number) => Math.min(barV, halfHeight - MIN_COUNTER / 2);

const b: Builder = (p) => {
  const S = p.stem;
  const reach = SHAPE.bowl.reach + S;
  const cx = S + SHAPE.bowl.flat;
  const bar = bowlBar(p.barV, X / 2);
  return { contours: [rect(0, 0, S, A), ...dBowl(0, cx, X / 2, reach, X / 2, S, bar, p.n)], width: cx + reach, top: A };
};

const u: Builder = (p) => {
  const S = p.stem;
  const half = SHAPE.u.half + S;
  const cy = X / 2;
  const bar = bowlBar(p.barV, cy);
  const w = 2 * half;
  return { contours: [rect(0, cy - JOIN, S, X), rect(w - S, 0, w, X), band(half, cy, half, cy, S, bar, 180, 360, p.n)], width: w, top: X };
};

const i: Builder = (p) => {
  const S = p.stem;
  const bottom = Math.max(X + MIN_COUNTER, Math.min(X + SHAPE.iDotGap, A - p.dot));
  return { contours: [rect(0, 0, S, X), rect(0, bottom, S, bottom + p.dot)], width: S, top: bottom + p.dot };
};

const l: Builder = (p) => ({ contours: [rect(0, 0, p.stem, A)], width: p.stem, top: A });

const d: Builder = (p) => {
  const g = b(p);
  return { ...g, contours: mirrorX(g.contours, g.width) };
};

const s: Builder = (p) => {
  const S = p.stem;
  const bar = Math.min(p.barV * SHAPE.s.bar, (X / 2 - MIN_COUNTER) / 1.5);
  const reach = SHAPE.s.reach + S;
  const ay = X / 4 + bar / 4;
  const upper = reach;
  const lower = reach + SHAPE.s.spine;
  const w = lower + reach;
  return {
    contours: [
      band(upper, X - ay, reach, ay, S, bar, 90, 270, p.n),
      band(lower, ay, reach, ay, S, bar, -90, 90, p.n),
      rect(upper - JOIN, X - bar, w, X),
      rect(0, 0, lower + JOIN, bar),
      rect(upper - JOIN, X / 2 - bar / 2, lower + JOIN, X / 2 + bar / 2),
    ],
    width: w,
    top: X,
  };
};

const t: Builder = (p) => {
  const S = p.stem;
  const { left, right, hook, hookHeight } = SHAPE.t;
  const w = left + S + right;
  const ax = S + hook;
  const cx = left + ax;
  const bar = Math.min(p.barV, hookHeight - MIN_COUNTER / 2);
  return {
    contours: [
      rect(left, hookHeight - JOIN, left + S, T_TOP),
      band(cx, hookHeight, ax, hookHeight, S, bar, 180, 270, p.n),
      rect(cx - JOIN, 0, w, bar),
      rect(0, X - Math.min(p.barV, X - hookHeight), w, X),
    ],
    width: w,
    top: T_TOP,
  };
};

const f: Builder = (p) => {
  const S = p.stem;
  const { left, right, terminal, hook, hookHeight } = SHAPE.f;
  const ax = S + hook;
  const cx = left + ax;
  const cy = A - hookHeight;
  const bar = Math.min(p.barV, hookHeight - MIN_COUNTER / 2);
  const top = left + S + terminal;
  const cross = left + S + right;
  return {
    contours: [
      rect(left, 0, left + S, cy + JOIN),
      band(cx, cy, ax, hookHeight, S, bar, 90, 180, p.n),
      rect(cx - JOIN, A - bar, top, A),
      rect(0, X - Math.min(p.barV, X - MIN_COUNTER), cross, X),
    ],
    width: Math.max(top, cross),
    top: A,
  };
};

const period: Builder = (p) => ({ contours: [rect(0, 0, p.stem, p.dot)], width: p.stem, top: p.dot });

const SPACE_WIDTH = METRICS.spaceWidth;
const space: Builder = () => ({ contours: [], width: SPACE_WIDTH, top: 0 });

const BUILDERS: Readonly<Record<string, Builder>> = { b, u, i, l, d, s, t, f, ".": period, " ": space };

export const CONSTRUCTED_ALPHABET = Object.keys(BUILDERS);

// Each side's share of the letter gap: straight sides take it whole, round
// ones less, and the open arms of t and f least, so the word's color is even.
const SIDES: Readonly<Record<string, readonly [number, number]>> = {
  b: [1, 0.7],
  d: [0.7, 1],
  u: [1, 1],
  i: [1, 1],
  l: [1, 1],
  s: [0.7, 0.7],
  t: [0.45, 0.45],
  f: [0.45, 0.45],
  ".": [1, 1],
  " ": [0, 0],
};

const builderFor = (char: string) => BUILDERS[char.toLowerCase()] ?? space;
export const sidesFor = (char: string) => SIDES[char.toLowerCase()] ?? SIDES[" "];

// A glyph at a pose. The period becomes the shutter when an aperture is
// given: its square is the stem times the scale, its blades meet at `pivot`.
export function buildConstructed(char: string, p: GlyphPose, aperture: ApertureShape | null = null, pivot: Pivot = { x: 0, y: 0 }): BuiltGlyph {
  if (char === "." && aperture) {
    const side = p.stem * aperture.scale;
    const height = p.dot * aperture.scale;
    return { contours: placeBlades(apertureBlades(aperture.blades, aperture.gap, pivot), 0, 0, side, height), width: side, top: height };
  }
  return builderFor(char)(p);
}

// A glyph's width and top without building it (the layout runs every frame
// a letter swells); the tests hold these to the built contours.
export function glyphWidth(char: string, p: GlyphPose, aperture: ApertureShape | null): number {
  const S = p.stem;
  switch (char.toLowerCase()) {
    case "b":
    case "d":
      return 2 * S + SHAPE.bowl.flat + SHAPE.bowl.reach;
    case "u":
      return 2 * (S + SHAPE.u.half);
    case "s":
      return 2 * (S + SHAPE.s.reach) + SHAPE.s.spine;
    case "t":
      return SHAPE.t.left + S + SHAPE.t.right;
    case "f":
      return SHAPE.f.left + S + Math.max(SHAPE.f.terminal, SHAPE.f.right);
    case ".":
      return aperture ? S * aperture.scale : S;
    case "i":
    case "l":
      return S;
    default:
      return SPACE_WIDTH;
  }
}

export type ConstructedPlacement = {
  readonly boxX: number; // px, the box's left edge from the word's start
  readonly inkX: number; // px, where the glyph's x = 0 lands
  readonly width: number; // px, the glyph's ink width
  readonly centerX: number; // px
  readonly centerY: number; // px above the baseline
};

// Lays the word out at `size` px per unit from each letter's pose: its box
// is its width plus its share of the gap on each side, then the tracking.
// Pass `withCenters` false for a reflow, which needs only the boxes.
export function constructedLayout(
  text: string,
  size: number,
  poses: readonly GlyphPose[],
  tracking: number,
  gap: number,
  aperture: ApertureShape | null,
  withCenters = true,
): { placements: ConstructedPlacement[]; width: number } {
  const chars = [...text];
  let x = 0;
  const placements = chars.map((char, idx) => {
    const p = poses[idx] ?? poses[poses.length - 1];
    const w = glyphWidth(char, p, aperture) * size;
    const [left, right] = sidesFor(char);
    const lead = (gap / 2) * left * size;
    const top = withCenters ? buildConstructed(char, p, aperture).top : 0;
    const placement = { boxX: x, inkX: x + lead, width: w, centerX: x + lead + w / 2, centerY: (top * size) / 2 };
    x += lead + w + (gap / 2) * right * size + tracking * size;
    return placement;
  });
  return { placements, width: chars.length ? x - tracking * size : 0 };
}

// The word's ink around its baseline, in units, at a pose (the swell's
// largest for the reach): the face never draws under the baseline.
export function constructedInk(text: string, p: GlyphPose, aperture: ApertureShape | null) {
  const tops = [...text].map((c) => {
    const g = buildConstructed(c, p, aperture);
    return g.contours.length ? bounds(g.contours).y1 : 0;
  });
  return { top: Math.max(0, ...tops), bottom: 0 };
}
