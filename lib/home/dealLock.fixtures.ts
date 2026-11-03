import { armCapture, createCapture, decideWheel, type WheelOwner } from "@/lib/coil/capture";
import { COIL } from "@/lib/coil/constants";
import { dealMs } from "@/lib/coil/dealSpeed";
import { downFirstQuick, jitter, notches, type RecordedWheel } from "@/lib/coil/capture.fixtures";
import { createLockClock, markUnfurled, msUntilDue, noteInput, releaseDue, type LockReason } from "@/lib/home/dealLockRules";

// Replays a reader's input through the cutscene's lock, with the rules the page
// runs (lib/home/dealLockRules.ts) and a virtual clock in place of the DOM half's
// timer, and hands what got through to the Coil's wheel ownership
// (lib/coil/capture.ts). Times are ms from the moment the lock was taken, the
// deal's start. The streams are the recorded Chrome wheel streams of
// lib/coil/capture.fixtures.ts (a trackpad's ramp and momentum tail, a mouse's
// notches) and generated ones of the same shape.

export type TimedInput =
  | { t: number; kind: "wheel"; px: number; from: string }
  | { t: number; kind: "touchStart"; from: string }
  | { t: number; kind: "touchMove"; from: string }
  | { t: number; kind: "key"; from: string };

// When the Coil is unfurled and when the deal is dealt, from the lock's take.
export const UNFURL_MS = dealMs(COIL);
export const DEALT_MS = UNFURL_MS + 300;

// A recorded wheel stream starting at startMs (and scaled, flipped), tagged with its source.
export function wheelStream(stream: readonly RecordedWheel[], startMs: number, from: string, { scale = 1 } = {}): TimedInput[] {
  return stream.map(([at, dy]) => ({ t: startMs + at, kind: "wheel", px: dy * scale, from }));
}

// A trackpad fling: the recorded ramp and momentum tail that runs about 1.7 s.
export const trackpadFling = (startMs: number, from = "fling") => wheelStream(jitter, startMs, from);
// A shorter, sharper one (a ramp and a 1 s tail).
export const trackpadFlick = (startMs: number, from = "flick") => wheelStream(downFirstQuick, startMs, from);

// A mouse wheel kept turning from startMs to endMs: the recorded notches' pace (a
// notch every 33 to 67 ms), repeated.
export function mouseWheel(startMs: number, endMs: number, from = "mouse"): TimedInput[] {
  const gaps = notches.slice(1).map(([at], i) => at - notches[i][0]);
  const out: TimedInput[] = [];
  let t = startMs;
  for (let i = 0; t <= endMs; i++) {
    out.push({ t, kind: "wheel", px: 100, from });
    t += gaps[i % gaps.length];
  }
  return out;
}

// A fling as e2e/support/cutscene.ts sends it: a burst of events (80 to 150 px, one every
// ms/events) and then a slow exponential tail (timeConstantMs, from startPx an event, one
// event a frame, whole pixels) until endMs, with the events that round to nothing dropped.
export function burstAndSlowTail(burstMs: number, endMs: number, { events = 30, startPx = 150, timeConstantMs = 600 } = {}, from = "fling"): TimedInput[] {
  const out: TimedInput[] = [];
  for (let i = 0; i < events; i++) out.push({ t: Math.round((i * burstMs) / events), kind: "wheel", px: 80 + ((i * 37) % 71), from });
  for (let t = burstMs; t < endMs; t += 16) {
    const px = Math.round(startPx * Math.exp(-(t - burstMs) / timeConstantMs));
    if (px >= 1) out.push({ t, kind: "wheel", px, from });
  }
  return out;
}

// A reader scrolling at a steady pace with a trackpad, no momentum: pxPerFrame every
// 16 to 17 ms with a pixel of wobble; negative scrolls up.
export function steadyScroll(startMs: number, endMs: number, pxPerFrame: number, from = "steady"): TimedInput[] {
  const wobble = [0, 1, -1, 0, 1, 0, -1, 1, 0, -1];
  const out: TimedInput[] = [];
  for (let i = 0, t = startMs; t <= endMs; i++, t += i % 3 === 0 ? 17 : 16) out.push({ t, kind: "wheel", px: pxPerFrame + Math.sign(pxPerFrame) * wobble[i % wobble.length], from });
  return out;
}

// A held scroll key: auto-repeat every 33 ms.
export function heldKey(startMs: number, endMs: number, from = "key"): TimedInput[] {
  const out: TimedInput[] = [];
  for (let t = startMs; t <= endMs; t += 33) out.push({ t, kind: "key", from });
  return out;
}

