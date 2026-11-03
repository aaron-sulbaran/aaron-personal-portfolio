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
  trackpadFlick,
  trackpadFling,
  wheelStream,
} from "@/lib/home/dealLock.fixtures";

const { capMs, quietMs } = COIL.deal.cutscene;

// The cutscene's lock, replayed with wheel, touch and key streams (recorded Chrome
// streams and ones of their shape) through the rules the page runs. Times are ms
// from the deal's start, when the lock is taken; the Coil is unfurled at UNFURL_MS
// and dealt 300 ms after.

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

  it("is held to its end for a sharper flick too", () => {
    const input = trackpadFlick(2000);
    const played = playLock(input);
    expect(played.why).toBe("quiet");
    expect(played.releasedAtMs).toBe(input[input.length - 1].t + quietMs);
    expect(played.passed).toHaveLength(0);
  });
});

describe("input that goes on arriving after the unfurl", () => {
  it("holds a mouse wheel kept turning until the cap: the Coil first turns 1.2 s after the unfurl", () => {
    const played = playLock(mouseWheel(1800, 8000));
    expect(played.why).toBe("cap");
    expect(played.releasedAtMs).toBe(capMs);
    const turn = firstCoilTurnMs(played);
    expect(turn).not.toBeNull();
    expect(turn! - UNFURL_MS).toBeGreaterThan(1100);
    expect(turn! - DEALT_MS).toBeGreaterThan(800);
  });

  it("holds a new gesture that follows the tail without a gap, until the cap", () => {
    // The fling's tail ends 69 ms before the reader's next swipe begins, dealt + 300 ms.
    const tail = trackpadFling(1500);
    const swipeAt = DEALT_MS + 300;
    expect(swipeAt - tail[tail.length - 1].t).toBeLessThan(quietMs);
    const played = playLock([...tail, ...wheelStream(downFirstQuick, swipeAt, "swipe")]);
    expect(played.why).toBe("cap");
    const turn = firstCoilTurnMs(played, "swipe");
    expect(turn! - swipeAt).toBeGreaterThan(500);
  });

  it("holds a finger that keeps moving, and a new touch on top of it, until the cap", () => {
    expect(playLock(fingerDrag(0, 6000)).why).toBe("cap");
    expect(playLock([...fingerDrag(0, 6000), ...fingerDrag(DEALT_MS - 140, 6000, { down: true, from: "new" })]).releasedAtMs).toBe(capMs);
  });

  it("holds a held scroll key until the cap", () => {
    expect(playLock(heldKey(1800, 8000)).releasedAtMs).toBe(capMs);
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
