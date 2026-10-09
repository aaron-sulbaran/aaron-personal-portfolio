import type { Pivot } from "./aperture";
import { glyphOutline, pathRow } from "./pathFace";
import type { FooterSettings } from "./settings";
import type { PathKind, TypesetFace } from "./useTypeface";
import type { LetterFrame, Point } from "./useWordMotion";
import { typesetRow } from "./wordLayout";

// The wordmark's letters at rest (for the swell's distances and the slice's
// hit test) and the two writers its loop calls each frame for a path face:
// a dynamic glyph's outline, and the waist slice's halves. Each writer
// caches what it last wrote, so a letter at rest costs no DOM write.

export type WordRest = { centers: Point[]; xs: number[]; pivots: number[]; halfWidths: number[] };

export function wordRest(
  face: TypesetFace | null,
  kind: PathKind | null,
  text: string,
  size: number,
  fontSize: number,
  s: FooterSettings,
  stageW: number,
  baselineY: number,
): WordRest {
  if (face) {
    const m = face.metrics;
    const row = typesetRow(m, fontSize, s.tracking * size);
    const offset = (stageW - row.width) / 2;
    const xs = row.xs.map((x) => offset + x);
    const centers = xs.map((x, i) => ({ x: x + (m.advances[i] * fontSize) / 2, y: baselineY - m.mids[i] * fontSize }));
    const halves = m.advances.map((a) => (a * fontSize) / 2);
    return { centers, xs, pivots: halves, halfWidths: halves };
  }
  const row = pathRow(kind ?? "procedural", text, size, s);
  const offset = (stageW - row.width) / 2;
  const centers = row.centers.map((c) => ({ x: offset + c.x, y: baselineY - c.y }));
  return { centers, xs: row.xs.map((x) => offset + x), pivots: row.halfWidths, halfWidths: row.halfWidths };
}

// Redraws a dynamic glyph when its swell, press or (the shutter's) pivot moved.
export function writeOutline(el: SVGPathElement, cache: string[], i: number, kind: PathKind, char: string, size: number, s: FooterSettings, f: LetterFrame, pivot: Pivot) {
  const shutter = char === "." && s.aperture.on;
  const key = `${(kind === "constructed" ? f.swell : f.weight).toFixed(4)} ${f.squash.toFixed(4)}${shutter ? ` ${pivot.x.toFixed(3)} ${pivot.y.toFixed(3)}` : ""}`;
  if (cache[i] === key) return;
  cache[i] = key;
  el.setAttribute("d", glyphOutline(kind, char, size, s, f, pivot));
}

// Under this far apart, a sliced letter is drawn whole, so no seam shows.
const SLICE_EPS_PX = 0.05;

// Parts the slice's halves `apart` px (the upper one way, the lower the
// other), each clipped at the waist; at rest the upper is whole and unclipped
// and the lower hidden.
export function writeSlice(upper: SVGGElement, lower: SVGGElement, cache: (number | undefined)[], i: number, apart: number, clips: { upper: string; lower: string }) {
  const px = Math.abs(apart) < SLICE_EPS_PX ? 0 : Math.round(apart * 100) / 100;
  if (cache[i] === px) return;
  cache[i] = px;
  if (px === 0) {
    upper.removeAttribute("clip-path");
    upper.removeAttribute("transform");
    lower.setAttribute("display", "none");
    return;
  }
  upper.setAttribute("clip-path", `url(#${clips.upper})`);
  lower.setAttribute("clip-path", `url(#${clips.lower})`);
  upper.setAttribute("transform", `translate(${px / 2} 0)`);
  lower.setAttribute("transform", `translate(${-px / 2} 0)`);
  lower.removeAttribute("display");
}
