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
