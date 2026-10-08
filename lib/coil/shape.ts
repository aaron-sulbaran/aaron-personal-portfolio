import { COIL, type CoilConstants } from "./constants";
import { outOfBandAlpha, pullCurve } from "./entrance";
import type { CardPose } from "./geometry";
// The Coil and Band toggle's pure half (lab log, "The Coil and Band
// toggle"). The band is the entrance's pose at pull 0 (entrance.ts,
// pullHelix). One value, `progress`, runs linearly in time between 0 (the
// band) and 1 (the coil) over COIL.toggle.durationMs, the pull's own length;
// the pose reads it through the entrance's pull curve, so band to coil
// replays the entrance's last movement and coil to band plays it backward. A
// press mid-switch turns around from where it is.
export type CoilShape = "coil" | "band";
export type ShapeClock = { progress: number };
export const shapeTarget = (shape: CoilShape): 0 | 1 => (shape === "band" ? 0 : 1);
// A scene that mounts in a shape starts there, as a rebuild starts at rest.
export function createShapeClock(shape: CoilShape): ShapeClock {
  return { progress: shapeTarget(shape) };
}
// Toward the shape by dtS seconds; no time (a still frame, a stopped scene) holds it.
export function stepShapeClock(clock: ShapeClock, shape: CoilShape, dtS: number, c: CoilConstants = COIL): ShapeClock {
  const target = shapeTarget(shape);
  const step = (Math.max(0, dtS) * 1000) / c.toggle.durationMs;
  clock.progress = clock.progress < target ? Math.min(target, clock.progress + step) : Math.max(target, clock.progress - step);
  return clock;
}
// Mid-switch the seam's two ends sit apart, so the scene holds the strand (scene/shape.ts).
export function isSwitching(clock: ShapeClock) {
  return clock.progress > 0 && clock.progress < 1;
}
export function shapePull(clock: ShapeClock, c: CoilConstants = COIL) {
  if (clock.progress >= 1) return 1;
  if (clock.progress <= 0) return 0;
  return pullCurve(c)(clock.progress);
}
// The band shows one copy of each card: the one in the window (-N/2, N/2]
// around the strand's center (u is the slot's window position), which is
// exactly the copy the unwind latches (unwind.ts latchPositions, half up), so
// the egg and a flight fly the card the band shows. Every copy is drawn when
// the strand has two spare slots (M >= N + 2; 14 cards give M >= 16).
export function bandCopy(u: number, cardCount: number) {
  return u > -cardCount / 2 && u <= cardCount / 2;
}
// Card level: toward and in the band, the other copies fade as in the entrance's pull.
export function shapePose<P extends CardPose>(pose: P, cardCount: number, pull: number): P {
  if (pull >= 1 || bandCopy(pose.u, cardCount)) return pose;
  return { ...pose, alpha: pose.alpha * outOfBandAlpha(pull) };
}
