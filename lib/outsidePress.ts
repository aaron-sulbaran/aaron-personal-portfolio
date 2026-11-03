// When a press on a modal's backdrop closes it. A modal's backdrop is the layer
// that holds its panel; a press is a pointer going down and coming up. It
// closes only when the pointer went down on the backdrop and came up on it, and
// did not travel further than a tap (a finger that moved more is scrolling the
// backdrop or swiping, and a drag is not a click). A press that begins in the
// panel never closes it, whatever it drags across and wherever it ends: that is
// a text selection, a slider, the card pager's swipe. Pure.
export const OUTSIDE_TAP_PX = 10;

export interface Press {
  // The pointer was over the backdrop itself, not the panel or anything in it.
  onBackdrop: boolean;
  x: number;
  y: number;
}

export function closesOnPress(start: Press | null, end: Press, tapPx: number = OUTSIDE_TAP_PX): boolean {
  if (!start || !start.onBackdrop || !end.onBackdrop) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) <= tapPx;
}
