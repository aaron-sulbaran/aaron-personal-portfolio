/* eslint-disable @typescript-eslint/no-unused-vars -- identity seams keep their final signatures until slices 4 and 5 fill them in */
import type { CoilConstants } from "./constants";
import type { CardPose, Vec2 } from "./geometry";

// The unwind egg seam: double-click open hero space and the helix unwinds in
// place into a list inside the hero (580ms per card on the site ease, 8ms
// stagger along the strand); "Coil" or Esc winds it back. Slice 5 fills this in
// from the lab (1088-1097, 1258-1286, 1318-1325); until then the progress is
// always 0 and the pose modifier is the identity.

export type UnwindState = {
  on: boolean;
  from: number; // progress when the last toggle happened
  startMs: number;
  // Each tile's latched copy (absolute strand position), fixed while unwound.
  latched: readonly number[] | null;
};

export function createUnwind(): UnwindState {
  return { on: false, from: 0, startMs: 0, latched: null };
}

// The copy of each of the N tiles nearest the strand's center for conveyor
// offset X: the instance that flies to its row when the helix unwinds.
export function latchPositions(offset: number, cardCount: number): number[] {
  return Array.from({ length: cardCount }, (_, i) => i + cardCount * Math.round((-offset - i) / cardCount));
}

// Overall list progress, 0 coiled to 1 unwound. Always 0 until slice 5.
export function unwindProgress(_state: UnwindState, _nowMs: number, _c?: CoilConstants): number {
  return 0;
}

export type UnwindTarget = { center: Vec2; heightPx: number } | null;

// A latched card's pose between the coil and its row. Identity until slice 5.
export function unwindPose<P extends CardPose>(
  pose: P,
  _tile: number,
  _state: UnwindState,
  _nowMs: number,
  _target: UnwindTarget,
  _c?: CoilConstants,
): P {
  return pose;
}
