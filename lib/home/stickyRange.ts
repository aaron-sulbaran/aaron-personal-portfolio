// How far through the sticky stage's range the reader is. The stage (the
// Coil's canvas) sticks when page 1's foot reaches the top of the screen and
// lets go when the cards section's top does, so its range is the rail's
// height less its own: 0 where it sticks, 1 where it lets go, below 0 before it
// has stuck. With no range (the stage is just the section: a phone's flow, or
// after the deal) it is how far the section has come up the screen instead.
// Pure; the director reads the DOM (components/home/useDealDirector.ts).

export type StickyFrame = {
  railTop: number; // the rail's top edge in the viewport, px
  range: number; // the rail's height less the stage's, px
  sectionTop: number; // the cards section's top edge in the viewport, px
  viewportHeight: number;
};

export function stickyProgress(frame: StickyFrame): number {
  if (frame.range > 1) return -frame.railTop / frame.range;
  return (frame.viewportHeight - frame.sectionTop) / Math.max(1, frame.viewportHeight);
}

// The stage is out of the viewport altogether.
export function stageGone(stageTop: number, stageBottom: number, viewportHeight: number): boolean {
  return stageBottom <= 0 || stageTop >= viewportHeight;
}
