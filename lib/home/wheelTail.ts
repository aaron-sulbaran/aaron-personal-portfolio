import { COIL, type CoilConstants } from "@/lib/coil/constants";

// Is the wheel the reader's own, or the tail of a scroll that is already over?
// A trackpad's momentum goes on sending wheel events for a second or two after
// the fingers lift, each a little smaller than the last; a mouse wheel kept
// turning, or a fresh swipe, does not die away. The cutscene's lock
// (lib/home/dealLockRules.ts) holds a tail that is still arriving when the Coil
// is unfurled, so the fling that started the deal cannot spin the cards, and lets
// a reader's own scroll through. Pure and tested; the wheel carries no phase, so
// this reads the stream's pace.
//
// The stream, newest last, is read over windowMs. The pace of its newest slice
// (recentMs) is set against the pace of the rest: a tail is slower than it was a
// moment ago, a reader's scroll is not.
//   - reversed: the latest event runs against the one before it. A tail never
//     turns round.
//   - steady or rising: the newest slice's pace is at least steadyRatio of the rest's,
//     and fast enough (minPxPerMs) not to be the last few pixels of a tail.
// A stream with no rest yet (it began less than recentMs ago) is rising by
// definition, and counts once it is fast enough.
//
// An event is the travel since the event before it, so a pace spreads each event
// over that gap (at least a frame, at most MAX_SPREAD_MS): an event Chrome
// coalesced from two frames, or the run a long frame flushed at once, moves a
// pace by what it carried and no more, and a mouse wheel's notches read as the
// even turning they are.

const FRAME_MS = 16;
const MAX_SPREAD_MS = 250;

export type WheelSample = {
  t: number; // ms
  px: number; // the event's travel, down positive
};

// px per ms over the slice from `fromMs` to `toMs` before nowMs.
function paceBetween(samples: readonly WheelSample[], nowMs: number, fromMs: number, toMs: number): number {
  const newest = nowMs - fromMs;
  const oldest = nowMs - toMs;
  let travel = 0;
  for (let i = 0; i < samples.length; i++) {
    const { t, px } = samples[i];
    const since = i > 0 ? Math.min(MAX_SPREAD_MS, Math.max(FRAME_MS, t - samples[i - 1].t)) : FRAME_MS;
    const overlap = Math.min(t, newest) - Math.max(t - since, oldest);
    if (overlap > 0) travel += (Math.abs(px) * overlap) / since;
  }
  return travel / (toMs - fromMs);
}

export function isReadersScroll(samples: readonly WheelSample[], nowMs: number, c: CoilConstants = COIL): boolean {
  const { windowMs, recentMs, steadyRatio, minPxPerMs, reversePx } = c.deal.cutscene.tail;
  const latest = samples[samples.length - 1];
  if (!latest) return false;
  const before = samples[samples.length - 2];
  if (before && Math.abs(latest.px) >= reversePx && Math.sign(latest.px) !== Math.sign(before.px)) return true;
  const recent = paceBetween(samples, nowMs, 0, recentMs);
  const rest = paceBetween(samples, nowMs, recentMs, windowMs);
  return recent >= minPxPerMs && recent >= steadyRatio * rest;
}
