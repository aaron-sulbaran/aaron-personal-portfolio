import { COIL, type CoilConstants } from "./constants";
import { power2InOut, power2Out, sceneMs } from "./dealSpeed";
import type { Basis, CardPose, CoilGeometry, HelixFrame, Vec3 } from "./geometry";
import { cubicBezier, siteEase } from "./motion";

// The deal's act on the strand (docs/superpowers/specs/2026-10-22-wheel-deal-motion.md).
// It starts as a wheel: the 14-card band ring seen near frontal, turning slowly
// face up in the teaser's slot. On the click the wheel spins up, then flattens
// into the closed band (the frame's lean, axis, size and center lerp to the
// band's), the band slows, and two hands pull it open: first the seam parts
// along the axis (a split ring, like a washer), then the band winds into the
// rested coil on the pull curve. The field opens around it on a mask.
//
// Modifiers, all pure: wheelHelix and pullHelix bend the frame (winding,
// radius, rise, card size, lean, axis, center) and entrancePose moves one card
// (which of them wait hidden). From the end of the clock on they are the
// identity, so the final pose is the rest pose exactly. The strand's offset is
// not here: lib/coil/dealSpeed.ts decides it, and the same offset poses the
// wheel, the band and the helix, so the angular speed is continuous across the
// changes of layout by construction.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export type EntranceClock = {
  elapsedS: number; // seconds since the click; negative before it
  durationS: number;
  // How far the wheel has slid into the teaser (0: not yet seen, 1: seated).
  // The scene decides it from the page; it is 1 everywhere else.
  wheelIn: number;
  // How far the wheel sits off its slot, in CSS px (down is positive): the
  // knee that slows it into the stage's sticking (pinKnee). The scene reads it
  // from the page; 0 everywhere else.
  wheelDyPx: number;
  // How far the strand has turned since the pull began, in cards. The band's
  // cards keep their places in it while it opens, however far the strand turns
  // (0 until the pull begins).
  drift: number;
  // The constants this clock was made with, present only when they are not
  // COIL itself (the deal's lab tunes the timeline, the wheel and the field);
  // every function below that takes `c` reads it from here by default.
  c?: CoilConstants;
};

export function entranceClock(elapsedMs: number, c: CoilConstants = COIL, wheelIn = 1, drift = 0, wheelDyPx = 0): EntranceClock {
  const base = { elapsedS: elapsedMs / 1000, durationS: sceneMs(c) / 1000, wheelIn, drift, wheelDyPx };
  return c === COIL ? base : { ...base, c };
}

// The deal values the lab can tune, merged over COIL.deal: the timeline, the
// wheel (its pace, lean, scale and nudges) and the field's opening. An absent
// tuning is COIL's own.
export type EntranceTuning = {
  timeline?: Partial<Record<keyof CoilConstants["deal"]["timeline"], number>>;
  wheel?: Partial<Record<"idleCardsPerSecond" | "leanDeg" | "scale" | "offsetX" | "offsetY" | "pinKneePx", number>>;
  open?: Partial<Record<"ms" | "reach", number>>;
};

const tuned = new Map<string, CoilConstants>();
const TUNED_LIMIT = 48;
export function tunedConstants(tuning: EntranceTuning | undefined): CoilConstants {
  if (!tuning) return COIL;
  const d = COIL.deal;
  const timeline = { ...d.timeline, ...tuning.timeline };
  const wheel = { ...d.wheel, ...tuning.wheel };
  const open = { ...d.open, ...tuning.open };
  const key = JSON.stringify([timeline, wheel, open]);
  if (key === JSON.stringify([d.timeline, d.wheel, d.open])) return COIL;
  let c = tuned.get(key);
  if (!c) {
    if (tuned.size >= TUNED_LIMIT) tuned.clear();
    c = { ...COIL, deal: { ...COIL.deal, timeline, wheel, open } };
    tuned.set(key, c);
  }
  return c;
}

export function isEntering(clock: EntranceClock) {
  return clock.elapsedS >= 0 && clock.elapsedS < clock.durationS + 0.02;
}

// Not clicked yet: the wheel waits, turning slowly.
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
export function pullCurve(c: CoilConstants) {
  let curve = pullCurves.get(c);
  if (!curve) {
    curve = cubicBezier(...c.entrance.pullCurve);
    pullCurves.set(c, curve);
  }
  return curve;
}

const elapsedMs = (clock: EntranceClock) => clock.elapsedS * 1000;

