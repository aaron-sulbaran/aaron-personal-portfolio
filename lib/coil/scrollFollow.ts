import type { Quad } from "./geometry";
import type { Rect } from "./flight";

// A parked flown card rides its slot in a scrolling modal. Its layer moves
// into the dialog's scrolling content, so the browser carries the card with
// the slot in the frame it scrolls, in every browser; nothing is redrawn to
// keep up. The card is drawn in viewport coordinates at one scroll offset, so
// the layer carries that offset back: drawn at the slot's viewport top with
// the dialog scrolled by s, it sits s down the content, where the slot is.

export const carryTransform = (drawnScroll: number) => `translateY(${drawnScroll}px)`;

const round = (px: number) => Math.round(px * 100) / 100;

// The slot's place in the dialog's content, which scrolling leaves alone: a
// parked card is drawn again when it moves (a resize, a reflow) or the scene's
// layout does. A card whose last draw ran off the viewport was cut by the
// flown canvas (it covers the viewport alone), so it is drawn again on every
// scroll until a draw shows it whole.
export function parkKey(rect: Rect, scroll: number, stamp: string, clipped: boolean) {
  const at = [round(rect.left), round(rect.top + scroll), round(rect.width), round(rect.height), stamp];
  return (clipped ? [...at, round(scroll)] : at).join(",");
}

export const wholeIn = (quad: Quad, width: number, height: number) => quad.every((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height);
