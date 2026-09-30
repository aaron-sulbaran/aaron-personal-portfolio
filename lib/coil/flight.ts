import { COIL } from "./constants";
import { unprojectToPlane, type Basis, type Camera, type CanvasRect, type CardPose, type Quad, type Vec2, type Vec3 } from "./geometry";

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

// ---------------------------------------------------------------- the flown card
//
// The flown card is the mesh: the scene draws the clicked card alone, with the
// card shader, into a canvas above the modal, so what flies is what was in the
// coil, bend, shading, lift and all. These are its poses: on its seat in the
// coil (exactly as last rendered), in the modal's slot (flat, facing the
// camera, unshaded), and every pose between. At 0 the pose is the seat's own
// values and at 1 the slot's, so both swaps draw the same card twice.

// What the card shader reads beyond the pose.
export type FlightLook = {
  bright: number; // the hover brightening toward paper
  shade: number; // the falloff across the bend
  sheen: number;
  seam: number; // 1 dissolves over the hero's bottom edge, 0 never
  seen: number; // the seen ring
  soft: number; // 0 the coil's hard edge, 1 the painted edge's own alpha
  reveal: number; // 0 covered by nearer cards as in the coil, 1 whole
};

export type FlightPose = CardPose & FlightLook;

const IDENTITY: Basis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// The card on its seat: the pose the scene last rendered (lift included) and
// the shading it rendered with.
export function seatPose(rendered: CardPose, look: Pick<FlightLook, "bright" | "shade" | "sheen" | "seen">): FlightPose {
  return { ...rendered, ...look, seam: 1, soft: 0, reveal: 0 };
}

// The card in the slot: flat on the z = 0 plane and facing the camera, so it
// projects exactly onto the slot's 3:4 rect (viewport px; `canvas` is the
// scene canvas's viewport origin).
export function slotPose(camera: Camera, rect: Rect, canvas: CanvasRect, aspect: number = COIL.cardAspect): FlightPose {
  const fit = fitAspect(rect, aspect);
  const x = fit.left + fit.width / 2 - canvas.left;
  const y = fit.top + fit.height / 2 - canvas.top;
  return {
    u: 0,
    position: unprojectToPlane(camera, x, y, 0),
    basis: IDENTITY,
    scale: fit.height * camera.worldPerPx,
    bend: 0,
    beta: 0,
    depth: 1,
    fade: 0,
    alpha: 1,
    bright: 0,
    shade: 0,
    sheen: 0,
    seam: 0,
    seen: 0,
    soft: 1,
    reveal: 1,
  };
}

type Quat = readonly [number, number, number, number];

