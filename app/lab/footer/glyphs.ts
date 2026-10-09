// The wordmark's procedural alphabet: a to z, ".", "-" and space, written for
// this lab as monoline skeletons (lines, polylines, arcs and dots) in units of
// the ascender height, y up, baseline at 0. A glyph is drawn by stroking its
// skeleton, so the weight is a number: it sets the stroke width and nothing
// else. The skeleton never moves with the weight; the layout pads each glyph
// by half the weight on every side, so the stroked ink stays in its box.

export const METRICS = {
  ascender: 1,
  xHeight: 0.6,
  descender: -0.32,
  sideBearing: 0.04, // each side, in ascender units, before tracking
  spaceWidth: 0.3,
} as const;

export type Line = { kind: "line"; x1: number; y1: number; x2: number; y2: number };
export type Poly = { kind: "poly"; pts: readonly (readonly [number, number])[] };
// Angles in degrees, counterclockwise with y up, swept from a0 to a1 (a1 > a0).
export type Arc = { kind: "arc"; cx: number; cy: number; r: number; a0: number; a1: number };
export type Stroke = Line | Poly | Arc;

export type Glyph = {
  readonly strokes: readonly Stroke[];
  readonly dots: readonly (readonly [number, number])[];
  readonly width: number; // the skeleton's width; its left edge is x = 0
  readonly yMin: number;
  readonly yMax: number;
};

const line = (x1: number, y1: number, x2: number, y2: number): Line => ({ kind: "line", x1, y1, x2, y2 });
const poly = (...pts: [number, number][]): Poly => ({ kind: "poly", pts });
const arc = (cx: number, cy: number, r: number, a0: number, a1: number): Arc => ({ kind: "arc", cx, cy, r, a0, a1 });
const ring = (cx: number, cy: number, r: number) => arc(cx, cy, r, 0, 360);
const bowl = () => ring(0.3, 0.3, 0.3);

type Raw = { strokes: Stroke[]; dots?: [number, number][]; width?: number };

const RAW: Record<string, Raw> = {
  a: { strokes: [bowl(), line(0.6, 0, 0.6, 0.6)] },
  b: { strokes: [line(0, 0, 0, 1), bowl()] },
  c: { strokes: [arc(0.3, 0.3, 0.3, 45, 315)] },
  d: { strokes: [bowl(), line(0.6, 0, 0.6, 1)] },
  e: { strokes: [line(0, 0.3, 0.6, 0.3), arc(0.3, 0.3, 0.3, 0, 315)] },
  f: { strokes: [line(0.15, 0, 0.15, 0.8), arc(0.35, 0.8, 0.2, 30, 180), line(0, 0.6, 0.4, 0.6)] },
  g: { strokes: [bowl(), line(0.6, 0.6, 0.6, -0.1), arc(0.38, -0.1, 0.22, 200, 360)] },
  h: { strokes: [line(0, 0, 0, 1), arc(0.3, 0.3, 0.3, 0, 180), line(0.6, 0.3, 0.6, 0)] },
  i: { strokes: [line(0, 0, 0, 0.6)], dots: [[0, 0.88]] },
  j: { strokes: [line(0.42, 0.6, 0.42, -0.1), arc(0.2, -0.1, 0.22, 215, 360)], dots: [[0.42, 0.88]] },
  k: { strokes: [line(0, 0, 0, 1), line(0.5, 0.6, 0, 0.25), line(0.15, 0.355, 0.52, 0)] },
  l: { strokes: [line(0, 0, 0, 1)] },
  m: {
    strokes: [
      line(0, 0, 0, 0.6),
      arc(0.21, 0.39, 0.21, 0, 180),
      line(0.42, 0.39, 0.42, 0),
      arc(0.63, 0.39, 0.21, 0, 180),
      line(0.84, 0.39, 0.84, 0),
    ],
  },
  n: { strokes: [line(0, 0, 0, 0.6), arc(0.28, 0.32, 0.28, 0, 180), line(0.56, 0.32, 0.56, 0)] },
  o: { strokes: [bowl()] },
  p: { strokes: [line(0, 0.6, 0, -0.32), bowl()] },
  q: { strokes: [bowl(), line(0.6, 0.6, 0.6, -0.32)] },
  r: { strokes: [line(0, 0, 0, 0.6), arc(0.3, 0.3, 0.3, 60, 180)] },
  s: { strokes: [arc(0.26, 0.45, 0.15, 20, 270), arc(0.26, 0.15, 0.15, 200, 450)] },
  t: { strokes: [line(0.15, 0.85, 0.15, 0.2), arc(0.35, 0.2, 0.2, 180, 270), line(0, 0.6, 0.4, 0.6)] },
  u: { strokes: [line(0, 0.6, 0, 0.3), arc(0.3, 0.3, 0.3, 180, 360), line(0.6, 0.6, 0.6, 0)] },
  v: { strokes: [poly([0, 0.6], [0.28, 0], [0.56, 0.6])] },
  w: { strokes: [poly([0, 0.6], [0.2, 0], [0.4, 0.6], [0.6, 0], [0.8, 0.6])] },
  x: { strokes: [line(0, 0.6, 0.5, 0), line(0.5, 0.6, 0, 0)] },
  y: { strokes: [line(0, 0.6, 0.28, 0), line(0.56, 0.6, 0.131, -0.32)] },
  z: { strokes: [poly([0, 0.6], [0.5, 0.6], [0, 0], [0.5, 0])] },
  ".": { strokes: [], dots: [[0, 0]] },
  "-": { strokes: [line(0, 0.3, 0.3, 0.3)] },
  " ": { strokes: [], width: METRICS.spaceWidth },
};

