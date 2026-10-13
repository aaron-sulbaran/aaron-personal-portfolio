// The road rail's geometry, in the track's own pixels: the rail's line as a
// narrow lane that runs straight down through every year and bends gently
// aside, once, between two years (alternating sides). Each stretch is a cubic
// with vertical tangents at both ends, so the lane only ever heads down the
// page and the car never turns more than a few degrees. Pure.

export interface Point { x: number; y: number }

// How far the lane leans between two years, in px.
export const LANE_BEND = 9;

// The lane through anchors at x: from the top, through each anchor, with one
// bend halfway between consecutive anchors; the last anchor ends it.
export function lanePoints(anchorYs: readonly number[], x: number, bend = LANE_BEND): Point[] {
  const points: Point[] = [{ x, y: 0 }];
  anchorYs.forEach((raw, i) => {
    const prev = points[points.length - 1];
    const y = Math.max(raw, prev.y);
    if (i > 0) points.push({ x: x + (i % 2 ? bend : -bend), y: (prev.y + y) / 2 });
    points.push({ x, y });
  });
  return points;
}

const round = (n: number) => Number(n.toFixed(2));

function controls(a: Point, b: Point): [Point, Point] {
  const half = (b.y - a.y) / 2;
  return [{ x: a.x, y: a.y + half }, { x: b.x, y: b.y - half }];
}

export function lanePath(points: readonly Point[]): string {
  if (!points.length) return "";
  let d = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    const [c1, c2] = controls(points[i - 1], points[i]);
    d += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(points[i].x)} ${round(points[i].y)}`;
  }
  return d;
}

function cubic(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: w[0] * a.x + w[1] * c1.x + w[2] * c2.x + w[3] * b.x, y: w[0] * a.y + w[1] * c1.y + w[2] * c2.y + w[3] * b.y };
}

// The lane sampled along its length: ys rise (each stretch heads down), lengths are cumulative px.
export interface LaneSamples { ys: number[]; lengths: number[]; total: number }

export function laneSamples(points: readonly Point[], perStretch = 24): LaneSamples {
  const ys = [points[0]?.y ?? 0];
  const lengths = [0];
  let prev = points[0] ?? { x: 0, y: 0 };
  for (let i = 1; i < points.length; i += 1) {
    const [c1, c2] = controls(points[i - 1], points[i]);
    for (let s = 1; s <= perStretch; s += 1) {
      const p = cubic(points[i - 1], c1, c2, points[i], s / perStretch);
      lengths.push(lengths[lengths.length - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
      ys.push(p.y);
      prev = p;
    }
  }
  return { ys, lengths, total: lengths[lengths.length - 1] };
}

// The share of the lane's length driven when the car is level with y (px from the top).
export function lengthAtY({ ys, lengths, total }: LaneSamples, y: number): number {
  if (total <= 0 || y <= ys[0]) return 0;
  if (y >= ys[ys.length - 1]) return 1;
  let lo = 0;
  let hi = ys.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ys[mid] <= y) lo = mid;
    else hi = mid;
  }
  const span = ys[hi] - ys[lo];
  const t = span > 0 ? (y - ys[lo]) / span : 0;
  return (lengths[lo] + t * (lengths[hi] - lengths[lo])) / total;
}

// The steepest the lane ever leans off straight down, in degrees.
export function maxLean(points: readonly Point[]): number {
  let lean = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [c1, c2] = controls(points[i - 1], points[i]);
    const mid = cubic(points[i - 1], c1, c2, points[i], 0.5);
    const after = cubic(points[i - 1], c1, c2, points[i], 0.51);
    lean = Math.max(lean, (Math.atan2(Math.abs(after.x - mid.x), after.y - mid.y) * 180) / Math.PI);
  }
  return lean;
}
