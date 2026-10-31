// One press's drag across the Coil, locked to its first axis: the scene's
// drag-to-spin reads the sideways travel of a press that went sideways, and
// its speed at the release, from pointer events of any kind (a finger, a pen,
// a mouse in a phone layout or a tablet's trackpad). Pure: the scene feeds it
// positions and times and keeps the returned track.
//
// - A press moves nothing until it has travelled minimumPx from where it went
//   down; the axis is then the larger of its two travels so far, and holds for
//   the rest of the press (a swipe that starts sideways stays a spin, one that
//   starts upright stays the page's).
// - Each move after the lock gives its sideways step in px; a press locked
//   upright gives none.
// - The release speed is the sideways travel over the last windowMs of moves,
//   divided by the time from the first of them to the release, so a finger
//   that stopped before it let go throws less, and one held still for longer
//   than stillMs throws nothing.

export type DragAxis = "x" | "y" | null;

export type DragTrack = {
  readonly startX: number;
  readonly startY: number;
  readonly lastX: number;
  readonly lastY: number;
  readonly axis: DragAxis;
  // Recent moves, oldest first: time (ms) and x (px).
  readonly samples: readonly { readonly t: number; readonly x: number }[];
};

export const DRAG_TRACK = {
  minimumPx: 4,
  windowMs: 100,
  stillMs: 300,
} as const;

export function pressDrag(x: number, y: number, nowMs: number): DragTrack {
  return { startX: x, startY: y, lastX: x, lastY: y, axis: null, samples: [{ t: nowMs, x }] };
}

// One move: the next track, and the sideways step this move contributes (0
// before the lock and on an upright press).
export function moveDrag(track: DragTrack, x: number, y: number, nowMs: number, minimumPx: number = DRAG_TRACK.minimumPx): { track: DragTrack; dx: number } {
  let axis = track.axis;
  if (axis === null) {
    const travelX = Math.abs(x - track.startX);
    const travelY = Math.abs(y - track.startY);
    if (Math.max(travelX, travelY) >= minimumPx) axis = travelX > travelY ? "x" : "y";
  }
  const dx = axis === "x" ? x - track.lastX : 0;
  const recent = track.samples.filter((sample) => nowMs - sample.t <= DRAG_TRACK.windowMs);
  return { track: { ...track, lastX: x, lastY: y, axis, samples: [...recent, { t: nowMs, x }] }, dx };
}

// The sideways speed at the release, px per second (0 unless locked sideways).
export function releaseVelocity(track: DragTrack, nowMs: number): number {
  if (track.axis !== "x" || track.samples.length < 2) return 0;
  const last = track.samples[track.samples.length - 1];
  if (nowMs - last.t > DRAG_TRACK.stillMs) return 0;
  const inWindow = track.samples.filter((sample) => last.t - sample.t <= DRAG_TRACK.windowMs);
  const first = inWindow[0];
  const elapsed = Math.max(1, nowMs - first.t);
  return ((last.x - first.x) / elapsed) * 1000;
}
