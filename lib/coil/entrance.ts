import { COIL, type CoilConstants } from "./constants";
import { power2InOut, power2Out, sceneMs } from "./dealSpeed";
import type { Basis, CardPose, CoilGeometry, HelixFrame, Vec3 } from "./geometry";
import { cubicBezier } from "./motion";
import { ribbonEdgeAlphaWorld, ribbonHelix, type RibbonEdge } from "./ribbon";

// The deal's act on the strand (docs/superpowers/specs/2026-10-22-wheel-deal-motion.md,
// and slice 4c). It starts as the ribbon: the 14 cards in one flat row on the
// first screen, drifting left. On the click the gaps between the cards close and
// the row gathers toward the middle (the condense), then the row curls into the
// wheel, the 14-card band ring seen near frontal, which spins up and flattens
// into the closed band (the frame's lean, axis, size and center lerp to the
// band's); the band slows, and two hands pull it open: first the seam parts along
// the axis (a split ring, like a washer), then the band winds into the rested
// coil on the pull curve. The name dissolves into the field meanwhile, and the
// field's opening lifts the faded patch behind the paragraphs.
//
// Modifiers, all pure: ribbonHelix (lib/coil/ribbon.ts), wheelHelix and
// pullHelix bend the frame (winding, radius, rise, card size, lean, axis,
// center) and entrancePose moves one card (which of them wait hidden, and the
// ribbon's faded edges). From the end of the clock on they are the identity,
// so the final pose is the rest pose exactly. The strand's offset is not here:
// lib/coil/dealSpeed.ts decides it, and the same offset poses the ribbon, the
// wheel, the band and the helix, so the speed is continuous across the changes
// of layout by construction.
//
// The clock's zero is the end of the condense (every time in
// COIL.deal.timeline except condenseMs counts from it): the condense runs over
// the clock's negative stretch, and before the click the clock is minus infinity.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export type EntranceClock = {
  // Seconds since the end of the condense: negative while the gaps condense and
  // before the click (minus infinity).
  elapsedS: number;
  durationS: number;
  // How far the strand has turned since the pull began, in cards. The band's
  // cards keep their places in it while it opens, however far the strand turns
  // (0 until the pull begins).
  drift: number;
  // The constants this clock was made with, present only when they are not
  // COIL itself (the deal's lab tunes the timeline, the ribbon, the wheel and
  // the field); every function below that takes `c` reads it from here by default.
  c?: CoilConstants;
};

export function entranceClock(elapsedMs: number, c: CoilConstants = COIL, drift = 0): EntranceClock {
  const base = { elapsedS: elapsedMs / 1000, durationS: sceneMs(c) / 1000, drift };
  return c === COIL ? base : { ...base, c };
}

// The deal values the lab can tune, merged over COIL.deal: the timeline, the
// ribbon, the wheel (its lean, scale and nudges) and the field's opening. An
// absent tuning is COIL's own.
export type EntranceTuning = {
  timeline?: Partial<Record<keyof CoilConstants["deal"]["timeline"], number>>;
  ribbon?: Partial<Record<keyof CoilConstants["deal"]["ribbon"], number>>;
  wheel?: Partial<Record<"leanDeg" | "scale" | "offsetX" | "offsetY", number>>;
  open?: Partial<Record<"ms" | "reach", number>>;
};

const tuned = new Map<string, CoilConstants>();
const TUNED_LIMIT = 48;
export function tunedConstants(tuning: EntranceTuning | undefined): CoilConstants {
  if (!tuning) return COIL;
  const d = COIL.deal;
  const timeline = { ...d.timeline, ...tuning.timeline };
  const ribbon = { ...d.ribbon, ...tuning.ribbon };
  const wheel = { ...d.wheel, ...tuning.wheel };
  const open = { ...d.open, ...tuning.open };
  const key = JSON.stringify([timeline, ribbon, wheel, open]);
  if (key === JSON.stringify([d.timeline, d.ribbon, d.wheel, d.open])) return COIL;
  let c = tuned.get(key);
  if (!c) {
    if (tuned.size >= TUNED_LIMIT) tuned.clear();
    c = { ...COIL, deal: { ...COIL.deal, timeline, ribbon, wheel, open } };
    tuned.set(key, c);
  }
  return c;
}

