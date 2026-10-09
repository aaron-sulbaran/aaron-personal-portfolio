import { describe, expect, it } from "vitest";
import { HOLD } from "@/lib/mark/constants";
import { FILL_BOTTOM, FILL_TOP, risePaint } from "@/lib/mark/geometry";
import { HOLD_IDLE, advance, cancel, press, release, sample, type HoldState } from "@/lib/mark/hold";
import { ringPaint } from "@/lib/mark/ring";

// Aaron, 2026-10-09: the ring's arc stopped short while the mark was already
// full. Both renderers paint one sample of one hold clock; this reads each
// back from its own paint (the mark's rise clip, the ring's arc and wash) and
// pins them to each other and to HOLD.holdMs.
const width = 4 * (100 / 64);
const radius = 50 - width / 2;
const PRESS = 1000;
const FULL = PRESS + HOLD.holdMs;

function shown(state: HoldState, now: number) {
  const { fill, spent } = sample(state, now);
  const rise = risePaint(fill, spent);
  const ring = ringPaint({ fill, spent, hidden: false }, width, radius);
  return { mark: (FILL_BOTTOM - rise.y) / (FILL_BOTTOM - FILL_TOP), arc: ring.arcDegrees / 360, wash: 1 - ring.washTop / 100 };
}

function expectInStep(state: HoldState, from: number, to: number) {
  for (let now = from; now <= to; now += 7) {
    const { mark, arc, wash } = shown(state, now);
    expect(arc).toBeCloseTo(mark, 9);
    expect(wash).toBeCloseTo(mark, 9);
  }
}

describe("the mark and the cursor's ring read one hold", () => {
  const held = press(HOLD_IDLE, PRESS, "pointer");

  it("start together on the press and fill linearly in step over HOLD.holdMs", () => {
    expect(shown(held, PRESS)).toEqual({ mark: 0, arc: 0, wash: 0 });
    for (let t = 1; t < HOLD.holdMs; t += 13) {
      const { mark, arc } = shown(held, PRESS + t);
      expect(mark).toBeCloseTo(t / HOLD.holdMs, 9);
      expect(arc).toBeCloseTo(mark, 9);
    }
    expectInStep(held, PRESS, FULL);
  });

  it("reach full on the instant the hold completes, not a frame before", () => {
    const late = shown(held, FULL - 1);
    expect(advance(held, FULL - 1).phase).toBe("filling");
    expect(Math.max(late.mark, late.arc, late.wash)).toBeLessThan(1);
    expect(advance(held, FULL).phase).toBe("discharging");
    expect(shown(held, FULL)).toEqual({ mark: 1, arc: 1, wash: 1 });
  });

  it("keep the border closed through the discharge, then fire", () => {
    for (let now = FULL; now < FULL + HOLD.dischargeMs; now += 7) expect(shown(held, now).arc).toBe(1);
    expect(advance(held, FULL + HOLD.dischargeMs).phase).toBe("fired");
  });

  it("rewind identically on an early release and on a cancel", () => {
    const letGo = release(held, PRESS + 400);
    expectInStep(letGo, PRESS + 400, PRESS + 1200);
    expect(shown(letGo, PRESS + 1200)).toEqual({ mark: 0, arc: 0, wash: 0 });
    const left = cancel(held, PRESS + 200);
    expectInStep(left, PRESS + 200, PRESS + 800);
    expect(shown(left, PRESS + 800)).toEqual({ mark: 0, arc: 0, wash: 0 });
  });

  it("resume from where a rewind got to and still close on one instant", () => {
    const again = press(release(held, PRESS + 100), PRESS + 250, "pointer");
    const closes = PRESS + 250 + (1 - again.from) * HOLD.holdMs;
    expectInStep(again, PRESS + 250, closes);
    expect(advance(again, closes - 1).phase).toBe("filling");
    expect(shown(again, closes)).toEqual({ mark: 1, arc: 1, wash: 1 });
  });
});
