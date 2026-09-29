import { COIL, type CoilConstants } from "./constants";

// Who owns the wheel: the coil (it spins, the page holds still) or the page
// (it scrolls natively). Decided once per gesture and held for all of it,
// trackpad inertia included. Pure: the scene feeds it facts and keeps the
// returned state.
//
// - A gesture is a run of wheel events less than gestureGapMs apart.
// - At its first event the gesture is the coil's when the hero is interactive
//   (ready, not frozen, not unwound, a fine pointer, not a pinch), at least
//   heroVisibleMin in view, and the pointer is inside the helix silhouette
//   (gaps between cards included). Otherwise it is the page's. No hover
//   intent, no page-at-top rule, either direction.
// - A coil gesture passes to the page only when the pointer itself moves
//   outside the silhouette (or the hero stops being interactive); cards or
//   gaps passing under a still pointer never release it.
// - A page gesture never becomes the coil's mid-gesture; the next gesture
//   decides again.

export type WheelOwner = "coil" | "page";

export type CaptureState = {
  readonly owner: WheelOwner | null; // the latest gesture's owner (null before any)
  readonly lastWheelMs: number;
  readonly coilSinceMs: number; // when the coil took the current gesture
};

export type WheelFacts = {
  nowMs: number;
  interactive: boolean;
  heroVisible: number; // 0 to 1, the fraction of the hero's height in view
  insideSilhouette: boolean; // the pointer over the canvas, inside the helix hull
};

export type PointerFacts = { nowMs: number; insideSilhouette: boolean };

export function createCapture(): CaptureState {
  return { owner: null, lastWheelMs: Number.NEGATIVE_INFINITY, coilSinceMs: Number.NaN };
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
  const coil = facts.interactive && facts.heroVisible >= c.capture.heroVisibleMin && facts.insideSilhouette;
  return coil
    ? { owner: "coil", lastWheelMs: nowMs, coilSinceMs: nowMs }
    : { owner: "page", lastWheelMs: nowMs, coilSinceMs: Number.NaN };
}

// A real pointer move (its position changed): outside the silhouette, a live
// coil gesture passes to the page for the rest of that gesture.
export function pointerMoved(state: CaptureState, facts: PointerFacts, c: CoilConstants = COIL): CaptureState {
  if (facts.insideSilhouette || state.owner !== "coil" || !live(state, facts.nowMs, c)) return state;
  return { ...state, owner: "page", coilSinceMs: Number.NaN };
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
