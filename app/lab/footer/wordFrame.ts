import type { Pivot } from "./aperture";
import { maxHop, type EggPose } from "./egg";
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

// The egg's part of the period's transform, in the letter's own space: its
// lift in px, its turn about its center (cy px under the baseline, negative
// above it) and its squash about its bottom (bottomY).
export type EggTransform = { liftPx: number; angle: number; sx: number; sy: number; cy: number; bottomY: number };

// A letter's transform: placed at x (its ink's left), y (its baseline),
// leaning and growing about pivotX, pressed about the baseline. With no egg
// it is the string every round has written, so a period back at rest is
// exactly where it started.
export function letterTransform(x: number, y: number, pivotX: number, f: Pick<LetterFrame, "lean" | "grow" | "squash">, egg?: EggTransform): string {
  const head = `translate(${(x + pivotX).toFixed(2)} ${(y - (egg ? egg.liftPx : 0)).toFixed(2)})`;
  const tail = `rotate(${f.lean.toFixed(3)}) scale(${f.grow.toFixed(4)} ${(f.grow * f.squash).toFixed(4)}) translate(${(-pivotX).toFixed(2)} 0)`;
  if (!egg) return `${head} ${tail}`;
  const b = egg.bottomY.toFixed(2);
  const turn = `rotate(${egg.angle.toFixed(3)} 0 ${egg.cy.toFixed(2)})`;
  return `${head} translate(0 ${b}) scale(${egg.sx.toFixed(4)} ${egg.sy.toFixed(4)}) translate(0 ${(-egg.bottomY).toFixed(2)}) ${turn} ${tail}`;
}

// The egg's period in the letter's own space: its center (cy, px under the
// baseline) and its bottom, and its side.
export function periodBox(centerY: number, baselineY: number, halfWidth: number) {
  const cy = centerY - baselineY;
  return { cy, bottomY: cy + halfWidth, side: 2 * halfWidth };
}

// The pose as the period's transform: the lift held under the word's top
// (a hole above the paper cover would show no field), and a turned square
// lifted so its lowest corner stays on the ground.
export function eggTransform(pose: EggPose, box: ReturnType<typeof periodBox>, size: number, s: FooterSettings, inkTop: number, square: boolean): EggTransform {
  const hopCap = maxHop(inkTop, box.side / size + s.swellAmount);
  const lift = pose.lift * Math.min(1, hopCap / Math.max(1e-6, s.egg.hop)) * size;
  const a = (pose.angle * Math.PI) / 180;
  const corner = square ? (box.side / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) - 1) : 0;
  return { liftPx: lift + corner, angle: pose.angle, sx: pose.sx, sy: pose.sy, cy: box.cy, bottomY: box.bottomY };
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
