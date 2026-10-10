// A parked flown card rides its slot in a scrolling modal. The main thread can
// only redraw it a frame after the compositor has moved the slot, so the card
// lagged. Instead the compositor moves the card too: a scroll-driven animation
// on the card's layer translates it by minus the modal's scroll offset, in the
// same frame as the slot. The card is drawn where the slot was at the scroll
// offset of the draw, so the layer carries that offset back: the card sits at
// drawnScroll - scrollNow from where it was drawn, which is the slot's own move.

// The animation's whole scroll range, in px: a keyframe distance equal to it
// makes the translation exactly the scroll offset, whatever the modal's height.
export const FOLLOW_RANGE_PX = 100_000;

export const carryTransform = (drawnScroll: number) => `translateY(${drawnScroll}px)`;

// How far the card sits from where it was drawn once the modal has scrolled on.
export const followOffset = (drawnScroll: number, scrollNow: number) => drawnScroll - scrollNow;

// The follow runs only where scroll-driven animations do and the layer's
// animation really took the modal's timeline; otherwise the card is redrawn on
// the main thread alone, a frame behind.
export const followable = (supported: boolean, attached: boolean) => supported && attached;
