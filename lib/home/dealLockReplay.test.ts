import { describe, expect, it } from "vitest";
import { downFirstQuick } from "@/lib/coil/capture.fixtures";
import { COIL } from "@/lib/coil/constants";
import { createConveyor, createRowHold, rowHoldWeight, stepConveyor } from "@/lib/coil/motion";
import {
  DEALT_MS,
  UNFURL_MS,
  coilOwners,
  fingerDrag,
  firstCoilTurnMs,
  heldKey,
  mouseWheel,
  playLock,
  burstAndSlowTail,
  steadyScroll,
  trackpadFlick,
  trackpadFling,
  wheelStream,
  type TimedInput,
} from "@/lib/home/dealLock.fixtures";

const { capMs, quietMs, handoverMs } = COIL.deal.cutscene;
const HANDOVER_AT = UNFURL_MS + handoverMs;

// The cutscene's lock, replayed with wheel, touch and key streams (the recorded
// Chrome streams of lib/coil/capture.fixtures.ts and ones of their shape) through
// the rules the page runs. Times are ms from the deal's start, when the lock is
// taken; the Coil is unfurled at UNFURL_MS and dealt 300 ms after.
//
// What the replay measured before the lock let a reader's own scroll through
// (Aaron, 2026-11-02: the Coil did not turn until 3 to 4 s after it showed up):
//   a mouse wheel kept turning from 1.8 s ....... Coil first turns at 3.85 s
//                                                  (the cap): unfurl + 1,209 ms
//   a swipe on the heels of a tail, dealt + 300 .. Coil first turns at 3.81 s
//                                                  (the cap): 572 ms after the swipe began
//   a finger that came down after the lock ....... held to the cap
// A tail was held and never reached the Coil, then as now.

describe("a fling's tail that started the deal", () => {
  it("is over before the unfurl, so the lock lets go at the unfurl and nothing of the tail got through", () => {
    // The recorded trackpad fling: a ramp and a momentum tail of about 1.7 s.
    const played = playLock(trackpadFling(0));
    expect(played.why).toBe("quiet");
    expect(played.releasedAtMs).toBe(UNFURL_MS);
    expect(played.passed).toHaveLength(0);
  });

  it("is held to its end when it is still arriving at the unfurl, none of it reaching the Coil", () => {
    // The same fling, started 1.5 s in: its tail runs a second past the unfurl.
    const input = trackpadFling(1500);
    const end = input[input.length - 1].t;
    expect(end).toBeGreaterThan(DEALT_MS);
    const played = playLock(input);
    expect(played.why).toBe("quiet");
    expect(played.releasedAtMs).toBe(end + quietMs);
    expect(played.passed).toHaveLength(0);
    expect(played.swallowed).toHaveLength(input.length);
  });

  it("is held to its end for a sharper flick, even one whose ramp ended just before the unfurl", () => {
    for (const startMs of [1200, 2000, 2300]) {
      const input = trackpadFlick(startMs);
      const played = playLock(input);
      expect(played.why, `from ${startMs}`).toBe("quiet");
      expect(played.releasedAtMs, `from ${startMs}`).toBe(Math.max(UNFURL_MS, input[input.length - 1].t + quietMs));
      expect(played.passed, `from ${startMs}`).toHaveLength(0);
    }
  });

  it("is held to its end when it is a burst and a slow, whole-pixel tail that outlasts the unfurl, as the end-to-end spec sends it", () => {
    // e2e/deal-cutscene.spec.ts: 30 wheels in 300 ms, then a tail from 150 px with a 0.6 s time constant to 3.3 s.
    const input = burstAndSlowTail(300, 3300);
    const end = input[input.length - 1].t;
    expect(end).toBeGreaterThan(UNFURL_MS + 500);
    const played = playLock(input);
    expect(played.why).toBe("quiet");
    expect(played.releasedAtMs).toBe(end + quietMs);
    expect(played.passed).toHaveLength(0);
  });

  it("is held to its end for a tail of either recorded shape, whenever in the cutscene it began", () => {
    // (A tail that would run past the cap is let go at it, as before.)
    for (const [stream, lastStart] of [[trackpadFling, 1900], [trackpadFlick, 2300]] as const) {
      for (let startMs = 700; startMs <= lastStart; startMs += 200) {
        const played = playLock(stream(startMs));
        expect(played.why, `${stream.name} from ${startMs}`).toBe("quiet");
        expect(played.passed, `${stream.name} from ${startMs}`).toHaveLength(0);
      }
    }
  });
});

