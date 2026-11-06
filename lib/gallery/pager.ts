import { GALLERY } from "./constants";

// The phone pager's state and gestures (the lab's stage.ts at ae9b6dd, round
// four). Pages never wrap; a sideways drag turns one, a vertical flick closes
// the modal, a sideways drag never does. Pure.

export interface PagerState { index: number; count: number }
// count: the number of pages changed (a paragraph that did not fit got a page of its own); the page stays where it is, within the new count.
export type PagerAction = { type: "next" } | { type: "prev" } | { type: "goto"; index: number } | { type: "count"; count: number };

const clampPage = (index: number, count: number) => (count <= 0 ? 0 : Math.min(count - 1, Math.max(0, index)));

// The page to draw for a stored index and the current page count. The count can
// shrink between renders (a rotation re-paginates before the reducer's count
// action lands), so anything read during render goes through this.
export const pageAt = clampPage;

export function pagerReducer(state: PagerState, action: PagerAction): PagerState {
  if (action.type === "count") {
    const index = clampPage(state.index, action.count);
    return action.count === state.count && index === state.index ? state : { index, count: action.count };
  }
  const index = action.type === "goto" ? action.index : state.index + (action.type === "next" ? 1 : -1);
  const clamped = clampPage(index, state.count);
  return clamped === state.index ? state : { ...state, index: clamped };
}

export type Axis = "x" | "y";

// A drag picks its axis once it has moved past the slop, and keeps it.
export function axisOf(dx: number, dy: number, slopPx: number = GALLERY.pager.slopPx): Axis | null {
  if (Math.abs(dx) < slopPx && Math.abs(dy) < slopPx) return null;
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

export type Release = "next" | "prev" | "dismiss" | "stay";

export function releaseOf(
  axis: Axis | null,
  dx: number,
  dy: number,
  velocity: number,
  { swipePx = GALLERY.pager.swipePx, flickPx, speed = GALLERY.pager.flickSpeed, minFlickPx = GALLERY.pager.minFlickPx }: { swipePx?: number; flickPx: number; speed?: number; minFlickPx?: number },
): Release {
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
  return (index === 0 && dx > 0) || (index >= count - 1 && dx < 0) ? dx / 3 : dx;
}
