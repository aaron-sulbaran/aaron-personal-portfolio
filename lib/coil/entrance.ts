import { COIL, type CoilConstants } from "./constants";
import type { Basis, CardPose, CoilGeometry, HelixFrame, Vec3 } from "./geometry";
import { cubicBezier, siteEase } from "./motion";

// The band-first entrance, ported from hero lab 2 (1084-1086, 1156-1166,
// 1219-1237). Over 1800ms: the cards stack in at the center, shutter out of
// the stack one by one (the stagger) into a single closed band (every card on
// one turn, the band's lean), hold there a beat, then two hands pull the band
// open. The pull has two phases so the band's ends never pass through each
// other: first the seam parts along the axis (a split ring, like a washer),
// then the band winds into the rested coil on the pull curve.
//
// Two modifiers, both pure: entranceHelix bends the frame (winding, radius,
// rise, card size, lean) and entrancePose moves one card (the stack, the
// shutter, and the fade of copies outside the band). Before the clock starts
// every card is hidden; from the end of the clock on both are the identity,
// so the final pose is the rest pose exactly.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export type EntranceClock = {
  elapsedS: number; // seconds since the entrance started; negative before it
  durationS: number;
};

export function entranceClock(elapsedMs: number, c: CoilConstants = COIL): EntranceClock {
  return { elapsedS: elapsedMs / 1000, durationS: c.entrance.durationMs / 1000 };
}

export function isEntering(clock: EntranceClock) {
  return clock.elapsedS >= 0 && clock.elapsedS < clock.durationS + 0.02;
}

// Not started: the loader still holds the pane, and no card shows.
export function isBeforeEntrance(clock: EntranceClock) {
  return clock.elapsedS < 0;
}

