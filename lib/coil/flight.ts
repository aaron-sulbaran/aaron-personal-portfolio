import type { Quad, Vec2 } from "./geometry";

// The flight adapter between a curved card in the canvas and a modal's media
// slot: the card's four bent corners (projectQuad, in viewport px) and the
// slot as a quad, interpolated by one progress value, and the homography that
// maps the flying clone's box onto the in-between quad as a CSS matrix3d.
// Pure; FlyingTile owns the clock.
//
// Corner order everywhere is the front face's: top left, top right, bottom
// right, bottom left. A card seen from behind (the back of the coil) projects
// that order mirrored, so its signed area is negative; the path from a mirrored
// quad to an upright slot turns the card over through its own midline instead
// of lerping through a self-intersecting bow tie.

export type Rect = { left: number; top: number; width: number; height: number };
export type Face = "front" | "back";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function rectQuad(r: Rect): Quad {
  return [
    { x: r.left, y: r.top },
    { x: r.left + r.width, y: r.top },
    { x: r.left + r.width, y: r.top + r.height },
    { x: r.left, y: r.top + r.height },
  ];
}

// The largest rect of `aspect` (width / height) centered inside r: a 3:4 card
// landing in a square slot keeps its shape.
export function fitAspect(r: Rect, aspect: number): Rect {
  const width = Math.min(r.width, r.height * aspect);
  const height = width / aspect;
  return { left: r.left + (r.width - width) / 2, top: r.top + (r.height - height) / 2, width, height };
}

// Shoelace area in screen space (y down): positive for the front face.
export function signedArea(q: Quad) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function faceOf(q: Quad): Face {
  return signedArea(q) < 0 ? "back" : "front";
}

export function lerpQuad(a: Quad, b: Quad, t: number): Quad {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return [0, 1, 2, 3].map((i) => ({ x: lerp(a[i].x, b[i].x, t), y: lerp(a[i].y, b[i].y, t) })) as unknown as Quad;
}

// Convex and not self-intersecting: every corner turns the same way. A card
// nearly edge on can project its bent corners into a concave quad, which no
// homography can fill; the flight then starts from the flat card's corners.
export function isConvex(q: Quad) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const turn = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(turn) < 1e-6) continue;
    if (sign === 0) sign = Math.sign(turn);
    else if (Math.sign(turn) !== sign) return false;
  }
  return true;
}

// The quad squeezed onto its vertical midline (edge on, mid turn).
export function midline(q: Quad): Quad {
  const top = mid(q[0], q[1]);
  const bottom = mid(q[2], q[3]);
  return [top, top, bottom, bottom];
}

// Where the turn-over happens along a flipping path.
export const FLIP_AT = 0.35;

// The in-between quad at progress t (0 at `from`, 1 at `to`) and the face it
// shows. Same facing: a straight corner lerp. Opposite facing: `from` narrows
// to its midline by FLIP_AT, then opens out onto `to`.
export function flightQuad(from: Quad, to: Quad, t: number): { quad: Quad; face: Face } {
  if (faceOf(from) === faceOf(to)) return { quad: lerpQuad(from, to, t), face: faceOf(to) };
  if (t < FLIP_AT) return { quad: lerpQuad(from, midline(from), t / FLIP_AT), face: faceOf(from) };
  return { quad: lerpQuad(midline(from), to, (t - FLIP_AT) / (1 - FLIP_AT)), face: faceOf(to) };
}

// The largest corner distance between two quads, in px.
export function quadOffset(a: Quad, b: Quad) {
  return Math.max(...[0, 1, 2, 3].map((i) => Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y)));
}

// The projective map from a w by h box (origin top left) onto the quad, as the
// 16 column-major values of a CSS matrix3d (transform-origin 0 0). Null when
// the quad is degenerate (edge on, or collapsed), where nothing should draw.
export function homography(q: Quad, w: number, h: number, minArea = 0.5): number[] | null {
  if (Math.abs(signedArea(q)) < minArea) return null;
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let k = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    k = (dx1 * dy3 - dx3 * dy1) / den;
  }
  // Unit square to quad.
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + k * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + k * p3.y;
  const f = p0.y;
  // Then the box onto the unit square: divide the x column by w, y by h.
  return [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1];
}

// Applies a matrix3d (column-major) to a box point, for tests and checks.
export function mapPoint(m: readonly number[], x: number, y: number): Vec2 {
  const X = m[0] * x + m[4] * y + m[12];
  const Y = m[1] * x + m[5] * y + m[13];
  const W = m[3] * x + m[7] * y + m[15];
  return { x: X / W, y: Y / W };
}

export function matrix3d(m: readonly number[]) {
  return `matrix3d(${m.map((v) => (Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(10)))).join(",")})`;
}
