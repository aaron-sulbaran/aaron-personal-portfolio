// The two-way transition between the full site and the Express lane, as a
// state machine. Pure; components/transition/TransitionLayer.tsx runs it.
//
//   idle      nothing on screen
//   leaving   the mask sweeps over the page being left (from a click)
//   covered   the page is hidden: the route changes under the mask
//   arriving  the new page has rendered; the mask sweeps off it
//
// A browser back or forward (pop) jumps straight to covered: the router has
// already moved, so there is nothing left to sweep over.

export const HOME_PATH = "/";
export const EXPRESS_PATH = "/quick";

export type TransitionPhase = "idle" | "leaving" | "covered" | "arriving";

export interface TransitionState {
  phase: TransitionPhase;
  from: string | null;
  to: string | null;
  via: "push" | "pop" | null;
  reduced: boolean;
}

export type TransitionEvent =
  | { type: "go"; from: string; to: string; reduced: boolean }
  | { type: "pop"; from: string; to: string; reduced: boolean }
  | { type: "covered" }
  | { type: "arrived"; path: string }
  | { type: "revealed" }
  | { type: "abort" };

export const IDLE: TransitionState = { phase: "idle", from: null, to: null, via: null, reduced: false };

export function transitionReducer(state: TransitionState, event: TransitionEvent): TransitionState {
  switch (event.type) {
    case "go":
      if (state.phase !== "idle" || event.from === event.to) return state;
      return { phase: "leaving", from: event.from, to: event.to, via: "push", reduced: event.reduced };
    case "pop":
      if (event.from === event.to) return state;
      return { phase: "covered", from: event.from, to: event.to, via: "pop", reduced: event.reduced };
    case "covered":
      return state.phase === "leaving" ? { ...state, phase: "covered" } : state;
    case "arrived":
      return state.phase === "covered" && event.path === state.to ? { ...state, phase: "arriving" } : state;
    case "revealed":
      return state.phase === "arriving" ? IDLE : state;
    case "abort":
      return IDLE;
  }
}

// Only the home and the Express lane trade places this way; the lab plays it too.
export function isExpressSwap(from: string, to: string): boolean {
  const pair = new Set([from, to]);
  return pair.size === 2 && pair.has(HOME_PATH) && pair.has(EXPRESS_PATH);
}

// Toward the lane the mask enters from the right and leaves to the left, as a
// page turning forward; back to the full site it runs the other way.
export function sweepOf(to: string | null): "forward" | "back" {
  return to === HOME_PATH ? "back" : "forward";
}

export const TRANSITION_MS = {
  cover: 480,
  reveal: 560,
  fadeIn: 180,
  fadeOut: 240,
  // The arriving page gets this long to draw (the Coil's first frame) before the mask lifts anyway.
  settleMax: 700,
  // A route that never arrives: the mask lifts on the page it is on.
  giveUp: 4000,
} as const;
