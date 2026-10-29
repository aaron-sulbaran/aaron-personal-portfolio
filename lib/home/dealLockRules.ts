import { COIL, type CoilConstants } from "@/lib/coil/constants";

// When the cutscene's lock lets the reader's scroll go (lib/home/dealLock.ts is
// the DOM half). Pure and tested. Two things release it, and nothing else holds
// it past them:
//   - quiet: the Coil is unfurled and the reader's input (wheel, touch, a scroll
//     key) has been quiet for quietMs. The wait is what swallows the tail of a
//     trackpad or touch fling that started the deal, so it cannot carry on
//     scrolling the page once the Coil has the wheel.
//   - cap: capMs after the lock took input, whatever else happened.
// With no input at all the quiet gap is already met, so the lock lets go at the unfurl.

export type LockClock = {
  takenAtMs: number;
  // When the Coil was unfurled (or the deal ended without one); null until then.
  unfurledAtMs: number | null;
  // The last input the lock swallowed (the moment it was taken, until one is).
  lastInputMs: number;
};

export type LockReason = "quiet" | "cap";

export function releaseDue(clock: LockClock, nowMs: number, c: CoilConstants = COIL): LockReason | null {
  const { quietMs, capMs } = c.deal.cutscene;
  if (nowMs - clock.takenAtMs >= capMs) return "cap";
  if (clock.unfurledAtMs !== null && nowMs - clock.lastInputMs >= quietMs) return "quiet";
  return null;
}

// How long until the lock may next be due, ms (never negative): the cap, or the
// quiet gap once unfurled, whichever is sooner. What the DOM half sets its timer to.
export function msUntilDue(clock: LockClock, nowMs: number, c: CoilConstants = COIL): number {
  const { quietMs, capMs } = c.deal.cutscene;
  const cap = clock.takenAtMs + capMs - nowMs;
  const quiet = clock.unfurledAtMs === null ? Number.POSITIVE_INFINITY : clock.lastInputMs + quietMs - nowMs;
  return Math.max(0, Math.min(cap, quiet));
}

// The keys that scroll the page up or down. Left and right scroll nothing here, and
// Alt with an arrow is the browser's history, which the lock never touches.
const SCROLL_KEYS = new Set(["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " ", "Spacebar"]);

export function swallowsKey(event: { key: string; altKey: boolean }): boolean {
  return SCROLL_KEYS.has(event.key) && !event.altKey;
}
