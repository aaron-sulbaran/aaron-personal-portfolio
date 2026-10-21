// The isle's one pill with two states, pure (the hook owns the timers).
//
//   collapsed  the cover, the title and the artist
//   opening    the pointer is on it and the hover-intent delay is running, so a
//              cursor passing over it never flickers it open
//   hover      open while the pointer is on it
//   closing    the pointer left; it stays open through a short grace, so a
//              wobble at its edge does not shut it
//   pinned     a click holds it open: Tracks and the controls stay usable until
//              a click outside or Escape
// Keyboard focus inside it opens it too, like hover, and Escape closes it.

export const PILL_OPEN_MS = 140;
export const PILL_CLOSE_MS = 280;

export type PillPhase = "collapsed" | "opening" | "hover" | "closing" | "pinned";

export interface PillState {
  phase: PillPhase;
  focused: boolean;
}

export const PILL_REST: PillState = { phase: "collapsed", focused: false };

export type PillEvent = "enter" | "leave" | "openElapsed" | "closeElapsed" | "click" | "outside" | "escape" | "focusIn" | "focusOut";

export function pillStep(state: PillState, event: PillEvent): PillState {
  const { phase } = state;
  switch (event) {
    case "enter":
      if (phase === "collapsed") return { ...state, phase: "opening" };
      return phase === "closing" ? { ...state, phase: "hover" } : state;
    case "leave":
      if (phase === "opening") return { ...state, phase: "collapsed" };
      return phase === "hover" ? { ...state, phase: "closing" } : state;
    case "openElapsed":
      return phase === "opening" ? { ...state, phase: "hover" } : state;
    case "closeElapsed":
      return phase === "closing" ? { ...state, phase: "collapsed" } : state;
    case "click":
      // A click pins it; a click on it while pinned lets go (it then closes when the pointer leaves).
      return { ...state, phase: phase === "pinned" ? "hover" : "pinned" };
    case "outside":
    case "escape":
      return PILL_REST;
    case "focusIn":
      return { ...state, focused: true };
    case "focusOut":
      return { ...state, focused: false };
  }
}

// Whether the full player shows.
export const pillOpen = (state: PillState): boolean => state.phase === "hover" || state.phase === "closing" || state.phase === "pinned" || state.focused;

export const pillPinned = (state: PillState): boolean => state.phase === "pinned";

// The timer a phase is waiting on, if any, and how long.
export function pillTimer(phase: PillPhase): { event: "openElapsed" | "closeElapsed"; ms: number } | null {
  if (phase === "opening") return { event: "openElapsed", ms: PILL_OPEN_MS };
  if (phase === "closing") return { event: "closeElapsed", ms: PILL_CLOSE_MS };
  return null;
}
