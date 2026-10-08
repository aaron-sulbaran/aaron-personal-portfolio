import { describe, expect, it, vi } from "vitest";
import { createLockupFade } from "@/lib/loader/lockupFade";

function fakeTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    pending,
    timers: {
      set: vi.fn((fn: () => void) => {
        const id = next++;
        pending.set(id, fn);
        return id;
      }),
      clear: vi.fn((id: number) => void pending.delete(id)),
    },
    fire() {
      const due = [...pending.values()];
      pending.clear();
      due.forEach((fn) => fn());
    },
  };
}

function fakeLayer(opacity = "0.264") {
  let resolve = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const finished = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let play = () => {};
  const ready = new Promise<void>((res) => (play = res));
  const cancel = vi.fn(() => reject(new DOMException("cancelled", "AbortError")));
  const animate = vi.fn((keyframes: Keyframe[], options: KeyframeAnimationOptions) => ({ keyframes, options, cancel, finished, ready }));
  return { layer: { animate, style: { opacity: "" } }, animate, cancel, finish: () => resolve(), play: () => play(), read: () => opacity };
}

const flush = () => new Promise((done) => setTimeout(done, 0));

describe("the resting lockup's fade onto the still's baked name", () => {
  it("runs linear from the layer's composite ink to 0 over the fade, holding the end", () => {
    const { layer, animate, read } = fakeLayer();
    const { timers } = fakeTimers();
    createLockupFade({ layer, read, ms: 300, slackMs: 100, startGuardMs: 1900, timers, done: () => {} }).start();
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0];
    expect(keyframes).toEqual([{ opacity: "0.264" }, { opacity: "0" }]);
    expect(options).toEqual({ duration: 300, easing: "linear", fill: "forwards" });
  });

  it("is done when the fade finishes, with the layer pinned at 0, once", async () => {
    const { layer, finish, read } = fakeLayer();
    const clock = fakeTimers();
    const done = vi.fn(() => expect(layer.style.opacity).toBe("0"));
    const fade = createLockupFade({ layer, read, ms: 300, slackMs: 100, startGuardMs: 1900, timers: clock.timers, done });
    fade.start();
    fade.start();
    expect(done).not.toHaveBeenCalled();
    finish();
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
    expect(clock.pending.size, "the backup timer cleared").toBe(0);
    clock.fire();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("is done at the backup timer, fade plus slack from the fade's own start, should its end never come", async () => {
    const { layer, read, play } = fakeLayer();
    const clock = fakeTimers();
    const done = vi.fn();
    createLockupFade({ layer, read, ms: 300, slackMs: 100, startGuardMs: 1900, timers: clock.timers, done }).start();
    expect(clock.timers.set, "a guard should the fade never start").toHaveBeenCalledTimes(1);
    expect(clock.timers.set).toHaveBeenLastCalledWith(expect.any(Function), 1900);
    play();
    await flush();
    expect(clock.timers.set, "re-armed when the fade starts").toHaveBeenCalledTimes(2);
    expect(clock.timers.set).toHaveBeenLastCalledWith(expect.any(Function), 400);
    expect(clock.pending.size, "one timer, the one from the fade's start").toBe(1);
    clock.fire();
    expect(done).toHaveBeenCalledTimes(1);
    expect(layer.style.opacity).toBe("0");
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("cancel stops everything: no done from the fade or the timer", async () => {
    const { layer, cancel, finish, read } = fakeLayer();
    const clock = fakeTimers();
    const done = vi.fn();
    const fade = createLockupFade({ layer, read, ms: 300, slackMs: 100, startGuardMs: 1900, timers: clock.timers, done });
    fade.start();
    fade.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
    finish();
    clock.fire();
    await flush();
    expect(done).not.toHaveBeenCalled();
    fade.start();
    expect(done).not.toHaveBeenCalled();
  });

  it("a stall before the fade starts never cuts it short: the clock runs from its start", async () => {
    const { layer, read, play, finish } = fakeLayer();
    const clock = fakeTimers();
    const done = vi.fn();
    createLockupFade({ layer, read, ms: 300, slackMs: 100, startGuardMs: 1900, timers: clock.timers, done }).start();
    const guard = [...clock.pending.keys()][0];
    play();
    await flush();
    expect(clock.pending.has(guard), "the guard from start() cleared").toBe(false);
    finish();
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("with no slack (a held hand-off) arms no timer, so a paused fade holds", async () => {
    const { layer, read, play, finish } = fakeLayer();
    const clock = fakeTimers();
    const done = vi.fn();
    createLockupFade({ layer, read, ms: 300, slackMs: null, startGuardMs: 1900, timers: clock.timers, done }).start();
    play();
    await flush();
    expect(clock.timers.set).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    finish();
    await flush();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("no layer: done at once", () => {
    const clock = fakeTimers();
    const done = vi.fn();
    createLockupFade({ layer: null, read: () => "1", ms: 300, slackMs: 100, startGuardMs: 1900, timers: clock.timers, done }).start();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
