/* eslint-disable @typescript-eslint/no-unused-vars -- identity seams keep their final signatures until slices 4 and 5 fill them in */
import { COIL, type CoilConstants } from "./constants";
import type { CardPose, CoilGeometry, HelixFrame } from "./geometry";

// The entrance seam: cards shutter out of a center stack into one closed band,
// hold a beat, then two hands pull it open (the seam parts along the axis
// first, then the band winds into the coil). Slice 4 fills these in from the
// lab (1084-1086, 1156-1166, 1219-1237); until then both modifiers are the
// identity, so the scene renders the rested coil from its first frame.

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

// Frame level: the band's radius, rise, card size and lean pulled toward the
// rested helix. Identity until slice 4.
export function entranceHelix(
  rest: HelixFrame,
  _geo: CoilGeometry,
  _clock: EntranceClock,
  _c?: CoilConstants,
): HelixFrame {
  return rest;
}

export type EntranceCard = {
  strandPosition: number; // absolute position on the strand
  cardCount: number; // N
};

// Card level: the stack, the shutter into the band, and the fade of copies
// outside the band. Identity until slice 4.
export function entrancePose<P extends CardPose>(
  pose: P,
  _card: EntranceCard,
  _geo: CoilGeometry,
  _clock: EntranceClock,
  _c?: CoilConstants,
): P {
  return pose;
}
