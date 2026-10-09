import { METRICS, glyphFor } from "./glyphs";

// Lays a word out from the alphabet. Units: `size` is the ascender height in
// px; weights and tracking are in ascender units. Each glyph's box is its
// skeleton plus half the weight and a side bearing on each side, then the
// tracking; the skeleton sits half a weight in, so its stroked ink never
// leaves the box.

export type Placement = {
  readonly char: string;
  readonly boxX: number; // px, the box's left edge from the word's start
  readonly inkX: number; // px, where the skeleton's x = 0 lands
  readonly advance: number; // px, including the tracking
  readonly centerX: number; // px, the glyph's ink center
  readonly centerY: number; // px above the baseline, the glyph's vertical middle
};

export type WordLayout = { readonly placements: readonly Placement[]; readonly width: number };

export function boxWidth(char: string, weight: number): number {
  return glyphFor(char).width + weight + 2 * METRICS.sideBearing;
}

export function layoutWord(text: string, size: number, weights: readonly number[], tracking: number): WordLayout {
  const chars = [...text];
  let x = 0;
  const placements = chars.map((char, i) => {
    const g = glyphFor(char);
    const w = weights[i] ?? weights[weights.length - 1] ?? 0;
    const box = boxWidth(char, w) * size;
    const advance = box + tracking * size;
    const inkX = x + (w / 2 + METRICS.sideBearing) * size;
    const placement: Placement = {
      char,
      boxX: x,
      inkX,
      advance,
      centerX: inkX + (g.width * size) / 2,
      centerY: ((g.yMin + g.yMax) / 2) * size,
    };
    x += advance;
    return placement;
  });
  const width = chars.length ? x - tracking * size : 0;
  return { placements, width };
}

// The ascender height that makes the word span `share` of `stageWidth` at a
// uniform weight (the panel's readout and the "fit" helper).
export function sizeForWidth(text: string, weight: number, tracking: number, stageWidth: number, share: number): number {
  const unit = layoutWord(text, 1, [weight], tracking).width;
  return unit > 0 ? (stageWidth * share) / unit : 0;
}

// The word's ink around its baseline, in ascender units at the tallest swell
// (or lean or grow): how far it reaches above and below. Every length the
// stage lays out from (the band, the field's stop, the rise's floor) comes
// from these, so no face and no swell is ever cut by its own band.
export type InkExtent = { readonly top: number; readonly bottom: number };

export function proceduralInk(text: string, weight: number, swell: number): InkExtent {
  const glyphs = [...text].map(glyphFor).filter((g) => g.strokes.length || g.dots.length);
  const half = (weight + swell) / 2;
  if (!glyphs.length) return { top: METRICS.ascender + half, bottom: half };
  return {
    top: Math.max(...glyphs.map((g) => g.yMax)) + half,
    bottom: Math.max(0, -Math.min(...glyphs.map((g) => g.yMin))) + half,
  };
}

// For a typeset face, from its measured ink (per px of font size) in units of
// its ascent. A lean turns each letter about its baseline middle, so a corner
// half an advance out dips by sin(lean); a grow scales about the baseline.
export function typesetInk(
  m: { ascent: number; inkTops: readonly number[]; inkBottoms: readonly number[]; advances: readonly number[]; heavyAdvances: readonly number[] },
  motion: { leanDeg: number; grow: number },
): InkExtent {
  const unit = (n: number) => n / m.ascent;
  const scale = 1 + Math.max(0, motion.grow);
  const halfAdvance = unit(Math.max(0, ...m.advances, ...m.heavyAdvances)) / 2;
  const tilt = halfAdvance * Math.sin((Math.abs(motion.leanDeg) * Math.PI) / 180);
  return {
    top: unit(Math.max(0, ...m.inkTops)) * scale + tilt,
    bottom: unit(Math.max(0, ...m.inkBottoms)) * scale + tilt,
  };
}

// The wordmark's band in the footer, in px: a gap (in ascender units) over
// the ink's top, the ink, and under it the floor. A floor of 0 rests the
// word a clearance above the footer's bottom edge, whole at its tallest
// swell; the floor's top end crops exactly that share of the ink's height
// under the edge, and the way between is linear (no jump at the first step).
// The baseline never moves with the swell.
export const BAND = { bottomClear: 0.05, floorMax: 0.3 } as const;

function floorDrop(ink: InkExtent, floor: number) {
  const height = ink.top + ink.bottom;
  return Math.max(0, floor) * (height + BAND.bottomClear / BAND.floorMax);
}

export function wordBand(size: number, ink: InkExtent, floor: number, gap: number) {
  const below = (ink.bottom + BAND.bottomClear - floorDrop(ink, floor)) * size;
  const above = (gap + ink.top) * size;
  return { height: Math.max(0, above + below), baselineFromBottom: below };
}

// The share of the ink's height the floor puts under the bottom edge.
export function croppedShare(ink: InkExtent, floor: number): number {
  const height = ink.top + ink.bottom;
  return height > 0 ? Math.max(0, floorDrop(ink, floor) - BAND.bottomClear) / height : 0;
}

// A typeset row: each letter's left edge in px, from the measured starts
// (kerning included) at the base weight, each advance moving toward its
// heaviest by the letter's swell share (0 to 1), plus the tracking.
export function typesetRow(
  m: { starts: readonly number[]; advances: readonly number[]; heavyAdvances: readonly number[] },
  fontSize: number,
  trackPx: number,
  swell: readonly number[] = [],
): { xs: number[]; width: number } {
  const n = m.starts.length;
  const xs: number[] = [];
  let x = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    xs.push(x);
    const t = Math.min(1, Math.max(0, swell[i] ?? 0));
    const advance = (m.advances[i] + (m.heavyAdvances[i] - m.advances[i]) * t) * fontSize;
    last = x + advance;
    const kern = i < n - 1 ? (m.starts[i + 1] - m.starts[i] - m.advances[i]) * fontSize : 0;
    x += advance + kern + trackPx;
  }
  return { xs, width: n ? last : 0 };
}

// The field's alpha down the footer: it rises from paper over the top share,
// holds, and fades out over the last fade, ending where the choice says. On a
// short footer the rise and the fade can overlap; then they meet at a point
// split in proportion to their lengths, so no stop ever sits out of order
// (CSS would snap that into a hard edge).
export function fieldStops(fadeInPx: number, fadePx: number, stop: number) {
  const rise = Math.max(0, fadeInPx);
  const fall = Math.max(0, fadePx);
  if (rise + fall <= stop) return { inEnd: rise, start: stop - fall };
  const meet = rise + fall > 0 ? (stop * rise) / (rise + fall) : 0;
  return { inEnd: meet, start: meet };
}
