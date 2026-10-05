import { COIL, type CoilConstants } from "./constants";

// Who owns the wheel: the coil (it spins, the page holds still) or the page
// (it scrolls natively). Decided once per gesture and held for all of it,
// trackpad inertia included. Pure: the scene feeds it facts and keeps the
// returned state.
//
// - A gesture is a run of wheel events less than gestureGapMs apart.
// - At its first event the gesture is the coil's when the hero is interactive
//   (ready, not frozen, not unwound, a fine pointer, not a pinch), at least
//   heroVisibleMin in view, the pointer is on a card picking could pick or in
//   the seam between two (lib/coil/geometry.ts nearCard: where the cursor
//   says "Open me", plus the seam margin), and capture is armed. Otherwise it
//   is the page's: empty background inside the helix included. No hover
//   intent, no page-at-top rule, either direction.
// - Armed means the pointer has really moved since the page last scrolled
//   under it: not armed at load; armed by a move of rearmPx from where the
//   pointer was when it was disarmed (or first seen); disarmed whenever the
//   page scrolls outside a coil gesture (a page gesture, keyboard, scrollbar,
//   an anchor jump). So the page sliding a card under a still pointer never
//   hands the next gesture to the coil, as cards passing under a still
//   pointer never release it.
// - A coil gesture passes to the page only when the pointer itself moves
//   outside the helix silhouette (or the hero stops being interactive); cards
//   or gaps passing under a still pointer, or a move over a gap, never
//   release it.
// - A page gesture never becomes the coil's mid-gesture; the next gesture
//   decides again.

export type WheelOwner = "coil" | "page";

export type CaptureState = {
  readonly owner: WheelOwner | null; // the latest gesture's owner (null before any)
  readonly lastWheelMs: number;
  readonly coilSinceMs: number; // when the coil took the current gesture
  readonly armed: boolean;
  // Where the pointer was (viewport px) when capture was disarmed or first
  // seen; NaN until the pointer is seen.
  readonly markX: number;
  readonly markY: number;
};

export type WheelFacts = {
  nowMs: number;
  interactive: boolean;
  heroVisible: number; // 0 to 1, the fraction of the hero's height in view
  onCard: boolean; // the pointer over the canvas, on a pickable card or within the seam margin of one
};

// A real pointer move to (x, y), viewport px.
export type PointerFacts = { nowMs: number; insideSilhouette: boolean; x: number; y: number };

// The page scrolled with the pointer at (x, y), viewport px (NaN when unseen).
export type ScrollFacts = { nowMs: number; x: number; y: number };

export function createCapture(): CaptureState {
  return {
    owner: null,
    lastWheelMs: Number.NEGATIVE_INFINITY,
    coilSinceMs: Number.NaN,
    armed: false,
    markX: Number.NaN,
    markY: Number.NaN,
  };
}

function live(state: CaptureState, nowMs: number, c: CoilConstants) {
  return state.owner !== null && nowMs - state.lastWheelMs < c.capture.gestureGapMs;
}

// The owner of the gesture still running at nowMs, or null between gestures.
export function gestureOwner(state: CaptureState, nowMs: number, c: CoilConstants = COIL): WheelOwner | null {
  return live(state, nowMs, c) ? state.owner : null;
}

// One wheel event: the next state, whose owner decides this event (the coil's
// events are preventDefault-ed; the page's scroll natively).
export function decideWheel(state: CaptureState, facts: WheelFacts, c: CoilConstants = COIL): CaptureState {
  const { nowMs } = facts;
  if (live(state, nowMs, c)) {
    const owner = state.owner === "coil" && !facts.interactive ? "page" : state.owner;
    return { ...state, owner, lastWheelMs: nowMs };
  }
  const coil = state.armed && facts.interactive && facts.heroVisible >= c.capture.heroVisibleMin && facts.onCard;
  return coil
    ? { ...state, owner: "coil", lastWheelMs: nowMs, coilSinceMs: nowMs }
    : { ...state, owner: "page", lastWheelMs: nowMs, coilSinceMs: Number.NaN };
}

// A real pointer move (its position changed). Unarmed, the first sighting
// marks where the pointer is and a move of rearmPx from the mark arms
// capture. Outside the silhouette, a live coil gesture passes to the page for
// the rest of that gesture.
export function pointerMoved(state: CaptureState, facts: PointerFacts, c: CoilConstants = COIL): CaptureState {
  let next = state;
  if (!state.armed) {
    if (Number.isNaN(state.markX) || Number.isNaN(state.markY)) next = { ...state, markX: facts.x, markY: facts.y };
    else if (Math.hypot(facts.x - state.markX, facts.y - state.markY) >= c.capture.rearmPx) next = { ...state, armed: true };
  }
  if (facts.insideSilhouette || next.owner !== "coil" || !live(next, facts.nowMs, c)) return next;
  return { ...next, owner: "page", coilSinceMs: Number.NaN };
}

// The page scrolled (any cause): outside a coil gesture, capture is disarmed
// and the pointer's position becomes the mark a re-arming move is measured
// from.
export function pageScrolled(state: CaptureState, facts: ScrollFacts, c: CoilConstants = COIL): CaptureState {
  if (gestureOwner(state, facts.nowMs, c) === "coil") return state;
  const same = (a: number, b: number) => a === b || (Number.isNaN(a) && Number.isNaN(b));
  if (!state.armed && same(state.markX, facts.x) && same(state.markY, facts.y)) return state;
  return { ...state, armed: false, markX: facts.x, markY: facts.y };
}

// Page scroll turns the coil during page gestures, keyboard and scrollbar
// scrolling; never during a coil gesture.
export function feedsPageScroll(state: CaptureState, nowMs: number, c: CoilConstants = COIL) {
  return gestureOwner(state, nowMs, c) !== "coil";
}

// The chevron nudge: only while a coil gesture has been held nudgeAfterMs.
export function nudgeShown(state: CaptureState, nowMs: number, c: CoilConstants = COIL) {
  return gestureOwner(state, nowMs, c) === "coil" && nowMs - state.coilSinceMs >= c.capture.nudgeAfterMs;
}

// The fraction of the hero's height inside the viewport, from its top edge in
// viewport px and its height.
export function heroVisibleFraction(top: number, height: number, viewportHeight: number) {
  if (height <= 0) return 0;
  const visible = Math.min(viewportHeight, top + height) - Math.max(0, top);
  return Math.min(1, Math.max(0, visible / height));
}
