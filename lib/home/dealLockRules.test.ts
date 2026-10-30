import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { msUntilDue, releaseDue, swallowsKey, type LockClock } from "@/lib/home/dealLockRules";

const { quietMs, capMs } = COIL.deal.cutscene;

const clock = (over: Partial<LockClock> = {}): LockClock => ({ takenAtMs: 1000, unfurledAtMs: null, lastInputMs: 1000, ...over });

describe("when the cutscene's lock lets go", () => {
  it("holds while the Coil is not unfurled, however quiet the reader is", () => {
    expect(releaseDue(clock(), 1000 + capMs - 1)).toBeNull();
    expect(releaseDue(clock({ lastInputMs: 1000 }), 2500)).toBeNull();
  });

  it("holds after the unfurl while the reader's input is still arriving, and lets go once it has been quiet", () => {
    const unfurled = clock({ unfurledAtMs: 2400, lastInputMs: 2390 });
    expect(releaseDue(unfurled, 2400)).toBeNull();
    expect(releaseDue(unfurled, 2390 + quietMs - 1)).toBeNull();
    expect(releaseDue(unfurled, 2390 + quietMs)).toBe("quiet");
    // A tail event pushes it out again.
    expect(releaseDue({ ...unfurled, lastInputMs: 2480 }, 2390 + quietMs)).toBeNull();
    expect(releaseDue({ ...unfurled, lastInputMs: 2480 }, 2480 + quietMs)).toBe("quiet");
  });

  it("lets go at the unfurl when the reader's input stopped long before it", () => {
    expect(releaseDue(clock({ unfurledAtMs: 3000, lastInputMs: 1500 }), 3000)).toBe("quiet");
  });

  it("lets go at the cap whatever else happened: input still arriving, never unfurled", () => {
    expect(releaseDue(clock({ lastInputMs: 1000 + capMs - 1 }), 1000 + capMs)).toBe("cap");
    expect(releaseDue(clock({ unfurledAtMs: 2900, lastInputMs: 3990 }), 1000 + capMs)).toBe("cap");
    expect(releaseDue(clock(), 1000 + capMs + 5000)).toBe("cap");
  });

  it("schedules the sooner of the cap and the quiet gap, never in the past", () => {
    expect(msUntilDue(clock(), 1000)).toBe(capMs);
    expect(msUntilDue(clock({ unfurledAtMs: 2000, lastInputMs: 1990 }), 2000)).toBe(quietMs - 10);
    expect(msUntilDue(clock({ unfurledAtMs: 2000, lastInputMs: 1000 }), 2000)).toBe(0);
    // Near the cap with input still arriving: the cap comes first.
    const late = 1000 + capMs - 100;
    expect(msUntilDue(clock({ unfurledAtMs: late, lastInputMs: late + 90 }), late + 90)).toBe(10);
    expect(msUntilDue(clock(), 1000 + capMs + 50)).toBe(0);
  });

  it("the cap keeps more than a second over the unfurl, and the quiet gap is about 120 ms", () => {
    // The unfurl comes the condense and the scene's pull after the trigger (lib/coil/dealSpeed.ts).
    const unfurl = COIL.deal.timeline.condenseMs + COIL.deal.timeline.pullStartMs + COIL.deal.timeline.pullMs;
    expect(capMs - unfurl).toBeGreaterThanOrEqual(1000);
    expect(capMs - unfurl).toBeLessThanOrEqual(1500);
    expect(quietMs).toBeGreaterThanOrEqual(80);
    expect(quietMs).toBeLessThanOrEqual(160);
  });
});

describe("the keys the lock swallows", () => {
  const press = (key: string, altKey = false) => swallowsKey({ key, altKey });

  it("are the ones that scroll the page", () => {
    for (const key of ["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " "]) expect(press(key), key).toBe(true);
  });

  it("leave Tab, Escape, Enter, letters and the sideways arrows alone", () => {
    for (const key of ["Tab", "Escape", "Enter", "a", "ArrowLeft", "ArrowRight", "Shift", "Meta"]) expect(press(key), key).toBe(false);
  });

  it("leave Alt with a key alone: the browser's own", () => {
    expect(press("ArrowDown", true)).toBe(false);
  });
});
