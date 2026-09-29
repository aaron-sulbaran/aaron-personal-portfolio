import { COIL, type CoilConstants } from "./constants";
import { siteEase } from "./motion";
import type { Basis, CardPose, Vec3 } from "./geometry";

// The unwind egg, ported from hero lab 2 (1088-1097, 1258-1286, 1318-1325,
// 1436-1446): double-click open hero space and the helix unwinds in place into
// a column, each card beside its title and meta in the hero's DOM layer; "Coil"
// or Esc winds it back. Never driven by scroll.
//
// At the toggle each of the N cards latches its copy nearest the strand's
// center; the conveyor holds still at the latch offset while anything is off
// rest. Each latched card runs its own clock (580ms on the site ease, 8ms of
// stagger along the strand): over the first 55 percent of it the card pulls
// into the axis and turns to face the camera, from 28 percent on it flies to
// its row. Every other copy dissolves in the first 35 percent. At progress 0
// every modifier is the identity, so the coil returns to exactly the pose it
// left.
//
// Pure: the scene owns the state, and every function reads the timestamp it
// is given.

export type UnwindTarget = {
  position: Vec3; // the row's card center, world units (on the z = 0 plane)
  scale: number; // world units per card unit (the row's card height)
} | null;

// Where the cards land: the helix axis they collapse onto, and each tile's row
// (by tile index; null where no row is measured).
export type UnwindColumn = {
  axisCenter: Vec3;
  axisDirection: Vec3; // unit
  targets: readonly UnwindTarget[];
};

export type UnwindState = {
  on: boolean;
  startMs: number; // the last toggle
  // Each tile's progress at the last toggle, so a reversal mid-flight never jumps.
  from: readonly number[];
  // Each tile's latched copy (absolute strand position), fixed while unwound;
  // null at rest.
  latched: readonly number[] | null;
  offset: number; // the conveyor offset held while latched
  column: UnwindColumn | null;
};

export function createUnwind(): UnwindState {
  return { on: false, startMs: 0, from: [], latched: null, offset: 0, column: null };
}

// The copy of each of the N tiles nearest the strand's center for conveyor
// offset X: the instance that flies to its row when the helix unwinds.
export function latchPositions(offset: number, cardCount: number): number[] {
  return Array.from({ length: cardCount }, (_, i) => i + cardCount * Math.round((-offset - i) / cardCount));
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// A tile's order along the strand among the latched copies (0 first).
function order(latched: readonly number[], tile: number) {
  return latched[tile] - Math.min(...latched);
}

// From the first card leaving to the last card landing.
export function unwindDurationMs(cardCount: number, c: CoilConstants = COIL) {
  return c.unwind.perCardMs + c.unwind.staggerMs * Math.max(0, cardCount - 1);
}

// One tile's progress, 0 coiled to 1 in its row.
export function unwindTileProgress(state: UnwindState, tile: number, nowMs: number, c: CoilConstants = COIL): number {
  const latched = state.latched;
  if (!latched || tile < 0 || tile >= latched.length) return 0;
  const t = clamp01((nowMs - state.startMs - order(latched, tile) * c.unwind.staggerMs) / c.unwind.perCardMs);
  const eased = siteEase(t);
  const from = state.from[tile] ?? 0;
  return state.on ? from + (1 - from) * eased : from * (1 - eased);
}

// Overall list progress, the mean over tiles: 0 only when every card is home,
// 1 only when every card has landed. Always 0 at rest.
export function unwindProgress(state: UnwindState, nowMs: number, c: CoilConstants = COIL): number {
  const latched = state.latched;
  if (!latched || latched.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < latched.length; i++) sum += unwindTileProgress(state, i, nowMs, c);
  return sum / latched.length;
}

// Flips (or sets) the unwind at nowMs. Latches at the current conveyor offset
// when leaving rest; a reversal starts every card from where it is.
export function toggleUnwind(
  state: UnwindState,
  nowMs: number,
  offset: number,
  cardCount: number,
  on: boolean = !state.on,
  c: CoilConstants = COIL,
): UnwindState {
  if (on === state.on) return state;
  const from = Array.from({ length: cardCount }, (_, i) => unwindTileProgress(state, i, nowMs, c));
  if (!state.latched) {
    state.latched = latchPositions(offset, cardCount);
    state.offset = offset;
  }
  state.from = from;
  state.on = on;
  state.startMs = nowMs;
  return state;
}

// Once wound all the way back, the latch lets go and the coil runs free.
// True on the call that lets go.
export function settleUnwind(state: UnwindState, nowMs: number, c: CoilConstants = COIL): boolean {
  if (state.on || !state.latched) return false;
  if (nowMs - state.startMs < unwindDurationMs(state.latched.length, c)) return false;
  state.latched = null;
  state.from = [];
  return true;
}

// ---------------------------------------------------------------- the pose

type Quat = readonly [number, number, number, number]; // x, y, z, w

const IDENTITY: Basis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

// A rotation (columns x, y, z) as a unit quaternion.
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

function basisOf(q: Quat): Basis {
  const [x, y, z, w] = q;
  return {
    x: [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
    y: [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
    z: [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
  };
}

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

function slerpBasis(a: Basis, b: Basis, t: number): Basis {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return basisOf(slerp(quatOf(a), quatOf(b), t));
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// The point on the axis line nearest p.
function onAxis(column: UnwindColumn, p: Vec3): Vec3 {
  const { axisCenter: o, axisDirection: d } = column;
  const along = (p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1] + (p[2] - o[2]) * d[2];
  return [o[0] + d[0] * along, o[1] + d[1] * along, o[2] + d[2] * along];
}

// A card's pose between the coil and its row. The latched copy of `tile`
// collapses onto the axis facing the camera, then flies to its row (the
// explicit `target`, else the state's measured column); every other copy
// dissolves. The identity at progress 0.
export function unwindPose<P extends CardPose>(
  pose: P,
  tile: number,
  state: UnwindState,
  nowMs: number,
  target: UnwindTarget = null,
  c: CoilConstants = COIL,
): P {
  const latched = state.latched;
  if (!latched) return pose;
  const progress = unwindTileProgress(state, tile, nowMs, c);
  if (progress <= 0) return pose;

  const strandPosition = Math.round(pose.u - state.offset);
  if (strandPosition !== latched[tile]) {
    return { ...pose, alpha: pose.alpha * (1 - smooth(seg(progress, 0, 0.35))) };
  }

  const collapse = inOut(seg(progress, 0, 0.55));
  const fly = inOut(seg(progress, 0.28, 1));
  const column = state.column;
  const position = lerp3(pose.position, column ? onAxis(column, pose.position) : pose.position, collapse);
  const basis = slerpBasis(pose.basis, IDENTITY, collapse);
  const bend = pose.bend * (1 - collapse);
  const beta = pose.beta * (1 - collapse);
  const fade = pose.fade * (1 - collapse);
  const depth = lerp(pose.depth, 1, collapse);

  const row = target ?? column?.targets[tile] ?? null;
  if (!row) {
    return { ...pose, position, basis, bend, beta, fade, depth, alpha: pose.alpha * (1 - smooth(seg(progress, 0, 0.45))) };
  }
  return {
    ...pose,
    position: lerp3(position, row.position, fly),
    basis: slerpBasis(basis, IDENTITY, fly),
    scale: lerp(pose.scale, row.scale, fly),
    bend: lerp(bend, 0, fly),
    beta: lerp(beta, 0, fly),
    fade: lerp(fade, 0, fly),
    depth: lerp(depth, 1, fly),
    alpha: lerp(pose.alpha, 1, fly),
  };
}
