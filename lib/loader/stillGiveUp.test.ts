import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { giveUpToHeading, raceStill, type GiveUpSteps } from "@/lib/loader/stillGiveUp";
import type { StillWaitTimers } from "@/lib/loader/stillWait";

const FADE = 400;
const GIVE_UP = 1500;

// vitest's fake clock behind the helper's injected timers.
function fakeTimers(): StillWaitTimers {
  const handles = new Map<number, ReturnType<typeof setTimeout>>();
  let next = 0;
  return {
    set: (fn, ms) => {
      const id = ++next;
      handles.set(id, setTimeout(fn, ms));
      return id;
    },
    clear: (id) => {
      clearTimeout(handles.get(id));
      handles.delete(id);
    },
  };
}

// Every step logs itself, in order; fadePane finishes when the test says so.
function steps(over: Partial<GiveUpSteps> = {}) {
  const log: string[] = [];
  let paneDone: (() => void) | null = null;
  const all: GiveUpSteps = {
    paneShown: false,
    fadeMs: FADE,
    timers: fakeTimers(),
    fadePane: (ms, done) => {
      log.push(`fadePane ${ms}`);
      paneDone = done;
    },
    rest: () => log.push("rest"),
    ink: { start: () => log.push("ink start"), settle: () => log.push("ink settle") },
    gone: () => log.push("gone"),
    note: (event) => log.push(`note ${event}`),
    ...over,
  };
  return { all, log, finishPane: () => paneDone?.() };
}

describe("the still path's give-up", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("without a pane: the ink eases to the h1's over the fade, then the lockup leaves in one frame, never a fade", () => {
    const { all, log } = steps();
    giveUpToHeading(all);
    expect(log).toEqual(["note still-failed", "rest", "ink start"]);
    vi.advanceTimersByTime(FADE - 1);
    expect(log).not.toContain("gone");
    vi.advanceTimersByTime(1);
    expect(log).toEqual(["note still-failed", "rest", "ink start", "ink settle", "gone", "note still-gaveup"]);
    expect(log.some((step) => step.includes("fade") && !step.startsWith("fadePane"))).toBe(false);
  });

  it("with a pane: the pane and ground fade first, then the same ease and the one-frame leave", () => {
    const { all, log, finishPane } = steps({ paneShown: true });
    giveUpToHeading(all);
    expect(log).toEqual(["note still-failed", `fadePane ${FADE}`]);
    vi.advanceTimersByTime(FADE * 3);
    expect(log, "nothing moves until the pane has faded").toEqual(["note still-failed", `fadePane ${FADE}`]);
    finishPane();
    expect(log.slice(2)).toEqual(["rest", "ink start"]);
    vi.advanceTimersByTime(FADE);
    expect(log.slice(4)).toEqual(["ink settle", "gone", "note still-gaveup"]);
  });

  it("settles the ink before the lockup goes, in the same task", () => {
    const { all, log } = steps();
    giveUpToHeading(all);
    vi.advanceTimersByTime(FADE);
    expect(log.indexOf("ink settle")).toBe(log.indexOf("gone") - 1);
  });

  it("holds each step on the caller under ?coildebug=handoff: the hand-off, then the leave", () => {
    const held: Array<() => void> = [];
    const { all, log } = steps({ hold: (step) => held.push(step) });
    giveUpToHeading(all);
    expect(log).toEqual(["note still-failed"]);
    const begin = held[0];
    begin();
    begin(); // a second finish() on the same step is ignored
    expect(log).toEqual(["note still-failed", "rest", "ink start"]);
    vi.advanceTimersByTime(FADE * 10);
    expect(log, "no timer leaves while held").not.toContain("gone");
    held.at(-1)!();
    expect(log.slice(-3)).toEqual(["ink settle", "gone", "note still-gaveup"]);
  });

  it("does nothing after teardown", () => {
    const { all, log } = steps();
    const stop = giveUpToHeading(all);
    stop();
    vi.advanceTimersByTime(FADE * 2);
    expect(log).not.toContain("gone");
  });
});

describe("the race between the still's decode and the give-up", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const outcomes = () => ({ decoded: vi.fn(), gaveUp: vi.fn() });

  it("a decode inside the give-up decides decoded, and the timer is gone", async () => {
    const on = outcomes();
    raceStill(Promise.resolve(), GIVE_UP, fakeTimers(), on);
    await vi.advanceTimersByTimeAsync(0);
    expect(on.decoded).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(GIVE_UP * 2);
    expect(on.gaveUp).not.toHaveBeenCalled();
  });

  it("a rejected decode gives up at once", async () => {
    const on = outcomes();
    raceStill(Promise.reject(new Error("aborted")), GIVE_UP, fakeTimers(), on);
    await vi.advanceTimersByTimeAsync(0);
    expect(on.gaveUp).toHaveBeenCalledTimes(1);
    expect(on.decoded).not.toHaveBeenCalled();
  });

  it("a decode that never comes gives up at the give-up, and a decode after it is ignored", async () => {
    const on = outcomes();
    let resolve = () => {};
    raceStill(new Promise<void>((done) => (resolve = done)), GIVE_UP, fakeTimers(), on);
    await vi.advanceTimersByTimeAsync(GIVE_UP - 1);
    expect(on.gaveUp).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(on.gaveUp).toHaveBeenCalledTimes(1);
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(on.decoded).not.toHaveBeenCalled();
  });

  it("decides nothing after it is stopped", async () => {
    const on = outcomes();
    const stop = raceStill(new Promise<void>(() => {}), GIVE_UP, fakeTimers(), on);
    stop();
    await vi.advanceTimersByTimeAsync(GIVE_UP * 2);
    expect(on.gaveUp).not.toHaveBeenCalled();
  });
});