function quatOf(b: Basis): Quat {
  const [m00, m10, m20] = b.x;
  const [m01, m11, m21] = b.y;
  const [m02, m12, m22] = b.z;
  const trace = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const n = Math.hypot(...q) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

function basisOf([x, y, z, w]: Quat): Basis {
  return {
    x: [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
    y: [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
    z: [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
  };
}

// The shortest turn from a to b.
function slerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let ka = 1 - t;
  let kb = t;
  if (cos < 0.9995) {
    const angle = Math.acos(cos);
    const sin = Math.sin(angle);
    ka = Math.sin((1 - t) * angle) / sin;
    kb = Math.sin(t * angle) / sin;
  }
  const q: [number, number, number, number] = [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb];
  const n = Math.hypot(...q) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smoothstep = (x: number) => x * x * (3 - 2 * x);

// The flown card is clear of the cards that covered it in the coil by this
// much of the way out (and covered again over the same stretch coming home).
export const REVEAL_BY = 0.5;

// The pose at e: 0 on the seat, 1 in the slot. The card travels and turns as
// one rigid body while the bend flattens and the shading, the lift, the seen
// ring and the seam dissolve release with it; e is the eased progress, so they
// follow the flight's own curve.
export function flightPoseAt(seat: FlightPose, slot: FlightPose, e: number): FlightPose {
  if (e <= 0) return seat;
  if (e >= 1) return slot;
  return {
    u: seat.u,
    position: lerp3(seat.position, slot.position, e),
    basis: basisOf(slerp(quatOf(seat.basis), quatOf(slot.basis), e)),
    scale: lerp(seat.scale, slot.scale, e),
    bend: lerp(seat.bend, slot.bend, e),
    // The bend's axis holds still while the bend flattens.
    beta: seat.beta,
    depth: lerp(seat.depth, slot.depth, e),
    fade: lerp(seat.fade, slot.fade, e),
    alpha: lerp(seat.alpha, slot.alpha, e),
    bright: lerp(seat.bright, slot.bright, e),
    shade: lerp(seat.shade, slot.shade, e),
    sheen: lerp(seat.sheen, slot.sheen, e),
    seam: lerp(seat.seam, slot.seam, e),
    seen: lerp(seat.seen, slot.seen, e),
    soft: lerp(seat.soft, slot.soft, e),
    reveal: lerp(seat.reveal, slot.reveal, smoothstep(Math.min(1, e / REVEAL_BY))),
  };
}

// The largest difference between two poses over everything the shader reads
// (lengths in world units, the rest unitless): 0 means the two draw the same
// pixels. The mesh shows again only when the flown card is at 0 from its seat.
export function poseGap(a: FlightPose, b: FlightPose) {
  const vectors: (readonly number[])[][] = [
    [a.position, b.position],
    [a.basis.x, b.basis.x],
    [a.basis.y, b.basis.y],
    [a.basis.z, b.basis.z],
  ];
  let gap = 0;
  vectors.forEach(([p, q]) => {
    for (let i = 0; i < 3; i++) gap = Math.max(gap, Math.abs(p[i] - q[i]));
  });
  const scalars = ["scale", "bend", "fade", "alpha", "bright", "shade", "sheen", "seam", "seen", "soft", "reveal"] as const;
  scalars.forEach((key) => {
    gap = Math.max(gap, Math.abs(a[key] - b[key]));
  });
  if (Math.abs(a.bend) > 1e-4 || Math.abs(b.bend) > 1e-4) gap = Math.max(gap, Math.abs(a.beta - b.beta));
  return gap;
}

// ---------------------------------------------------------------- the handoff
//
// Who is on screen, frame by frame. Every event is one animation frame's worth
// of work, and its actions run in order inside that frame, so the mesh and the
// flown card trade places with no frame showing both poses or neither:
//   open   the flown card is drawn on the seat, then the mesh hides
//   land   the mesh shows (the flown card is exactly on the seat), then the
//          flown card clears
//   frame  the frame after a landing: the scene resumes, one frame's step on
// The scene froze at the click, before the open.

export type HandoffState = "rest" | "out" | "parked" | "home" | "landed";
export type HandoffEvent = "open" | "arrive" | "close" | "land" | "frame" | "abort";
export type HandoffAction = "draw-card" | "hide-mesh" | "show-mesh" | "clear-card" | "resume";

const NOTHING: readonly HandoffAction[] = [];

export function handoff(state: HandoffState, event: HandoffEvent): { state: HandoffState; actions: readonly HandoffAction[] } {
  if (state === "rest" && event === "open") return { state: "out", actions: ["draw-card", "hide-mesh"] };
  if (state === "out" && event === "arrive") return { state: "parked", actions: NOTHING };
  if ((state === "out" || state === "parked") && event === "close") return { state: "home", actions: NOTHING };
  if (state === "home" && event === "land") return { state: "landed", actions: ["show-mesh", "clear-card"] };
  if ((state === "out" || state === "parked" || state === "home") && event === "abort") {
    return { state: "landed", actions: ["show-mesh", "clear-card"] };
  }
  if (state === "landed" && event === "frame") return { state: "rest", actions: ["resume"] };
  return { state, actions: NOTHING };
}

// ---------------------------------------------------------------- the freeze
//
// A frozen scene holds its clocks: the first frame after it steps one frame
// at most, and anything timed from a start (a glide, the unwind) carries on
// from where the freeze caught it.

export const RESUME_STEP_S = 1 / 60;

export function resumeStep(intervalSeconds: number) {
  return Math.min(Math.max(intervalSeconds, 0), RESUME_STEP_S);
}

export function afterPause<T extends { startMs: number }>(timed: T | null, pausedMs: number): T | null {
  return timed ? { ...timed, startMs: timed.startMs + Math.max(0, pausedMs) } : null;
}
