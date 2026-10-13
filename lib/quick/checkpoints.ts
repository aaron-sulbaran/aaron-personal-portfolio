import { highWater } from "@/lib/sections/highWater";

// The quick page's checkpoints, one-way per page load (the lib/sections/highWater
// rule): the reading line's depth into the track only rises, and a checkpoint the
// drawn line has reached stays lit when the reader scrolls back up. Depths and
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

export function raiseMark(state: CheckpointState, incoming: number): { state: CheckpointState; moved: boolean } {
  const mark = highWater(state.mark, incoming);
  return { state: mark.moved ? { ...state, mark: mark.reached } : state, moved: mark.moved };
}

// A small tolerance, so a chase that eases out just short of a node still reaches it.
const REACH = 0.002;

// The checkpoints the drawn line, now at position, reaches for the first time.
export function lightUpTo(state: CheckpointState, anchors: readonly Anchor[], position: number): { state: CheckpointState; lit: string[] } {
  const lit = anchors.filter((anchor) => anchor.at <= position + REACH && !state.lit.has(anchor.key)).map((anchor) => anchor.key);
  if (!lit.length) return { state, lit };
  return { state: { ...state, lit: new Set([...state.lit, ...lit]) }, lit };
}

export function lightAll(state: CheckpointState, anchors: readonly Anchor[]): CheckpointState {
  return { mark: 1, lit: new Set([...state.lit, ...anchors.map((anchor) => anchor.key)]) };
}