describe("a reader who keeps scrolling past the unfurl", () => {
  it("has a mouse wheel kept turning taken as soon as the Coil can have it: the Coil turns before the cards are dealt", () => {
    const played = playLock(mouseWheel(1800, 8000));
    expect(played.why).toBe("gesture");
    // At the first notch once the handover has passed that reads as the reader's (notches 33 to 67 ms apart, so a few of them can read as a wheel slowing).
    expect(played.releasedAtMs!).toBeGreaterThanOrEqual(HANDOVER_AT);
    expect(played.releasedAtMs!).toBeLessThan(HANDOVER_AT + 120);
    const turn = firstCoilTurnMs(played)!;
    expect(turn).toBeGreaterThanOrEqual(HANDOVER_AT);
    expect(turn).toBeLessThan(DEALT_MS);
    // Every event from then on is the Coil's: one gesture, in the Coil's hands.
    expect(coilOwners(played).every(({ owner }) => owner === "coil")).toBe(true);
  });

  it("has a mouse wheel turning since the deal began taken the same way", () => {
    const played = playLock(mouseWheel(0, 8000));
    expect(played.why).toBe("gesture");
    expect(firstCoilTurnMs(played)!).toBeLessThan(DEALT_MS);
  });

  it("has a gentle trackpad scroll that goes on taken within a few events of the handover, up or down", () => {
    for (const pxPerFrame of [6, 3, -6]) {
      const played = playLock(steadyScroll(1800, 8000, pxPerFrame));
      expect(played.why, `${pxPerFrame} px a frame`).toBe("gesture");
      expect(firstCoilTurnMs(played)! - HANDOVER_AT, `${pxPerFrame} px a frame`).toBeLessThan(150);
    }
  });

  it("takes a fresh swipe on the heels of a tail within a few events, none of the tail reaching the Coil", () => {
    // The fling's tail ends 69 ms before the reader's next swipe begins, dealt + 300 ms: no quiet gap between them.
    const tail = trackpadFling(1500);
    const tailEnd = tail[tail.length - 1].t;
    const swipeAt = DEALT_MS + 300;
    expect(swipeAt - tailEnd).toBeLessThan(quietMs);
    const played = playLock([...tail, ...wheelStream(downFirstQuick, swipeAt, "swipe")]);
    expect(played.why).toBe("gesture");
    expect(firstCoilTurnMs(played, "swipe")! - swipeAt).toBeLessThan(100);
    expect(played.passed.filter((event) => event.from === "fling")).toHaveLength(0);
  });

  it("takes a swipe the other way against a tail still arriving at once", () => {
    // The fingers coming down again stop the tail's momentum: it ends where the swipe begins.
    const upAt = HANDOVER_AT + 200;
    const tail = trackpadFling(1500).filter((event) => event.t < upAt);
    const up = wheelStream(downFirstQuick, upAt, "up", { scale: -1 });
    const played = playLock([...tail, ...up]);
    expect(played.why).toBe("gesture");
    expect(firstCoilTurnMs(played, "up")! - upAt).toBeLessThan(50);
    expect(played.passed.filter((event) => event.from === "fling")).toHaveLength(0);
  });

  it("takes a swipe that begins in the handover only once the Coil can have it", () => {
    const played = playLock([...trackpadFling(1500), ...wheelStream(downFirstQuick, UNFURL_MS + 20, "swipe")]);
    expect(played.why).toBe("gesture");
    expect(played.releasedAtMs!).toBeGreaterThanOrEqual(HANDOVER_AT);
    expect(played.releasedAtMs!).toBeLessThan(HANDOVER_AT + 100);
  });

  it("lets go at the cap whatever else, for a trickle too slow to tell from a tail's last pixels", () => {
    const trickle: TimedInput[] = [];
    for (let t = 1800; t <= 8000; t += 17) trickle.push({ t, kind: "wheel", px: 1, from: "trickle" });
    expect(playLock(trickle).releasedAtMs).toBe(capMs);
  });
});

