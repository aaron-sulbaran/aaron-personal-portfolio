// The phone stage's arithmetic: one photo at a time, tap or swipe to move,
// and one gentle auto-advance pass that stops on the last photo or the moment
// the reader touches it (modal-gallery.md, "Phone"). Pure, so the tests read
// it and the component only wires events to actions.

export interface StageState {
  index: number;
  count: number;
  auto: boolean; // the auto-advance pass is still running
}

export type StageAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; index: number }
  | { type: "tick" }
  | { type: "touch" }
  | { type: "reset"; count: number; auto: boolean };

export function wrap(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

// Auto-advance runs only with a positive interval, more than one photo, and
// no reduced motion.
export function autoAdvanceMs(seconds: number, count: number, reduced: boolean): number | null {
  if (reduced || count < 2 || !(seconds > 0)) return null;
  return Math.round(seconds * 1000);
}

export function initialStage(count: number, auto: boolean): StageState {
  return { index: 0, count, auto: auto && count > 1 };
}

export function stageReducer(state: StageState, action: StageAction): StageState {
  switch (action.type) {
    case "reset":
      return initialStage(action.count, action.auto);
    case "next":
      return { ...state, index: wrap(state.index + 1, state.count), auto: false };
    case "prev":
      return { ...state, index: wrap(state.index - 1, state.count), auto: false };
    case "goto":
      return { ...state, index: wrap(action.index, state.count), auto: false };
    case "touch":
      return state.auto ? { ...state, auto: false } : state;
    case "tick": {
      if (!state.auto) return state;
      if (state.index >= state.count - 1) return { ...state, auto: false };
      const index = state.index + 1;
      return { ...state, index, auto: index < state.count - 1 };
    }
  }
}

export type Gesture = "next" | "prev" | "tap" | null;

// A pointer's travel from down to up: a mostly sideways move past the
// threshold is a swipe (left moves forward), a small one is a tap, and a
// mostly vertical one is the page scrolling, which the stage leaves alone.
export function gestureOf(dx: number, dy: number, swipePx = 40, tapPx = 10): Gesture {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax <= tapPx && ay <= tapPx) return "tap";
  if (ax >= swipePx && ax > ay) return dx < 0 ? "next" : "prev";
  return null;
}
