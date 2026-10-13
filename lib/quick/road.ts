// The road variant's geometry, in the road column's own pixels. The road starts
// centred at the top, swings to alternate sides through each checkpoint and ends
// at the last one (the closing sign). Each stretch is one cubic with vertical
// tangents at both ends, so the road only ever heads down the page. Pure.

export interface Point { x: number; y: number }

// Where the road swings to, as shares of the column's width.
export const ROAD_SWING = { left: 0.3, right: 0.7 } as const;

export function roadPoints(anchorYs: readonly number[], width: number): Point[] {
  const sides = [ROAD_SWING.left, ROAD_SWING.right];
  const points: Point[] = [{ x: width / 2, y: 0 }];
  anchorYs.forEach((y, i) => {
    const last = i === anchorYs.length - 1;
    points.push({ x: width * (last ? 0.5 : sides[i % 2]), y: Math.max(y, points[points.length - 1].y) });
  });
  return points;
}

const round = (n: number) => Number(n.toFixed(2));

function controls(a: Point, b: Point): [Point, Point] {
  const half = (b.y - a.y) / 2;
  return [{ x: a.x, y: a.y + half }, { x: b.x, y: b.y - half }];
}

export function roadPath(points: readonly Point[]): string {
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

// The road sampled along its length: ys rise (each stretch heads down), lengths are cumulative px.
export interface RoadSamples { ys: number[]; lengths: number[]; total: number }

export function roadSamples(points: readonly Point[], perStretch = 32): RoadSamples {
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

// The share of the road's length driven when the car is level with y (px from the top).
export function lengthAtY({ ys, lengths, total }: RoadSamples, y: number): number {
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