export function isEntering(clock: EntranceClock) {
  return clock.elapsedS >= 0 && clock.elapsedS < clock.durationS + 0.02;
}

// The ring has not begun: the ribbon drifts, or its gaps are condensing.
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
  return { part: smooth(seg(pull, 0, 0.38)), wind: windOnset(seg(pull, c.entrance.windStart, 1), windRamp(c)) };
}

// The winding's onset ramp as a share of the winding (0 to 1): windRampMs on
// the pull's own scale, the share of the winding's span the pull takes in that
// time. The winding starts at full rate without one (a kick the motion review
// measured at 34 px over two frames); with one its rate eases in on a parabola
// that meets the old line at the ramp's end (C1) and is scaled so the winding
// still ends at 1.
export function windRamp(c: CoilConstants = COIL) {
  const { pullMs, windRampMs } = c.deal.timeline;
  return clamp01(windRampMs / Math.max(1, (1 - c.entrance.windStart) * pullMs));
}

export function windOnset(x: number, ramp: number) {
  if (ramp <= 0) return x;
  const k = Math.min(1, ramp);
  const eased = x >= k ? x - k / 2 : (x * x) / (2 * k);
  return eased / (1 - k / 2);
}

// The row's gaps closing and gathering to the middle: ease out (power2.out) over
// condenseMs, which ends where the clock is 0.
export function condenseProgress(clock: EntranceClock, c: CoilConstants = clock.c ?? COIL) {
  const { condenseMs } = c.deal.timeline;
  if (isRested(clock) || condenseMs <= 0) return 1;
  return power2Out(seg(elapsedMs(clock) + condenseMs, 0, condenseMs));
}

// The row curling into the wheel: power2.inOut over curlMs from the clock's 0.
export function curlProgress(clock: EntranceClock, c: CoilConstants = clock.c ?? COIL) {
  const { curlMs } = c.deal.timeline;
  if (isRested(clock) || curlMs <= 0) return elapsedMs(clock) >= 0 ? 1 : 0;
  return power2InOut(seg(elapsedMs(clock), 0, curlMs));
}

// ---------------------------------------------------------------- the wheel

