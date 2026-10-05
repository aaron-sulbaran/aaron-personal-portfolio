// The spine as pure geometry: a centripetal Catmull-Rom curve through the
// resolved control points, resampled by arc length, with tangents, normals,
// a smoothed curvature, and the running maximum of y that turns a scroll
// position into an arc length. Built on resize or a settings change, never
// per frame.
//
// Centripetal parameterisation (alpha 0.5) is the one that cannot form a
// cusp or a stray loop inside a segment, so every loop on the page is one an
// author drew on purpose.

export interface Point {
  x: number;
  y: number;
}

export interface SpineSamples {
  count: number;
  step: number; // px of arc between samples
  length: number; // total arc length, px
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array; // unit normal, the tangent turned a quarter clockwise
  ny: Float32Array;
  radius: Float32Array; // smoothed radius of curvature, px (large on a straight)
  yMax: Float32Array; // running max of y: monotonic, so y to arc length is a search
}

const SEGMENT_STEPS = 32;
const SMOOTH_PX = 48; // half window of the curvature's smoothing

function catmull(p0: Point, p1: Point, p2: Point, p3: Point, t: number, out: Point) {
  const d = (a: Point, b: Point) => Math.max(1e-3, Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5));
  const t1 = d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const lerp = (a: Point, b: Point, ta: number, tb: number, k: number) => {
    const w = (k - ta) / (tb - ta);
    return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
  };
  const a1 = lerp(p0, p1, 0, t1, u);
  const a2 = lerp(p1, p2, t1, t2, u);
  const a3 = lerp(p2, p3, t2, t3, u);
  const b1 = lerp(a1, a2, 0, t2, u);
  const b2 = lerp(a2, a3, t1, t3, u);
  const c = lerp(b1, b2, t1, t2, u);
  out.x = c.x;
  out.y = c.y;
}

// A dense polyline through every control point (the ends are mirrored so the
// curve starts and finishes on its first and last points).
function polyline(points: Point[]): Point[] {
  if (points.length < 2) return points.slice();
  const ext = [
    { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
    ...points,
    { x: 2 * points[points.length - 1].x - points[points.length - 2].x, y: 2 * points[points.length - 1].y - points[points.length - 2].y },
  ];
  const out: Point[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    for (let k = 0; k < SEGMENT_STEPS; k++) {
      const p = { x: 0, y: 0 };
      catmull(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], k / SEGMENT_STEPS, p);
      out.push(p);
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

export function sampleSpine(points: Point[], step: number): SpineSamples {
  const line = polyline(points);
  const cumulative = new Float64Array(line.length);
  for (let i = 1; i < line.length; i++) {
    cumulative[i] = cumulative[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
  }
  const length = line.length ? cumulative[line.length - 1] : 0;
  const count = Math.max(2, Math.floor(length / step) + 1);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = Math.min(length, i * step);
    while (j < line.length - 2 && cumulative[j + 1] < s) j++;
    const span = cumulative[j + 1] - cumulative[j] || 1;
    const w = (s - cumulative[j]) / span;
    const a = line[j] ?? { x: 0, y: 0 };
    const b = line[j + 1] ?? a;
    x[i] = a.x + (b.x - a.x) * w;
    y[i] = a.y + (b.y - a.y) * w;
  }

  const nx = new Float32Array(count);
  const ny = new Float32Array(count);
  const kappa = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(count - 1, i + 1);
    const tx = x[b] - x[a];
    const ty = y[b] - y[a];
    const len = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / len;
    ny[i] = tx / len;
  }
  // Curvature from the turn of the normal per px of arc.
  for (let i = 1; i < count - 1; i++) {
    const turn = Math.atan2(nx[i - 1] * ny[i + 1] - ny[i - 1] * nx[i + 1], nx[i - 1] * nx[i + 1] + ny[i - 1] * ny[i + 1]);
    kappa[i] = Math.abs(turn) / (2 * step);
  }
  // A moving maximum, so the taper starts before a bend rather than in it.
  const half = Math.max(1, Math.round(SMOOTH_PX / step));
  const radius = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let k = 0;
    for (let m = Math.max(0, i - half); m <= Math.min(count - 1, i + half); m++) k = Math.max(k, kappa[m]);
    radius[i] = k > 1e-6 ? 1 / k : 1e6;
  }

  const yMax = new Float32Array(count);
  let top = -Infinity;
  for (let i = 0; i < count; i++) {
    top = Math.max(top, y[i]);
    yMax[i] = top;
  }
  return { count, step, length, x, y, nx, ny, radius, yMax };
}

// The arc length where the spine first reaches `targetY` going down the page.
// Monotonic in targetY, so scrolling back retreats the head exactly.
export function arcAtY(samples: SpineSamples, targetY: number): number {
  const { yMax, count, step, length } = samples;
  if (targetY <= yMax[0]) return 0;
  if (targetY >= yMax[count - 1]) return length;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (yMax[mid] < targetY) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(length, lo * step);
}