// Over: the modifiers are the identity from here on.
export function isRested(clock: EntranceClock) {
  return clock.elapsedS >= clock.durationS;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const pullCurves = new WeakMap<CoilConstants, (x: number) => number>();
function pullCurve(c: CoilConstants) {
  let curve = pullCurves.get(c);
  if (!curve) {
    curve = cubicBezier(...c.entrance.pullCurve);
    pullCurves.set(c, curve);
  }
  return curve;
}

// The pull's progress, 0 through the stack, shutter and hold, 1 at rest.
export function pullProgress(clock: EntranceClock, c: CoilConstants = COIL) {
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  const T = clock.durationS;
  return pullCurve(c)(seg(clock.elapsedS, c.entrance.pullStart * T, T));
}

// The two hands: the seam parts along the axis over the first 0.38 of the
// pull, and the winding starts only once it has, so the ends are a full seam
// apart before they sweep past each other.
export function pullPhases(pull: number, c: CoilConstants = COIL) {
  return { part: smooth(seg(pull, 0, 0.38)), wind: seg(pull, c.entrance.windStart, 1) };
}

// Frame level: the band's winding, radius, rise, card size and lean pulled
// toward the rested helix (`rest` may already carry the stretch envelope).
export function entranceHelix(
  rest: HelixFrame,
  geo: CoilGeometry,
  clock: EntranceClock,
  c: CoilConstants = COIL,
): HelixFrame {
  if (isRested(clock)) return rest;
  const n = geo.cardCount;
  const pull = pullProgress(clock, c);
  const { part, wind } = pullPhases(pull, c);
  const angStep = lerp(TAU / n, rest.angStep, wind);
  return {
    ...rest,
    angStep,
    radius: geo.step / angStep,
    dy: lerp((c.lab.washerPitch / n) * part, rest.dy, wind),
    cardWorld: lerp(geo.bandCardWorld, rest.cardWorld, pull),
    leanRad: lerp(c.camera.bandLeanDeg * DEG, rest.leanRad, pull),
  };
}

export type EntranceCard = {
  strandPosition: number; // absolute position on the strand
  cardCount: number; // N
};

// The copies of each card outside the one band (strand positions outside
// [-N/2, N/2)) wait hidden and fade in late in the pull.
export function inBand(strandPosition: number, cardCount: number) {
  return strandPosition >= -cardCount / 2 && strandPosition < cardCount / 2;
}

// The deal: the first card leaves the stack first and the sweep goes once
// around the band.
export function shutterRank(strandPosition: number, cardCount: number) {
  return ((strandPosition % cardCount) + cardCount) % cardCount;
}

// How far a card has flown from the stack into the band (0 to 1).
export function shutterProgress(rank: number, clock: EntranceClock, c: CoilConstants = COIL) {
  const T = clock.durationS;
  const start = (c.entrance.shutterStart + rank * c.entrance.shutterStagger) * T;
  return siteEase(clamp01((clock.elapsedS - start) / (c.entrance.fly * T)));
}

// Card level: the stack, the shutter into the band, and the late fade of the
// copies outside it. `pose` is the card's pose on the entrance frame.
export function entrancePose<P extends CardPose>(
  pose: P,
  card: EntranceCard,
  geo: CoilGeometry,
  clock: EntranceClock,
  c: CoilConstants = COIL,
): P {
  if (isRested(clock)) return pose;
  if (isBeforeEntrance(clock)) return { ...pose, alpha: 0 };
  const n = card.cardCount;
  if (!inBand(card.strandPosition, n)) {
    return { ...pose, alpha: pose.alpha * smooth(seg(pullProgress(clock, c), 0.35, 0.9)) };
  }
  const rank = shutterRank(card.strandPosition, n);
  const flown = shutterProgress(rank, clock, c);
  if (flown >= 1) return pose;
  // The stack: square to the camera at the helix center, the first card on top.
  const stackAlpha = smooth(clamp01(clock.elapsedS / (c.entrance.stackIn * clock.durationS)));
  const stackPosition: Vec3 = [geo.center[0], geo.center[1], geo.center[2] + (n - rank) * 0.004 + 0.3];
  return {
    ...pose,
    position: lerp3(stackPosition, pose.position, flown),
    basis: slerpBasis(IDENTITY_BASIS, pose.basis, flown),
    scale: lerp(geo.bandCardWorld * 0.94, pose.scale, flown),
    bend: lerp(0, pose.bend, flown),
    beta: lerp(0, pose.beta, flown),
    depth: lerp(1, pose.depth, flown),
    fade: lerp(0, pose.fade, flown),
    alpha: flown > 0 ? 1 : stackAlpha,
  };
}

// ---------------------------------------------------------------- the name

// How much of the canvas name shows. `handedOff` is null when no loader lands
// the name (it then fades up behind the band as the band opens), false while
// the loader still holds it, and true from the frame the loader hands it over.
export function entranceNameAlpha(clock: EntranceClock, handedOff: boolean | null, c: CoilConstants = COIL) {
  if (handedOff !== null) return handedOff ? 1 : 0;
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  return smooth(seg(clock.elapsedS, c.entrance.pullStart * clock.durationS, clock.durationS));
}

// ---------------------------------------------------------------- rotations

const IDENTITY_BASIS: Basis = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export type Quat = readonly [number, number, number, number]; // x, y, z, w

function unit(q: Quat): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

// A rotation matrix with columns x, y, z to a unit quaternion.
export function basisToQuat(b: Basis): Quat {
  const [m00, m10, m20] = b.x;
  const [m01, m11, m21] = b.y;
  const [m02, m12, m22] = b.z;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return unit([(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]);
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return unit([0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]);
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return unit([(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]);
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return unit([(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]);
}

export function quatToBasis([x, y, z, w]: Quat): Basis {
  return {
    x: [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
    y: [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
    z: [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)],
  };
}

// The shortest-arc spherical interpolation between two orientations (the
// lab's Quaternion.slerpQuaternions).
export function slerpBasis(a: Basis, b: Basis, t: number): Basis {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const qa = basisToQuat(a);
  let qb = basisToQuat(b);
  let cos = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
  if (cos < 0) {
    qb = [-qb[0], -qb[1], -qb[2], -qb[3]];
    cos = -cos;
  }
  let wa = 1 - t;
  let wb = t;
  if (cos < 0.9995) {
    const angle = Math.acos(cos);
    const sin = Math.sin(angle);
    wa = Math.sin((1 - t) * angle) / sin;
    wb = Math.sin(t * angle) / sin;
  }
  return quatToBasis(
    unit([qa[0] * wa + qb[0] * wb, qa[1] * wa + qb[1] * wb, qa[2] * wa + qb[2] * wb, qa[3] * wa + qb[3] * wb]),
  );
}