// The wheel's place, from the geometry (its anchor, as shares of the canvas)
// and the lab's nudges: its center and card size in world units, its axis and
// lean. The ring is the band's own (14 cards on one turn), seen from a little
// above, the axis upright.
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
// the wheel by (1 - flatten): 0 is the wheel, 1 returns the frame as is.
export function wheelHelix(frame: HelixFrame, geo: CoilGeometry, flatten: number, c: CoilConstants = COIL): HelixFrame {
  if (flatten >= 1) return frame;
  const wheel = wheelPlacement(geo, c);
  return {
    ...frame,
    axisRad: lerp(wheel.axisRad, frame.axisRad, flatten),
    leanRad: lerp(wheel.leanRad, frame.leanRad, flatten),
    center: lerp3(wheel.center, frame.center, flatten),
    cardWorld: lerp(wheel.cardWorld, frame.cardWorld, flatten),
  };
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
// pulled toward the wheel while it has not flattened, which is the ribbon's end
// state: the flat row curling into it.
export function entranceHelix(rest: HelixFrame, geo: CoilGeometry, clock: EntranceClock, c: CoilConstants = clock.c ?? COIL): HelixFrame {
  if (isRested(clock)) return rest;
  const band = pullHelix(rest, geo, pullProgress(clock, c), c);
  const wheel = wheelHelix(band, geo, flattenProgress(clock, c), c);
  return ribbonHelix(wheel, geo, condenseProgress(clock, c), curlProgress(clock, c));
}

// The copies outside the one band wait hidden and fade in late in the pull.
export function outOfBandAlpha(pull: number) {
  return smooth(seg(pull, 0.35, 0.9));
}

export type EntranceCard = {
  cardCount: number; // N
  // The ribbon's faded edges (lib/coil/ribbon.ts ribbonEdge); absent: no fade.
  edge?: RibbonEdge;
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
// outside it wait hidden and fade in late in the pull; and the ribbon's edges
// fade out until the row has curled. The pose is otherwise the frame's, so the
// ribbon, the wheel, the band and the helix are one object.
export function entrancePose<P extends CardPose>(
  pose: P,
  card: EntranceCard,
  clock: EntranceClock,
  c: CoilConstants = clock.c ?? COIL,
): P {
  if (isRested(clock)) return pose;
  const ring = inRing(pose.u, clock.drift, card.cardCount);
  const shown = ring ? 1 : outOfBandAlpha(pullProgress(clock, c));
  const curl = card.edge ? curlProgress(clock, c) : 1;
  const edge = curl >= 1 || !card.edge ? 1 : lerp(ribbonEdgeAlphaWorld(pose.position[0], card.edge), 1, curl);
  return { ...pose, alpha: pose.alpha * shown * edge };
}

// ---------------------------------------------------------------- the field

// The mask the field opens on: a circle (anchored on the name, by default the
// canvas's top center) that grows (power2.out) until its feathered edge has
// cleared the farthest corner. The field is always drawn (it is the first
// screen's background); the circle lifts the faded patch behind the
// paragraphs (the composite's hush), so radius 0 leaves the patch faded and
// OPEN_ALL lifts it altogether.
export const OPEN_ALL = 1e6;
export type FieldMask = { cx: number; cy: number; radius: number; feather: number };

export function openProgress(clock: EntranceClock, c: CoilConstants = clock.c ?? COIL) {
  if (isRested(clock)) return 1;
  if (isBeforeEntrance(clock)) return 0;
  const { openStartMs } = c.deal.timeline;
  return power2Out(seg(elapsedMs(clock), openStartMs, openStartMs + c.deal.open.ms));
}

export type FieldOrigin = { x: number; y: number };

export function fieldMask(
  clock: EntranceClock,
  canvas: { width: number; height: number },
  c: CoilConstants = clock.c ?? COIL,
  origin: FieldOrigin = { x: canvas.width / 2, y: 0 },
): FieldMask {
  const { reach, featherPx, featherShare } = c.deal.open;
  const p = openProgress(clock, c);
  const { x: cx, y: cy } = origin;
  // The edge widens as the circle opens; at the end its inner edge has just
  // cleared the farthest corner.
  const farthest = Math.hypot(Math.max(cx, canvas.width - cx), Math.max(cy, canvas.height - cy)) * reach;
  const widest = Math.max(featherPx, featherShare * farthest);
  if (p >= 1) return { cx, cy, feather: widest, radius: OPEN_ALL };
  if (p <= 0) return { cx, cy, feather: featherPx, radius: 0 };
  return { cx, cy, feather: featherPx + (widest - featherPx) * p, radius: (farthest + widest) * p };
}

// ---------------------------------------------------------------- the name

// How much of the canvas name shows. `handedOff` is null when no loader lands
// the name (it shows from the first frame), false while the loader still holds
// it, and true from the frame the loader hands it over. The name dissolves into
// the field across the spin-up (nameOutStartMs, nameOutMs after the clock's
// 0) and is gone from then on: the page's own heading shows it again once the
// cards are dealt.
export function entranceNameAlpha(clock: EntranceClock, handedOff: boolean | null, c: CoilConstants = clock.c ?? COIL) {
  if (isRested(clock)) return 0;
  if (handedOff === false) return 0;
  const { nameOutStartMs, nameOutMs } = c.deal.timeline;
  return 1 - smooth(seg(elapsedMs(clock), nameOutStartMs, nameOutStartMs + Math.max(1, nameOutMs)));
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
