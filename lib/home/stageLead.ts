import { COIL, type CoilConstants } from "@/lib/coil/constants";
import { wheelBasisPx } from "@/lib/coil/geometry";

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
  phone?: boolean; // the frame is page 2's phone band (its wheel keeps its tuned size)
};

export function stageReachAbove(frameHeight: number, canvasWidth: number, c: CoilConstants = COIL, phone = false): number {
  const w = c.deal.wheel;
  const ring = 0.5 * wheelBasisPx(frameHeight, phone, c) * w.diameterOfHeight * w.scale * RING_REACH;
  const rb = c.deal.ribbon;
  const card = canvasWidth < rb.phoneBelowPx ? rb.cardHeightPhonePx : rb.cardHeightPx;
  return Math.max(ring, card / 2 + ROW_ROOM_PX);
}

export function stageLeadPx(f: LeadFacts, c: CoilConstants = COIL): number {
  const top = f.slotCenter - stageReachAbove(f.frameHeight, f.canvasWidth, c, f.phone);
  return Math.max(0, f.sectionTop - top);
}

// Where "Deal me in" and its line stick while the stage is stuck: how far down the
// screen the top of the button's block is, px. The stuck ribbon's middle is the
// stage's reach down the screen (its slot's middle when the stage sticks), its cards
// are the slot's height, and the button sits the foot's gap below them: the place
// the button has at the instant the stage sticks. Pinned there it never rises into
// the ribbon as the reader scrolls on to the point where a scroll starts the deal.
export type CtaFacts = {
  frameHeight: number;
  canvasWidth: number;
  slotHeight: number; // the ribbon slot's height (its cards')
  gapPx: number; // the foot's gap between the slot and the button
  phone?: boolean;
};

export function ctaStickPx(f: CtaFacts, c: CoilConstants = COIL): number {
  return stageReachAbove(f.frameHeight, f.canvasWidth, c, f.phone) + f.slotHeight / 2 + f.gapPx;
}
