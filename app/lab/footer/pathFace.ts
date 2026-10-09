import { APERTURE_REACH, apertureBlades, placeBlades, type Pivot } from "./aperture";
import { buildConstructed, constructedInk, constructedLayout, glyphPose, type ApertureShape } from "./constructed";
import { METRICS, glyphFor } from "./glyphs";
import { contoursPath } from "./primitives";
import type { FooterSettings } from "./settings";
import type { PathKind } from "./useTypeface";
import { layoutWord, proceduralInk, type InkExtent } from "./wordLayout";

// The two faces that draw letters as SVG paths, behind one interface: the
// procedural alphabet (stroked skeletons) and the constructed one (filled
// outlines). The stage and the wordmark lay out, measure and redraw both
// through these, so the field, the tint, the floor, the slice and the
// period's shutter treat them the same.

export function pathKindOf(s: FooterSettings): PathKind {
  return s.face === "constructed" ? "constructed" : "procedural";
}

export function apertureOf(s: FooterSettings): ApertureShape | null {
  return s.aperture.on ? { blades: s.aperture.blades, scale: s.aperture.scale, gap: s.aperture.gap } : null;
}

// Where the waist slice cuts: the middle of the x-height, in units.
export const WAIST = METRICS.xHeight / 2;

export type PathRow = {
  xs: number[]; // px from the word's start, where each glyph's x = 0 lands
  width: number; // px, the word's width
  centers: { x: number; y: number }[]; // px, each glyph's ink center (y above the baseline)
  halfWidths: number[]; // px, half of each glyph's ink width
};

// The row at `size` px per unit, each letter at its swell share (0 to 1).
export function pathRow(kind: PathKind, text: string, size: number, s: FooterSettings, swells: readonly number[] = [0]): PathRow {
  if (kind === "constructed") {
    const poses = swells.map((w) => glyphPose(s.constructed, s.swellAmount, w));
    const row = constructedLayout(text, size, poses, s.tracking, s.constructed.gap, apertureOf(s), swells.length <= 1);
    return {
      xs: row.placements.map((p) => p.inkX),
      width: row.width,
      centers: row.placements.map((p) => ({ x: p.centerX, y: p.centerY })),
      halfWidths: row.placements.map((p) => p.width / 2),
    };
  }
  const weights = swells.map((w) => s.weight + s.swellAmount * w);
  const row = layoutWord(text, size, weights, s.tracking);
  return {
    xs: row.placements.map((p) => p.inkX),
    width: row.width,
    centers: row.placements.map((p) => ({ x: p.centerX, y: p.centerY })),
    halfWidths: row.placements.map((p, i) => ((glyphFor(p.char).width + (weights[i] ?? weights[0])) * size) / 2),
  };
}

// The word's ink around its baseline, at the swell's reach or at rest.
export function pathInk(kind: PathKind, text: string, s: FooterSettings, swelling: boolean): InkExtent {
  const swell = swelling ? s.swellAmount : 0;
  if (kind === "constructed") return constructedInk(text, glyphPose(s.constructed, s.swellAmount, swelling ? 1 : 0), apertureOf(s));
  return proceduralInk(text, s.weight, swell);
}

// Which glyphs the loop redraws: every constructed letter (its stems and
// bars swell, its bars hold through the press) and the shutter period of
// either face. The rest of the procedural alphabet is static path data.
export function isDynamicGlyph(kind: PathKind, char: string, s: FooterSettings): boolean {
  return kind === "constructed" || (char === "." && s.aperture.on);
}

export type GlyphFrame = { swell: number; squash: number; weight: number };

// A dynamic glyph's outline at `size` px per unit, in its letter's own space
// (x = 0 at its left ink edge, baseline at 0, y down). Its bars and the
// shutter's square are drawn taller by 1 / squash, so the press's vertical
// scale leaves them their thickness on screen: the letter dents.
export function glyphOutline(kind: PathKind, char: string, size: number, s: FooterSettings, f: GlyphFrame, pivot: Pivot): string {
  if (kind === "constructed") {
    const g = buildConstructed(char, glyphPose(s.constructed, s.swellAmount, f.swell, f.squash), apertureOf(s), pivot);
    return contoursPath(g.contours, size);
  }
  if (char !== "." || !s.aperture.on) return "";
  // The procedural period's shutter fills its round dot's square: one weight
  // across, centered on the baseline.
  const side = f.weight;
  const height = side / Math.max(0.05, f.squash);
  return contoursPath(placeBlades(apertureBlades(s.aperture.blades, s.aperture.gap, pivot), -side / 2, -height / 2, side, height), size);
}

// The shutter's pivot reach in px at rest, for the loop's pointer math.
export function apertureReachPx(kind: PathKind, s: FooterSettings, size: number): number {
  const side = kind === "constructed" ? s.constructed.stem * s.aperture.scale : s.weight;
  return APERTURE_REACH * side * size;
}
