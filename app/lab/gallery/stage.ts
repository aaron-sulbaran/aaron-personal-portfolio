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

// Round four's pager: the same state, but it never wraps (the arrows stop at
// either end) and a swipe past an end springs back.
export const clampPage = (index: number, count: number) => (count <= 0 ? 0 : Math.min(count - 1, Math.max(0, index)));

export function pagerReducer(state: StageState, action: StageAction): StageState {
  switch (action.type) {
    case "next":
      return { ...state, index: clampPage(state.index + 1, state.count), auto: false };
    case "prev":
      return { ...state, index: clampPage(state.index - 1, state.count), auto: false };
    case "goto":
      return { ...state, index: clampPage(action.index, state.count), auto: false };
    default:
      return stageReducer(state, action);
  }
}

export type Axis = "x" | "y";

// A drag picks its axis once it has moved past the slop, and keeps it.
export function axisOf(dx: number, dy: number, slopPx = 8): Axis | null {
  if (Math.abs(dx) < slopPx && Math.abs(dy) < slopPx) return null;
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

export type Release = "next" | "prev" | "dismiss" | "stay";

export interface ReleaseOptions {
  swipePx?: number; // a sideways drag this far turns the page
  flickPx: number; // a vertical drag this far closes the modal
  speed?: number; // px per ms: a quicker, shorter flick also counts
  minFlickPx?: number; // the shortest quick flick that counts
}

// Where a drag ends up: sideways turns the page (left goes forward), up or
// down past the flick distance (or quick enough) closes the modal, anything
// less springs back. A sideways drag never closes.
export function releaseOf(axis: Axis | null, dx: number, dy: number, velocity: number, { swipePx = 48, flickPx, speed = 0.6, minFlickPx = 24 }: ReleaseOptions): Release {
  if (axis === "x") {
    const quick = Math.abs(velocity) >= speed && Math.abs(dx) >= minFlickPx;
    if (dx <= -swipePx || (quick && dx < 0)) return "next";
    if (dx >= swipePx || (quick && dx > 0)) return "prev";
    return "stay";
  }
  if (axis === "y") {
    const quick = Math.abs(velocity) >= speed && Math.abs(dy) >= minFlickPx;
    return Math.abs(dy) >= flickPx || quick ? "dismiss" : "stay";
  }
  return "stay";
}

// Past either end the track follows the finger at a third of its travel.
export function rubberBand(dx: number, index: number, count: number) {
  const pastStart = index === 0 && dx > 0;
  const pastEnd = index >= count - 1 && dx < 0;
  return pastStart || pastEnd ? dx / 3 : dx;
}
