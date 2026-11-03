import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { createLockClock, markUnfurled, msUntilDue, noteInput, releaseDue, swallowsKey, type LockClock } from "@/lib/home/dealLockRules";

const { quietMs, capMs, handoverMs } = COIL.deal.cutscene;

const clock = (over: Partial<LockClock> = {}): LockClock => ({ ...createLockClock(1000), ...over });

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

describe("when the reader's own scroll is let through", () => {
  // A mouse wheel kept turning: a notch of 100 px every 50 ms. Returns when the lock
  // is first due, with the reason.
  const wheel = (c: LockClock, fromMs: number, toMs: number) => {
    for (let t = fromMs; t <= toMs; t += 50) {
      const due = noteInput(c, { kind: "wheel", px: 100 }, t);
      if (due) return { at: t, due };
    }
    return { at: null, due: null };
  };

  it("holds a wheel kept turning until the Coil can have it, then lets go for it", () => {
    const c = clock();
    expect(wheel(c, 1500, 2350)).toEqual({ at: null, due: null });
    expect(markUnfurled(c, 2400)).toBeNull();
    // The unfurl was at 2400: the handover ends at 2400 + handoverMs.
    expect(wheel(c, 2400, 2400 + handoverMs - 1)).toEqual({ at: null, due: null });
    expect(wheel(c, 2400 + handoverMs, 3000)).toEqual({ at: 2400 + handoverMs, due: "gesture" });
  });

  it("holds it until the unfurl, however plainly the reader's", () => {
    expect(wheel(clock(), 1100, 3000)).toEqual({ at: null, due: null });
  });

  it("is judged as the events arrive, so the timer is still only the cap and the quiet gap", () => {
    const c = clock();
    wheel(c, 1500, 2450);
    markUnfurled(c, 2400);
    expect(msUntilDue(c, 2450)).toBe(quietMs);
  });

  it("leaves a tail dying away held, and lets go once it is quiet", () => {
    const c = clock();
    // 60 px at 16 ms, losing 4 percent an event, from 1000 to 3000; unfurled at 2000.
    let px = 60;
    let t = 1000;
    for (; t < 3000; t += 16) {
      expect(noteInput(c, { kind: "wheel", px }, t), `at ${t}`).toBeNull();
      if (t >= 2000) markUnfurled(c, t);
      px *= 0.96;
    }
    expect(releaseDue(c, t - 16 + quietMs)).toBe("quiet");
  });

  it("lets go for a finger that came down after the lock was taken, not for one that began before it", () => {
    const fresh = clock({ unfurledAtMs: 2400, lastInputMs: 2500 });
    expect(releaseDue(fresh, 2400 + handoverMs + 10)).toBeNull();
    noteInput(fresh, { kind: "touchStart" }, 2450);
    expect(releaseDue(fresh, 2400 + handoverMs - 1)).toBeNull();
    expect(releaseDue(fresh, 2400 + handoverMs)).toBe("gesture");
    // The finger of the scroll that started the deal came down before the lock: only its moves count.
    const own = clock({ unfurledAtMs: 2400, lastInputMs: 2500 });
    noteInput(own, { kind: "touchMove" }, 2510);
    expect(releaseDue(own, 2600)).toBeNull();
  });

  it("never lets go for a scroll key, which has no tail to tell from", () => {
    const c = clock({ unfurledAtMs: 2400 });
    for (let t = 2400; t < 3600; t += 33) expect(noteInput(c, { kind: "key" }, t)).toBeNull();
  });

  it("still lets go at the cap, ahead of anything", () => {
    expect(wheel(clock(), 1100, 1000 + capMs)).toEqual({ at: 1000 + capMs, due: "cap" });
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