const rad = (deg: number) => (deg * Math.PI) / 180;

// Points along a stroke: the ends, every sample, and an arc's extremes, so a
// bounding box from these is exact.
export function sampleStroke(stroke: Stroke, steps = 24): [number, number][] {
  if (stroke.kind === "line") return [[stroke.x1, stroke.y1], [stroke.x2, stroke.y2]];
  if (stroke.kind === "poly") return stroke.pts.map(([x, y]) => [x, y]);
  const { cx, cy, r, a0, a1 } = stroke;
  const angles: number[] = [];
  for (let i = 0; i <= steps; i++) angles.push(a0 + ((a1 - a0) * i) / steps);
  for (let k = Math.ceil(a0 / 90) * 90; k <= a1; k += 90) angles.push(k);
  return angles.map((a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))]);
}

function shift(stroke: Stroke, dx: number): Stroke {
  if (stroke.kind === "line") return { ...stroke, x1: stroke.x1 + dx, x2: stroke.x2 + dx };
  if (stroke.kind === "poly") return { ...stroke, pts: stroke.pts.map(([x, y]) => [x + dx, y] as const) };
  return { ...stroke, cx: stroke.cx + dx };
}

function normalize(raw: Raw): Glyph {
  const dots = raw.dots ?? [];
  const points = [...raw.strokes.flatMap((s) => sampleStroke(s)), ...dots];
  if (points.length === 0) return { strokes: [], dots: [], width: raw.width ?? 0, yMin: 0, yMax: 0 };
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  return {
    strokes: raw.strokes.map((s) => shift(s, -minX)),
    dots: dots.map(([x, y]) => [x - minX, y] as const),
    width: raw.width ?? Math.max(...xs) - minX,
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
  };
}

export const GLYPHS: Readonly<Record<string, Glyph>> = Object.fromEntries(
  Object.entries(RAW).map(([char, raw]) => [char, normalize(raw)]),
);

export const ALPHABET = Object.keys(GLYPHS);

export function glyphFor(char: string): Glyph {
  return GLYPHS[char.toLowerCase()] ?? GLYPHS[" "];
}

const n = (x: number) => +x.toFixed(3);

// How square a bowl is drawn: 0 a circle, 1 a superellipse of exponent 6
// (|x|^6 + |y|^6 = 1), whose flat sides meet the stems at a sharper corner.
// Its extremes stay where the circle's are, so the metrics hold.
export const SQUARE_EXPONENT = { round: 2, square: 6 } as const;

export function bowlPoint(cx: number, cy: number, r: number, deg: number, corners: number): [number, number] {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  if (corners <= 0) return [cx + r * c, cy + r * s];
  const n = SQUARE_EXPONENT.round + (SQUARE_EXPONENT.square - SQUARE_EXPONENT.round) * Math.min(1, corners);
  const shape = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);
  return [cx + r * shape(c), cy + r * shape(s)];
}

// The skeleton as SVG path data at `size` px per ascender unit, y down, the
// skeleton's left edge at x = 0 and the baseline at y = 0. Round arcs are
// split into pieces of at most 120 degrees so no large-arc flag is ever
// ambiguous; squared ones are polylines, 4 degrees a segment. Dots are
// zero-length subpaths, drawn by the stroke's caps.
export function glyphPaths(char: string, size: number, corners = 0): { d: string; dots: string } {
  const g = glyphFor(char);
  const P = (x: number, y: number) => `${n(x * size)} ${n(-y * size)}`;
  const parts = g.strokes.map((s) => {
    if (s.kind === "line") return `M${P(s.x1, s.y1)}L${P(s.x2, s.y2)}`;
    if (s.kind === "poly") return s.pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${P(x, y)}`).join("");
    const at = (a: number) => P(...bowlPoint(s.cx, s.cy, s.r, a, corners));
    if (corners > 0) {
      const steps = Math.max(2, Math.ceil((s.a1 - s.a0) / 4));
      let d = `M${at(s.a0)}`;
      for (let i = 1; i <= steps; i++) d += `L${at(s.a0 + ((s.a1 - s.a0) * i) / steps)}`;
      return d;
    }
    const pieces = Math.max(1, Math.ceil((s.a1 - s.a0) / 120));
    let d = `M${at(s.a0)}`;
    for (let i = 1; i <= pieces; i++) {
      const a = s.a0 + ((s.a1 - s.a0) * i) / pieces;
      // Counterclockwise with y up is counterclockwise on screen too: sweep 0.
      d += `A${n(s.r * size)} ${n(s.r * size)} 0 0 0 ${at(a)}`;
    }
    return d;
  });
  return { d: parts.join(""), dots: g.dots.map(([x, y]) => `M${P(x, y)}L${P(x, y)}`).join("") };
}

// What the renderer draws for a glyph at a weight: the same paths at every
// weight, and a stroke width of weight times size.
export function renderGlyph(char: string, size: number, weight: number) {
  return { ...glyphPaths(char, size), strokeWidth: weight * size };
}
