import { PILL_CLOSE_MS, PILL_IDLE_MS, PILL_OPEN_MS } from "./constants";

// The isle's one pill with two states, pure (the hook owns the timers).
//
//   collapsed  the cover, the title and the artist
//   opening    the pointer is on it and the hover-intent delay is running, so a
//              cursor passing over it never flickers it open
//   hover      open while the pointer is on it
//   closing    the pointer left; it stays open through a short grace, so a
//              wobble at its edge does not shut it
//   pinned     a click anywhere on it holds it open past the pointer leaving,
//              so Tracks and the controls stay usable
//
// Open, by hover or by a pin, it also folds back on its own once nothing has
// touched it for PILL_IDLE_MS (the pointer moving, a click, the wheel or a key
// inside it), however it was opened. Two things hold it open past that:
// keyboard focus inside it, since a keyboard visitor closes it with Escape and
// is never timed out, and a seek being dragged. Escape and a press outside
// close it at once.
//
// A pill folded by the idle wait with the pointer still resting on it is not
// dead under the cursor: the next movement on it opens it again (`rearm`).
// Folded by Escape, a press outside or the pointer leaving, it waits for the
// pointer to come back.

export type PillPhase = "collapsed" | "opening" | "hover" | "closing" | "pinned";

export interface PillState {
  phase: PillPhase;
  focused: boolean;
  dragging: boolean; // a seek is being dragged
  rearm: boolean; // folded by the idle wait with the pointer still on it
}

export const PILL_REST: PillState = { phase: "collapsed", focused: false, dragging: false, rearm: false };

export type PillEvent =
  | "enter"
  | "leave"
  | "move"
  | "openElapsed"
  | "closeElapsed"
  | "idleElapsed"
  | "click"
  | "outside"
  | "escape"
  | "focusIn"
  | "focusOut"
  | "dragStart"
  | "dragEnd";

export function pillStep(state: PillState, event: PillEvent): PillState {
  const { phase } = state;
  switch (event) {
    case "enter":
      if (phase === "collapsed") return { ...state, phase: "opening", rearm: false };
      return phase === "closing" ? { ...state, phase: "hover" } : state;
    case "move":
      return phase === "collapsed" && state.rearm ? { ...state, phase: "opening", rearm: false } : state;
    case "leave":
      if (phase === "opening") return { ...state, phase: "collapsed" };
      if (phase === "collapsed") return state.rearm ? { ...state, rearm: false } : state;
      // A seek dragged out of the pill is still the visitor's hand on it.
      return phase === "hover" && !state.dragging ? { ...state, phase: "closing" } : state;
    case "openElapsed":
      return phase === "opening" ? { ...state, phase: "hover" } : state;
    case "closeElapsed":
      return phase === "closing" ? { ...state, phase: "collapsed" } : state;
    case "idleElapsed":
      return (phase === "hover" || phase === "pinned") && !state.focused && !state.dragging ? { ...state, phase: "collapsed", rearm: true } : state;
    case "click":
      // A click pins it, and a click on its controls once it is pinned keeps it so; only outside, Escape or the idle fold lets go.
      return { ...state, phase: "pinned", rearm: false };
    case "outside":
    case "escape":
      return PILL_REST;
    case "focusIn":
      return { ...state, focused: true };
    case "focusOut":
      return { ...state, focused: false };
    case "dragStart":
      return { ...state, dragging: true };
    case "dragEnd":
      return { ...state, dragging: false };
  }
}

// Whether the full player shows.
export const pillOpen = (state: PillState): boolean => state.phase === "hover" || state.phase === "closing" || state.phase === "pinned" || state.focused;

export const pillPinned = (state: PillState): boolean => state.phase === "pinned";

export type PillTimerEvent = "openElapsed" | "closeElapsed" | "idleElapsed";

// The timer a state is waiting on, if any, and how long. The idle one is the
// longest the state may sit untouched; the hook re-arms it from the last touch.
export function pillTimer(state: PillState): { event: PillTimerEvent; ms: number } | null {
  if (state.phase === "opening") return { event: "openElapsed", ms: PILL_OPEN_MS };
  if (state.phase === "closing") return { event: "closeElapsed", ms: PILL_CLOSE_MS };
  if ((state.phase === "hover" || state.phase === "pinned") && !state.focused && !state.dragging) return { event: "idleElapsed", ms: PILL_IDLE_MS };
  return null;
}

// How much of the idle wait is left, from the clock now and the last touch.
export const idleLeft = (now: number, lastTouch: number, ms: number = PILL_IDLE_MS): number => Math.max(0, lastTouch + ms - now);
