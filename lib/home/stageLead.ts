import { COIL, type CoilConstants } from "@/lib/coil/constants";

// How far the Coil's sticky stage reaches up page 1 (slice 4d). The stage is as
// tall as the cards section's frame and its rail runs from page 1's foot to the
// frame's bottom; before the click the stage sits where the rail starts, and
// that must be high enough that the ribbon, and the wheel it curls into, fit in
// it above the slot's middle. The reach is how far above the slot's middle the
// stage starts: the wheel's ring (its radius, with the lean's thickness and a
// little room) or the ribbon's own card, whichever is taller. The lead is then
// the distance from there down to the cards section's top, which is the length of
// the stage's sticky range.

// How far a ring reaches past the circle its diameter names: the cards' own
// half thickness and the lean (measured against the wheel as the scene draws it).
const RING_REACH = 1.28;
// Room above the ribbon's card, px, however small the stage.
const ROW_ROOM_PX = 16;

export type LeadFacts = {
  sectionTop: number; // the cards section's top, any one frame of reference
  slotCenter: number; // the ribbon slot's middle, the same frame
  frameHeight: number; // the stage's height (the cards section's frame)
  canvasWidth: number; // the stage's width, for the ribbon's card
};

export function stageReachAbove(frameHeight: number, canvasWidth: number, c: CoilConstants = COIL): number {
  const w = c.deal.wheel;
  const ring = 0.5 * frameHeight * w.diameterOfHeight * w.scale * RING_REACH;
  const rb = c.deal.ribbon;
  const card = canvasWidth < rb.phoneBelowPx ? rb.cardHeightPhonePx : rb.cardHeightPx;
  return Math.max(ring, card / 2 + ROW_ROOM_PX);
}

export function stageLeadPx(f: LeadFacts, c: CoilConstants = COIL): number {
  const top = f.slotCenter - stageReachAbove(f.frameHeight, f.canvasWidth, c);
  return Math.max(0, f.sectionTop - top);
}
