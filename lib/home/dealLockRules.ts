import { COIL, type CoilConstants } from "@/lib/coil/constants";
import { isReadersScroll, type WheelSample } from "@/lib/home/wheelTail";

// When the cutscene's lock lets the reader's scroll go (lib/home/dealLock.ts is
// the DOM half). Pure and tested. Three things release it, and nothing else holds
// it past them:
//   - quiet: the Coil is unfurled and the reader's input (wheel, touch, a scroll
//     key) has been quiet for quietMs. The wait is what swallows the tail of a
//     trackpad or touch fling that started the deal, so it cannot carry on
//     scrolling the page once the Coil has the wheel.
//   - gesture: the Coil is unfurled, handoverMs have passed (the time the page
//     needs to render the Coil as the reader's), and the input is the reader's own
//     and not a tail: a wheel stream that is not dying away (lib/home/wheelTail.ts:
//     a mouse wheel kept turning, a fresh swipe, a turn round) or a finger that came
//     down after the lock was taken. A reader who keeps scrolling never gives the
//     quiet gap, and used to wait for the cap (Aaron, 2026-11-02: the Coil did not
//     turn until 3 to 4 s after it showed up). A tail still arriving is held.
//   - cap: capMs after the lock took input, whatever else happened.
// With no input at all the quiet gap is already met, so the lock lets go at the unfurl.
//
// The whole decision is here, as a clock the DOM half feeds (createLockClock,
// noteInput, markUnfurled) and asks (releaseDue, msUntilDue), so a recorded wheel
// stream can be replayed through the very rules the page runs (dealLock.fixtures.ts).

export type LockClock = {
  takenAtMs: number;
  // When the Coil was unfurled (or the deal ended without one); null until then.
  unfurledAtMs: number | null;
  // The last input the lock swallowed (the moment it was taken, until one is).
  lastInputMs: number;
  // The wheel's recent events, newest last (none older than the tail window).
  wheels: WheelSample[];
  // When a finger came down after the lock was taken: a new touch, not the one that
  // started the deal (that began before the lock). Null until one does.
  touchedAtMs: number | null;
};

export type LockReason = "quiet" | "gesture" | "cap";

// The reader's inputs the lock watches: a wheel event's travel in px (down positive),
// a finger coming down, a touch move, a scroll key.
export type LockInput = { kind: "wheel"; px: number } | { kind: "touchStart" } | { kind: "touchMove" } | { kind: "key" };

export function createLockClock(takenAtMs: number): LockClock {
  return { takenAtMs, unfurledAtMs: null, lastInputMs: takenAtMs, wheels: [], touchedAtMs: null };
}

// The reader's input arrived at nowMs. Returns why the lock must let go now, if it
// must (the input then goes on to the page, unswallowed).
export function noteInput(clock: LockClock, input: LockInput, nowMs: number, c: CoilConstants = COIL): LockReason | null {
  if (input.kind === "touchStart") {
    clock.touchedAtMs = nowMs;
  } else {
    clock.lastInputMs = nowMs;
    if (input.kind === "wheel") {
      const { windowMs } = c.deal.cutscene.tail;
      while (clock.wheels.length > 0 && nowMs - clock.wheels[0].t >= windowMs) clock.wheels.shift();
      clock.wheels.push({ t: nowMs, px: input.px });
    }
  }
  return releaseDue(clock, nowMs, c);
}

// The Coil is unfurled (or the deal ended without one) at nowMs.
export function markUnfurled(clock: LockClock, nowMs: number, c: CoilConstants = COIL): LockReason | null {
  clock.unfurledAtMs ??= nowMs;
  return releaseDue(clock, nowMs, c);
}

export function releaseDue(clock: LockClock, nowMs: number, c: CoilConstants = COIL): LockReason | null {
  const { quietMs, capMs, handoverMs } = c.deal.cutscene;
  if (nowMs - clock.takenAtMs >= capMs) return "cap";
  if (clock.unfurledAtMs === null) return null;
  if (nowMs - clock.lastInputMs >= quietMs) return "quiet";
  if (nowMs - clock.unfurledAtMs >= handoverMs && (clock.touchedAtMs !== null || isReadersScroll(clock.wheels, nowMs, c))) return "gesture";
  return null;
}

// How long until the lock may next be due, ms (never negative): the cap, or the quiet
// gap once unfurled, whichever is sooner. What the DOM half sets its timer to. (The
// reader's own scroll is judged as its events arrive, not on a timer.)
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