// The pull's progress, 0 through the wheel, the spin and the band's slowing,
// 1 at rest.
export function pullProgress(clock: EntranceClock, c: CoilConstants = clock.c ?? COIL) {
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  const { pullStartMs, pullMs } = c.deal.timeline;
  return pullCurve(c)(seg(elapsedMs(clock), pullStartMs, pullStartMs + pullMs));
}

// The wheel's flattening into the band: 0 the wheel, 1 the band.
export function flattenProgress(clock: EntranceClock, c: CoilConstants = clock.c ?? COIL) {
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  const { flattenStartMs, flattenMs } = c.deal.timeline;
  return power2InOut(seg(elapsedMs(clock), flattenStartMs, flattenStartMs + flattenMs));
}

// The two hands: the seam parts along the axis over the first 0.38 of the
// pull, and the winding starts only once it has, so the ends are a full seam
// apart before they sweep past each other.
export function pullPhases(pull: number, c: CoilConstants = COIL) {
  return { part: smooth(seg(pull, 0, 0.38)), wind: seg(pull, c.entrance.windStart, 1) };
}

// ---------------------------------------------------------------- the wheel

// The wheel's place, from the geometry (the slot it sits in, as shares of the
// canvas) and the lab's nudges: its center and card size in world units, its
// axis and lean. The ring is the band's own (14 cards on one turn), seen from
// the side at a lean of a few degrees, the axis upright.
export function wheelPlacement(geo: CoilGeometry, c: CoilConstants = COIL) {
  const w = c.deal.wheel;
  const perPx = geo.camera.worldPerPx;
  const center: Vec3 = [
    (geo.wheelAnchor.x - 0.5 + w.offsetX) * geo.canvas.width * perPx,
    (0.5 - geo.wheelAnchor.y - w.offsetY) * geo.canvas.height * perPx,
    0,
  ];
  return { center, cardWorld: geo.wheelCardWorld * w.scale, axisRad: 0, leanRad: w.leanDeg * DEG };
}

// Frame level: the frame (the band or further along the pull) pulled toward
// the wheel by (1 - flatten): 0 is the wheel, 1 returns the frame as is. While
// the wheel slides in (wheelIn under 1) it sits to the right by the rest of
// its way.
export function wheelHelix(frame: HelixFrame, geo: CoilGeometry, flatten: number, wheelIn: number, c: CoilConstants = COIL, dyPx = 0): HelixFrame {
  if (flatten >= 1) return frame;
  const wheel = wheelPlacement(geo, c);
  const perPx = geo.camera.worldPerPx;
  const slide = (1 - wheelIn) * c.deal.wheel.slideFrom * geo.canvas.width * perPx;
  return {
    ...frame,
    axisRad: lerp(wheel.axisRad, frame.axisRad, flatten),
    leanRad: lerp(wheel.leanRad, frame.leanRad, flatten),
    center: lerp3([wheel.center[0] + slide, wheel.center[1] - dyPx * perPx, wheel.center[2]], frame.center, flatten),
    cardWorld: lerp(wheel.cardWorld, frame.cardWorld, flatten),
  };
}

// The wheel's slow-down into the stage's sticking. `railTopPx` is the rail's top
// edge in the viewport: above 0 the stage still rides the page with the wheel,
// at or below 0 it is stuck. Returns how far the wheel sits off the slot it is
// riding in, in px (up is negative), so that its screen position follows
// g(x) = 2x^2/K - x^3/K^2 over the last K px (x the rail's top): g(K) = K and
// g'(K) = 1 join the free ride with no kink, g(0) = 0 and g'(0) = 0 bring the
// wheel to rest as the stage sticks, with no step in its speed. 0 outside (0, K).
export function pinKnee(railTopPx: number, kneePx: number): number {
  if (!(kneePx > 0) || railTopPx <= 0 || railTopPx >= kneePx) return 0;
  const x = railTopPx;
  return (2 * x * x) / kneePx - (x * x * x) / (kneePx * kneePx) - x;
}

// How far the wheel has slid in, `sinceInViewMs` after it was first in view.
export function wheelSlideProgress(sinceInViewMs: number, c: CoilConstants = COIL) {
  return siteEase(seg(sinceInViewMs, 0, c.deal.wheel.slideMs));
}

// ---------------------------------------------------------------- the pull

