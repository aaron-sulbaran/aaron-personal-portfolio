// One press's drag across the Coil, locked to an axis: the scene's drag-to-spin
// reads the travel of a press along its axis, and its speed at the release,
// from pointer events of any kind (a finger, a pen, a mouse in a phone layout
// or a tablet's trackpad). Pure: the scene feeds it positions and times and
// keeps the returned track.
//
// - A press moves nothing until it has travelled minimumPx from where it went
//   down.
// - A press on the band (it went down on a card) is the band's whichever way it
//   goes: its axis is the larger of its two travels at that point and holds for
//   the rest of the press, upright included.
// - Any other press can only lock sideways, since the browser keeps its upright
//   travel for the page (and cancels the press when it takes the pan). It locks
//   as soon as its sideways travel is the larger, however it started: a thumb's
//   arc begins a little upright and then goes across, and that is a spin.
// - Each move after the lock gives its step along the axis in px.
// - The release speed is the travel along the axis over the last windowMs of
//   moves, divided by the time from the first of them to the release, so a
//   finger that stopped before it let go throws less, and one held still for
//   longer than stillMs throws nothing.

export type DragAxis = "x" | "y" | null;

export type DragTrack = {
  readonly startX: number;
  readonly startY: number;
  readonly lastX: number;
  readonly lastY: number;
  readonly axis: DragAxis;
  // The press went down on a card: its upright travel is the band's too.
  readonly onBand: boolean;
  // Recent moves, oldest first: time (ms) and position (px).
  readonly samples: readonly { readonly t: number; readonly x: number; readonly y: number }[];
};

export const DRAG_TRACK = {
  minimumPx: 4,
  windowMs: 100,
  stillMs: 300,
} as const;

export function pressDrag(x: number, y: number, nowMs: number, onBand = false): DragTrack {
  return { startX: x, startY: y, lastX: x, lastY: y, axis: null, onBand, samples: [{ t: nowMs, x, y }] };
}

// One move: the next track, and the step this move contributes along the axis
// (dx on a sideways press, dy on an upright one; both 0 before the lock).
export function moveDrag(track: DragTrack, x: number, y: number, nowMs: number, minimumPx: number = DRAG_TRACK.minimumPx): { track: DragTrack; dx: number; dy: number } {
  let axis = track.axis;
  if (axis === null) {
    const travelX = Math.abs(x - track.startX);
    const travelY = Math.abs(y - track.startY);
    if (Math.max(travelX, travelY) >= minimumPx) {
      if (travelX > travelY) axis = "x";
      else if (track.onBand) axis = "y";
    }
  }
  const dx = axis === "x" ? x - track.lastX : 0;
  const dy = axis === "y" ? y - track.lastY : 0;
  const recent = track.samples.filter((sample) => nowMs - sample.t <= DRAG_TRACK.windowMs);
  return { track: { ...track, lastX: x, lastY: y, axis, samples: [...recent, { t: nowMs, x, y }] }, dx, dy };
}

// The speed along the axis at the release, px per second (0 with no lock).
export function releaseVelocity(track: DragTrack, nowMs: number): number {
  const axis = track.axis;
  if (axis === null || track.samples.length < 2) return 0;
  const last = track.samples[track.samples.length - 1];
  if (nowMs - last.t > DRAG_TRACK.stillMs) return 0;
  const inWindow = track.samples.filter((sample) => last.t - sample.t <= DRAG_TRACK.windowMs);
  const first = inWindow[0];
  const elapsed = Math.max(1, nowMs - first.t);
  return ((last[axis] - first[axis]) / elapsed) * 1000;
}
