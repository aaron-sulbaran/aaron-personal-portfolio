// Dot geometry for /hive-visual. Everything on the page is drawn the way
// Beekeeper's avatar is: evenly spaced dots ("bees") tracing a shape. These are
// pure functions, shared by the server-rendered SVG and the client's canvas.

export type Point = { x: number; y: number };
export type Path = { pts: Point[]; lengths: number[]; length: number };

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function preparePath(pts: Point[]): Path {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, lengths, length: lengths[lengths.length - 1] };
}

/** The point a fraction of the way along a path, by distance. */
export function pointAt(path: Path, fraction: number): Point {
  const d = clamp(fraction, 0, 1) * path.length;
  let i = 1;
  while (i < path.lengths.length - 1 && path.lengths[i] < d) i++;
  const a = path.pts[i - 1];
  const b = path.pts[i];
  const span = path.lengths[i] - path.lengths[i - 1] || 1;
  const u = (d - path.lengths[i - 1]) / span;
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
}

/** Dots along a path, half a step in from each end so they clear the shapes the path joins. */
export function dotsAlong(path: Path, step: number): Point[] {
  const n = Math.max(1, Math.floor((path.length - step) / step));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) out.push(pointAt(path, (step / 2 + (i * (path.length - step)) / n) / path.length));
  return out;
}

/** Evenly spaced dots around a rounded rectangle. */
export function roundedRectDots(x: number, y: number, w: number, h: number, r: number, step: number): Point[] {
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const quarter = (Math.PI * r) / 2;
  const total = 2 * straightW + 2 * straightH + 4 * quarter;
  const n = Math.max(4, Math.round(total / step));
  const corner = (cx: number, cy: number, start: number, d: number) => ({ x: cx + r * Math.cos(start + d / r), y: cy + r * Math.sin(start + d / r) });
  const at = (d: number): Point => {
    if (d < straightW) return { x: x + r + d, y };
    d -= straightW;
    if (d < quarter) return corner(x + w - r, y + r, -Math.PI / 2, d);
    d -= quarter;
    if (d < straightH) return { x: x + w, y: y + r + d };
    d -= straightH;
    if (d < quarter) return corner(x + w - r, y + h - r, 0, d);
    d -= quarter;
    if (d < straightW) return { x: x + w - r - d, y: y + h };
    d -= straightW;
    if (d < quarter) return corner(x + r, y + h - r, Math.PI / 2, d);
    d -= quarter;
    if (d < straightH) return { x, y: y + h - r - d };
    d -= straightH;
    return corner(x + r, y + r, Math.PI, d);
  };
  return Array.from({ length: n }, (_, k) => at((k * total) / n));
}

/** A honeycomb of dots filling a pointy-top hexagon of circumradius R. */
export function hexLattice(cx: number, cy: number, R: number, step: number): Point[] {
  const out: Point[] = [];
  const dy = (step * Math.sqrt(3)) / 2;
  const rows = Math.ceil(R / dy) + 1;
  const cols = Math.ceil(R / step) + 2;
  for (let j = -rows; j <= rows; j++) {
    const offset = (Math.abs(j) % 2) * (step / 2);
    for (let i = -cols; i <= cols; i++) {
      const x = i * step + offset;
      const y = j * dy;
      if (Math.abs(x) <= (R * Math.sqrt(3)) / 2 && Math.abs(x) / Math.sqrt(3) + Math.abs(y) <= R) out.push({ x: cx + x, y: cy + y });
    }
  }
  return out;
}

/** The hexagon's half-width at a height dy from its center. */
export function hexHalfWidth(R: number, dy: number): number {
  const d = Math.abs(dy);
  return d <= R / 2 ? (R * Math.sqrt(3)) / 2 : (R - d) * Math.sqrt(3);
}

export function arcDots(cx: number, cy: number, r: number, from: number, to: number, step: number): Point[] {
  const n = Math.max(1, Math.round((Math.abs(to - from) * r) / step));
  return Array.from({ length: n + 1 }, (_, k) => {
    const a = from + ((to - from) * k) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Dots from p to q, excluding p. */
export function segmentDots(p: Point, q: Point, step: number): Point[] {
  const n = Math.max(1, Math.round(Math.hypot(q.x - p.x, q.y - p.y) / step));
  return Array.from({ length: n }, (_, k) => ({ x: lerp(p.x, q.x, (k + 1) / n), y: lerp(p.y, q.y, (k + 1) / n) }));
}

export function centerOn(pts: Point[], cx: number, cy: number): Point[] {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const ox = cx - (Math.min(...xs) + Math.max(...xs)) / 2;
  const oy = cy - (Math.min(...ys) + Math.max(...ys)) / 2;
  return pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

/** A question mark: a hook over the top, a short stem, a gap, one dot. */
export function questionDots(cx: number, cy: number, r: number, step: number): Point[] {
  const deg = Math.PI / 180;
  const hook = arcDots(0, 0, r, 180 * deg, 420 * deg, step);
  const stem = segmentDots(hook[hook.length - 1], { x: 0, y: r * 1.9 }, step);
  return centerOn([...hook, ...stem, { x: 0, y: r * 1.9 + step * 1.6 }], cx, cy);
}

/** A check mark of six dots, size wide. */
export function checkDots(cx: number, cy: number, size: number): Point[] {
  const shape = [
    { x: 0, y: 0.5 },
    { x: 0.17, y: 0.67 },
    { x: 0.34, y: 0.84 },
    { x: 0.56, y: 0.6 },
    { x: 0.78, y: 0.35 },
    { x: 1, y: 0.1 },
  ];
  return centerOn(shape.map((p) => ({ x: p.x * size, y: p.y * size })), cx, cy);
}

/** Drops dots that land on top of one already kept (where two paths share a stretch). */
export function dedupe(points: Point[], cell: number): Point[] {
  const seen = new Set<string>();
  return points.filter((p) => {
    const key = `${Math.round(p.x / cell)},${Math.round(p.y / cell)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Deterministic pseudo random numbers, so the server and the client agree. */
export function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