// A finger moving from startMs to endMs, a touch move every frame; `down` puts a
// touch start first (a new touch; the finger that started the deal began before the lock).
export function fingerDrag(startMs: number, endMs: number, { down = false, from = "finger" } = {}): TimedInput[] {
  const out: TimedInput[] = down ? [{ t: startMs, kind: "touchStart", from }] : [];
  for (let t = startMs + (down ? 16 : 0); t <= endMs; t += 16) out.push({ t, kind: "touchMove", from });
  return out;
}

export type Played = {
  // When the lock let go, and why; null if it held to the end of the replay.
  releasedAtMs: number | null;
  why: LockReason | null;
  swallowed: TimedInput[];
  // What reached the page and the Coil: the input that ended the lock, and all after it.
  passed: TimedInput[];
};

// The lock from its take until it lets go or the replay ends. The virtual timer
// arms as the DOM half does: at the sooner of the cap and the quiet gap, after
// every input once unfurled and at the unfurl.
export function playLock(inputs: readonly TimedInput[], { unfurlAtMs = UNFURL_MS, untilMs = COIL.deal.cutscene.capMs + 2000 } = {}): Played {
  const clock = createLockClock(0);
  const order = [...inputs].sort((a, b) => a.t - b.t);
  const played: Played = { releasedAtMs: null, why: null, swallowed: [], passed: [] };
  let timerAt: number | null = Math.max(1, msUntilDue(clock, 0));
  let unfurled = false;

  const letGo = (nowMs: number, why: LockReason) => {
    played.releasedAtMs = nowMs;
    played.why = why;
    timerAt = null;
  };
  const rearm = (nowMs: number) => {
    timerAt = nowMs + Math.max(1, msUntilDue(clock, nowMs));
  };
  // Timers due before nowMs fire in order.
  const fireTimers = (nowMs: number) => {
    while (played.releasedAtMs === null && timerAt !== null && timerAt <= nowMs) {
      const at = timerAt;
      const due = releaseDue(clock, at);
      if (due) letGo(at, due);
      else rearm(at);
    }
  };
  const unfurl = () => {
    unfurled = true;
    const due = markUnfurled(clock, unfurlAtMs);
    if (due) letGo(unfurlAtMs, due);
    else rearm(unfurlAtMs);
  };

  for (const input of order) {
    if (!unfurled && unfurlAtMs <= input.t) {
      fireTimers(unfurlAtMs);
      if (played.releasedAtMs === null) unfurl();
    }
    fireTimers(input.t);
    if (played.releasedAtMs !== null) {
      played.passed.push(input);
      continue;
    }
    const due = noteInput(clock, input, input.t);
    if (due) {
      letGo(input.t, due);
      played.passed.push(input);
    } else {
      played.swallowed.push(input);
      if (unfurled) rearm(input.t);
    }
  }
  if (!unfurled && played.releasedAtMs === null) {
    fireTimers(unfurlAtMs);
    if (played.releasedAtMs === null) unfurl();
  }
  fireTimers(untilMs);
  return played;
}

// How the Coil answers the wheel events that got through. The Coil takes the
// wheel from the unfurl, but only once the page has rendered it as interactive
// (readyAfterUnfurlMs: React's commit and the scene's next frame); capture is
// armed by then (armCapture) and the pointer is over a card. Returns each passed
// wheel event with its owner.
export function coilOwners(played: Played, { unfurlAtMs = UNFURL_MS, readyAfterUnfurlMs = 100 } = {}): { input: TimedInput; owner: WheelOwner }[] {
  let state = armCapture(createCapture());
  return played.passed
    .filter((input) => input.kind === "wheel")
    .map((input) => {
      state = decideWheel(state, {
        nowMs: input.t,
        interactive: input.t >= unfurlAtMs + readyAfterUnfurlMs,
        heroVisible: 1,
        onCard: true,
        insideSilhouette: true,
        x: 700,
        y: 400,
      });
      return { input, owner: state.owner as WheelOwner };
    });
}

// The time the Coil first took a wheel event of the given source, or null.
export function firstCoilTurnMs(played: Played, from?: string, options?: Parameters<typeof coilOwners>[1]): number | null {
  const hit = coilOwners(played, options).find(({ input, owner }) => owner === "coil" && (from === undefined || input.from === from));
  return hit ? hit.input.t : null;
}
