// The quick page's checkpoints follow the reader, both ways: the mark is where
// the reading line sits in the track now, and a checkpoint is lit while the drawn
// line is at or past it, so scrolling back up un-lights the ones below the line
// again. (The tile pictures are the one-way part, lib/quick/reveal.) Depths and
// anchors are fractions of the track's height, 0 at its top. Pure.

export interface Anchor { key: string; at: number }

export interface CheckpointState { mark: number; lit: ReadonlySet<string> }

export const emptyCheckpoints = (): CheckpointState => ({ mark: 0, lit: new Set() });

const clamp01 = (n: number) => (Number.isNaN(n) ? 0 : Math.min(1, Math.max(0, n)));

// tops are px from the track's top; an anchor past the track's foot is clamped to it.
export function anchorsFrom(tops: readonly { key: string; y: number }[], height: number): Anchor[] {
  return tops.map(({ key, y }) => ({ key, at: height > 0 ? clamp01(y / height) : 0 }));
}

// How deep the reading line (a share of the viewport's height, from its top) sits in the
// track. At the page's foot the line may never reach the track's end, so the end counts as 1.
export function readingDepth({ trackTop, trackHeight, viewportHeight, line, atEnd }: {
  trackTop: number;
  trackHeight: number;
  viewportHeight: number;
  line: number;
  atEnd: boolean;
}): number {
  if (atEnd) return 1;
  if (trackHeight <= 0) return 0;
  return clamp01((viewportHeight * line - trackTop) / trackHeight);
}

// Moves the mark to where the reading line is now, up or down the track.
export function moveMark(state: CheckpointState, incoming: number): { state: CheckpointState; moved: boolean } {
  const mark = clamp01(incoming);
  return mark === state.mark ? { state, moved: false } : { state: { ...state, mark }, moved: true };
}

// A small tolerance, so a chase that eases out just short of a node still reaches it.
const REACH = 0.002;

// The checkpoints that are lit with the drawn line at position: every anchor at or
// above it. lit and unlit are what changed since the last call.
export function syncLit(state: CheckpointState, anchors: readonly Anchor[], position: number): { state: CheckpointState; lit: string[]; unlit: string[] } {
  const reached = new Set(anchors.filter((anchor) => anchor.at <= position + REACH).map((anchor) => anchor.key));
  const lit = [...reached].filter((key) => !state.lit.has(key));
  const unlit = [...state.lit].filter((key) => !reached.has(key));
  if (!lit.length && !unlit.length) return { state, lit, unlit };
  return { state: { ...state, lit: reached }, lit, unlit };
}

export function lightAll(state: CheckpointState, anchors: readonly Anchor[]): CheckpointState {
  return { mark: 1, lit: new Set([...state.lit, ...anchors.map((anchor) => anchor.key)]) };
}