// Frame level: the band's winding, radius, rise, card size and lean pulled
// toward the rested helix (`rest` may already carry the stretch envelope) by
// the pull itself: 0 is the closed band; 1 returns the rest frame as is, so a
// rested coil is exactly the rest frame.
export function pullHelix(rest: HelixFrame, geo: CoilGeometry, pull: number, c: CoilConstants = COIL): HelixFrame {
  if (pull >= 1) return rest;
  const n = geo.cardCount;
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

// The whole frame: the rest helix, pulled toward the closed band, which is
// pulled toward the wheel while it has not flattened.
export function entranceHelix(rest: HelixFrame, geo: CoilGeometry, clock: EntranceClock, c: CoilConstants = clock.c ?? COIL): HelixFrame {
  if (isRested(clock)) return rest;
  const band = pullHelix(rest, geo, pullProgress(clock, c), c);
  return wheelHelix(band, geo, flattenProgress(clock, c), clock.wheelIn, c, clock.wheelDyPx);
}

// The copies outside the one band wait hidden and fade in late in the pull.
export function outOfBandAlpha(pull: number) {
  return smooth(seg(pull, 0.35, 0.9));
}

export type EntranceCard = {
  cardCount: number; // N
};

// The cards of the one ring: the N consecutive strand positions that sit in
// [-N/2, N/2) of the window. Before the pull the strand turns and the ring
// with it: a card crossing the edge of the window is replaced, at the same
// place in the ring (a ring has no seam), by its twin one turn away. From the
// pull on, the cards that formed the ring keep their places in it (`drift` is
// how far the strand has turned since), so the seam of the opening washer
// stays between the same two cards.
export function inRing(u: number, drift: number, cardCount: number) {
  const v = u - drift;
  return v >= -cardCount / 2 && v < cardCount / 2;
}

// Card level: which cards show. The ring's cards always do; the copies
// outside it wait hidden and fade in late in the pull; and the whole wheel
// waits transparent until it has slid in. The pose is otherwise the
// frame's, so the wheel, the band and the helix are one object.
export function entrancePose<P extends CardPose>(
  pose: P,
  card: EntranceCard,
  clock: EntranceClock,
  c: CoilConstants = clock.c ?? COIL,
): P {
  if (isRested(clock)) return pose;
  const ring = inRing(pose.u, clock.drift, card.cardCount);
  const shown = ring ? 1 : outOfBandAlpha(pullProgress(clock, c));
  return { ...pose, alpha: pose.alpha * shown * clock.wheelIn };
}

// ---------------------------------------------------------------- the field

// The mask the field opens on: a circle anchored top center of the canvas that
// grows (power2.out) until its feathered edge has cleared the farthest corner.
// Radius 0 is closed (the scene skips the field), OPEN_ALL is open.
export const OPEN_ALL = 1e6;
export type FieldMask = { cx: number; cy: number; radius: number; feather: number };

export function openProgress(clock: EntranceClock, c: CoilConstants = clock.c ?? COIL) {
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  const { openStartMs } = c.deal.timeline;
  return power2Out(seg(elapsedMs(clock), openStartMs, openStartMs + c.deal.open.ms));
}

export function fieldMask(clock: EntranceClock, canvas: { width: number; height: number }, c: CoilConstants = clock.c ?? COIL): FieldMask {
  const { reach, featherPx, featherShare } = c.deal.open;
  const p = openProgress(clock, c);
  const cx = canvas.width / 2;
  // The edge widens as the circle opens; at the end its inner edge has just
  // cleared the farthest corner.
  const farthest = Math.hypot(canvas.width / 2, canvas.height) * reach;
  const widest = Math.max(featherPx, featherShare * farthest);
  if (p >= 1) return { cx, cy: 0, feather: widest, radius: OPEN_ALL };
  if (p <= 0) return { cx, cy: 0, feather: featherPx, radius: 0 };
  return { cx, cy: 0, feather: featherPx + (widest - featherPx) * p, radius: (farthest + widest) * p };
}

// ---------------------------------------------------------------- the name

// How much of the canvas name shows. `handedOff` is null when no loader lands
// the name (it then fades up behind the band as the band opens), false while
// the loader still holds it, and true from the frame the loader hands it over.
export function entranceNameAlpha(clock: EntranceClock, handedOff: boolean | null, c: CoilConstants = clock.c ?? COIL) {
  if (handedOff !== null) return handedOff ? 1 : 0;
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  return smooth(seg(elapsedMs(clock), c.deal.timeline.pullStartMs, clock.durationS * 1000));
}

// ---------------------------------------------------------------- rotations

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
