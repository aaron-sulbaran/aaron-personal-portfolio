import { describe, expect, it, vi } from "vitest";
import { startRunClock } from "./clock";

function setup(initial: "visible" | "hidden" = "visible") {
  let time = 0;
  let visibility = initial;
  const docListeners = new Map<string, () => void>();
  const winListeners = new Map<string, () => void>();
  const doc = {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (type: string, fn: () => void) => void docListeners.set(type, fn),
    removeEventListener: (type: string) => void docListeners.delete(type),
  } as unknown as Document;
  const win = {
    addEventListener: (type: string, fn: () => void) => void winListeners.set(type, fn),
    removeEventListener: (type: string) => void winListeners.delete(type),
  } as unknown as Window;
  const store = { addClock: vi.fn(), persist: vi.fn() };
  let tick: () => void = () => {};
  const clearIntervalFn = vi.fn();
  const stop = startRunClock({
    store,
    doc,
    win,
    now: () => time,
    setIntervalFn: (handler) => {
      tick = handler;
      return 1;
    },
    clearIntervalFn,
    persistEveryMs: 5000,
    tickMs: 1000,
  });
  const total = () => store.addClock.mock.calls.reduce((sum, [ms]) => sum + (ms as number), 0);
  return {
    store,
    stop,
    clearIntervalFn,
    docListeners,
    winListeners,
    total,
    advance: (ms: number) => {
      time += ms;
      tick();
    },
    setVisibility: (next: "visible" | "hidden") => {
      visibility = next;
      docListeners.get("visibilitychange")?.();
    },
    jump: (ms: number) => void (time += ms),
  };
}

describe("run clock", () => {
  it("adds elapsed visible time each tick", () => {
    const c = setup();
    c.advance(1000);
    c.advance(1000);
    expect(c.total()).toBe(2000);
  });

  it("persists at most every persistEveryMs", () => {
    const c = setup();
    for (let i = 0; i < 4; i++) c.advance(1000);
    expect(c.store.persist).not.toHaveBeenCalled();
    c.advance(1000);
    expect(c.store.persist).toHaveBeenCalledTimes(1);
    c.advance(1000);
    expect(c.store.persist).toHaveBeenCalledTimes(1);
  });

  it("counts the time up to hiding, persists, then pauses while hidden", () => {
    const c = setup();
    c.advance(1000);
    c.jump(400);
    c.setVisibility("hidden");
    expect(c.total()).toBe(1400);
    expect(c.store.persist).toHaveBeenCalledTimes(1);
    c.advance(30_000);
    expect(c.total()).toBe(1400);
  });

  it("resumes from the moment the tab is visible again", () => {
    const c = setup();
    c.setVisibility("hidden");
    c.jump(60_000);
    c.setVisibility("visible");
    c.advance(1000);
    expect(c.total()).toBe(1000);
  });

  it("does not count a tab that starts hidden", () => {
    const c = setup("hidden");
    c.advance(5000);
    expect(c.total()).toBe(0);
  });

  it("flushes and persists on pagehide", () => {
    const c = setup();
    c.jump(700);
    c.winListeners.get("pagehide")?.();
    expect(c.total()).toBe(700);
    expect(c.store.persist).toHaveBeenCalledTimes(1);
  });

  it("stop clears the interval and the listeners", () => {
    const c = setup();
    c.stop();
    expect(c.clearIntervalFn).toHaveBeenCalledWith(1);
    expect(c.docListeners.size).toBe(0);
    expect(c.winListeners.size).toBe(0);
  });
});