describe("touch", () => {
  it("lets a finger that came down after the lock was taken through once the Coil can have it", () => {
    // Impatient: a second flick during the cutscene, still moving at the unfurl.
    const played = playLock(fingerDrag(1800, 6000, { down: true }));
    expect(played.why).toBe("gesture");
    expect(played.releasedAtMs!).toBeGreaterThanOrEqual(HANDOVER_AT);
    expect(played.releasedAtMs!).toBeLessThan(HANDOVER_AT + 20);
  });

  it("lets a new touch after the unfurl through at its start, even with the last finger's moves under 120 ms behind", () => {
    const earlier = fingerDrag(0, DEALT_MS);
    const touchAt = DEALT_MS + 50;
    const played = playLock([...earlier, ...fingerDrag(touchAt, 6000, { down: true, from: "new" })]);
    expect(earlier[earlier.length - 1].t + quietMs).toBeGreaterThan(touchAt);
    expect(played.why).toBe("gesture");
    expect(played.releasedAtMs).toBe(touchAt);
    expect(played.passed[0].kind).toBe("touchStart");
  });

  it("holds the finger that started the deal while it goes on moving, as before: a finger gives no tail to tell it by", () => {
    const played = playLock(fingerDrag(0, 6000));
    expect(played.why).toBe("cap");
    expect(played.releasedAtMs).toBe(capMs);
  });

  it("lets a phone flick that ended before the unfurl go at the unfurl, and takes the next at once", () => {
    const played = playLock([...fingerDrag(0, 180), ...fingerDrag(DEALT_MS + 300, DEALT_MS + 500, { down: true, from: "next" })]);
    expect(played.why).toBe("quiet");
    expect(played.releasedAtMs).toBe(UNFURL_MS);
    expect(played.swallowed.filter((event) => event.from === "next")).toHaveLength(0);
  });
});

describe("the keyboard and the cap", () => {
  it("hold a scroll key kept down to the cap, as before", () => {
    expect(playLock(heldKey(1800, 8000)).releasedAtMs).toBe(capMs);
  });

  it("let go at the cap with nothing ever unfurling", () => {
    const played = playLock(mouseWheel(0, 8000), { unfurlAtMs: 99_999 });
    expect(played.why).toBe("cap");
    expect(played.releasedAtMs).toBe(capMs);
  });
});

describe("a gesture that begins once the lock has let go", () => {
  it("goes straight to the Coil: a mouse wheel that starts after the unfurl, with the reader quiet before it", () => {
    const played = playLock(mouseWheel(DEALT_MS + 150, 8000));
    expect(played.releasedAtMs).toBe(UNFURL_MS);
    expect(firstCoilTurnMs(played)).toBe(DEALT_MS + 150);
  });

  it("takes a new swipe 300 ms after dealt the moment it starts, after the tail has ended", () => {
    const played = playLock([...trackpadFling(0), ...mouseWheel(DEALT_MS + 300, 8000, "new")]);
    expect(firstCoilTurnMs(played, "new")).toBe(DEALT_MS + 300);
    expect(coilOwners(played).every(({ owner }) => owner === "coil")).toBe(true);
  });
});

describe("the handover", () => {
  it("waits long enough that the Coil, rendered as the reader's within about a frame and a half, has the whole gesture", () => {
    for (const readyAfterUnfurlMs of [50, 100, handoverMs]) {
      const played = playLock(mouseWheel(1800, 8000));
      const owners = coilOwners(played, { readyAfterUnfurlMs });
      expect(owners.every(({ owner }) => owner === "coil"), `ready ${readyAfterUnfurlMs} ms after the unfurl`).toBe(true);
    }
  });

  it("is what keeps a gesture from starting before the Coil could take it: a Coil that renders later hands the whole gesture to the page", () => {
    const owners = coilOwners(playLock(mouseWheel(1800, 8000)), { readyAfterUnfurlMs: handoverMs + 120 });
    expect(owners.every(({ owner }) => owner === "page")).toBe(true);
  });
});

describe("the Coil's idle drift", () => {
  it("has no timer to wait for: it turns at the idle pace from its first rested frame, whatever the reader does", () => {
    const conveyor = createConveyor(0);
    const hold = createRowHold();
    const dt = 1 / 60;
    for (let frame = 1; frame <= 60; frame++) {
      stepConveyor(conveyor, { dt, nowMs: UNFURL_MS + frame * 16, idleWeight: rowHoldWeight(hold, UNFURL_MS + frame * 16) });
      expect(conveyor.offset, `frame ${frame}`).toBeCloseTo(COIL.idleCardsPerSecond * dt * frame, 9);
    }
  });
});
