// The wordmark face's primitives, pure: filled contours in ascender units, y
// up, baseline at 0. Axis-aligned rectangles for stems and bars, elliptical
// bands for curves (the ring between an outer superellipse and an inner one,
// between two angles), and a D bowl (flat on one side, half a superellipse on
// the other, its counter cut out). Every contour winds counterclockwise and
// every cut-out clockwise, so one path filled nonzero unions the overlapping
// joins into one shape and still opens the counters (even-odd would cancel an
// overlap back into a hole).

export type Pt = readonly [number, number];
export type Contour = readonly Pt[];

export const rect = (x0: number, y0: number, x1: number, y1: number): Contour => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const rad = (deg: number) => (deg * Math.PI) / 180;

// Roundness 0 is the true ellipse (exponent 2); 1 squares it to exponent 7.
export const SUPER = { round: 2, square: 7 } as const;

export function superExponent(roundness: number): number {
  return SUPER.round + (SUPER.square - SUPER.round) * Math.min(1, Math.max(0, roundness));
}

// A point on the superellipse |x/ax|^n + |y/ay|^n = 1 at parameter angle
// `deg`; at the axes it sits where the ellipse's would.
export function superPoint(cx: number, cy: number, ax: number, ay: number, deg: number, n: number): Pt {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const shape = (v: number) => (Math.abs(v) < 1e-12 ? 0 : Math.sign(v) * Math.pow(Math.abs(v), 2 / n));
  return [cx + ax * shape(c), cy + ay * shape(s)];
}

const STEPS_PER_QUARTER = 24;

// The arc from a0 to a1 (either direction), both ends included.
export function arcPoints(cx: number, cy: number, ax: number, ay: number, a0: number, a1: number, n: number): Pt[] {
  const steps = Math.max(2, Math.ceil((Math.abs(a1 - a0) / 90) * STEPS_PER_QUARTER));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) pts.push(superPoint(cx, cy, ax, ay, a0 + ((a1 - a0) * i) / steps, n));
  return pts;
}

// The band between the outer curve (semi-axes ax, ay) and the inner one
// (ax - sx, ay - sy), from a0 up to a1 counterclockwise: sx thick at the
// sides, sy thick at the top and bottom. Ends at multiples of 90 degrees are
// cut flat along an axis, so a rectangle meets them edge to edge.
export function band(cx: number, cy: number, ax: number, ay: number, sx: number, sy: number, a0: number, a1: number, n: number): Contour {
  const ix = Math.max(1e-4, ax - sx);
  const iy = Math.max(1e-4, ay - sy);
  return [...arcPoints(cx, cy, ax, ay, a0, a1, n), ...arcPoints(cx, cy, ix, iy, a1, a0, n)];
}

// A D bowl with its flat side on the left at x = flatX (inside the stem it
// hangs from), straight bars to cx, and the right half of a superellipse
// centered at (cx, cy). The counter is the same D inset by sx at the sides
// and sy at the top and bottom, wound the other way.
export function dBowl(flatX: number, cx: number, cy: number, ax: number, ay: number, sx: number, sy: number, n: number): Contour[] {
  const outer: Contour = [[flatX, cy - ay], ...arcPoints(cx, cy, ax, ay, -90, 90, n), [flatX, cy + ay]];
  const ix = Math.max(1e-4, ax - sx);
  const iy = Math.max(1e-4, ay - sy);
  const inner: Contour = [[flatX + sx, cy + iy], ...arcPoints(cx, cy, ix, iy, 90, -90, n), [flatX + sx, cy - iy]];
  return [outer, inner];
}

// Mirrors contours across the vertical line at width / 2, reversing each so
// its winding (and so its role, filled or cut out) is kept.
export function mirrorX(contours: readonly Contour[], width: number): Contour[] {
  return contours.map((c) => c.map(([x, y]) => [width - x, y] as Pt).reverse());
}

export function signedArea(c: Contour): number {
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const [x0, y0] = c[i];
    const [x1, y1] = c[(i + 1) % c.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

export function bounds(contours: readonly Contour[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of contours) {
    for (const [x, y] of c) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

// SVG path data at `size` px per unit, y down, each contour closed.
export function contoursPath(contours: readonly Contour[], size: number): string {
  let d = "";
  for (const c of contours) {
    if (c.length < 3) continue;
    c.forEach(([x, y], i) => {
      d += `${i === 0 ? "M" : "L"}${r2(x * size)} ${r2(-y * size)}`;
    });
    d += "Z";
  }
  return d;
}
