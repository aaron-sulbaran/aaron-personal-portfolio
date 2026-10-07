import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStillWait, listenStillFade, type StillWait, type StillWaitTimers } from "@/lib/loader/stillWait";

const FADE = 400;
const SLACK = 100;
const GUARD = 2000;

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

function waitFor() {
  const leave = vi.fn();
  const wait = createStillWait({ fadeMs: FADE, slackMs: SLACK, startGuardMs: GUARD, timers: fakeTimers(), leave });
  return { wait, leave };
}

describe("the wait for the still's fade", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("leaves at the still's transitionend, before any timer", () => {
    const { wait, leave } = waitFor();
    vi.advanceTimersByTime(20);
    wait.started();
    vi.advanceTimersByTime(FADE);
    wait.ended();
    expect(leave).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GUARD * 2);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("times the backup from the fade's start, so a stall cannot cut the fade short", () => {
    const { wait, leave } = waitFor();
    vi.advanceTimersByTime(300);
    wait.started();
    vi.advanceTimersByTime(FADE + SLACK - 300);
    expect(leave, "not at fade + slack from the wait's start").not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(leave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(leave, "at the fade's start + fade + slack").toHaveBeenCalledTimes(1);
  });

  it("leaves at the start guard when the fade never starts", () => {
    const { leave } = waitFor();
    vi.advanceTimersByTime(GUARD - 1);
    expect(leave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("leaves once, however many ends come", () => {
    const { wait, leave } = waitFor();
    wait.started();
    wait.ended();
    wait.ended();
    vi.advanceTimersByTime(GUARD * 2);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("leaves when the fade is cancelled", () => {
    const { wait, leave } = waitFor();
    wait.started();
    vi.advanceTimersByTime(100);
    wait.cancelled();
    expect(leave).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GUARD * 2);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("never leaves once disposed", () => {
    const { wait, leave } = waitFor();
    wait.started();
    wait.dispose();
    vi.advanceTimersByTime(GUARD * 2);
    wait.ended();
    wait.cancelled();
    expect(leave).not.toHaveBeenCalled();
    const unstarted = waitFor();
    unstarted.wait.dispose();
    vi.advanceTimersByTime(GUARD * 2);
    expect(unstarted.leave).not.toHaveBeenCalled();
  });
});

describe("the still's own opacity transition drives the wait", () => {
  const phase = (type: string, propertyName: string) => Object.assign(new Event(type), { propertyName });
  const spyWait = (): StillWait => ({ started: vi.fn(), ended: vi.fn(), cancelled: vi.fn(), dispose: vi.fn() });

  it("run, end and cancel of the still's opacity reach the wait; other properties and targets do not", () => {
    const still = new EventTarget();
    const wait = spyWait();
    listenStillFade(still, wait);
    still.dispatchEvent(phase("transitionrun", "opacity"));
    still.dispatchEvent(phase("transitionend", "transform"));
    still.dispatchEvent(phase("transitionend", "opacity"));
    still.dispatchEvent(phase("transitioncancel", "opacity"));
    expect(wait.started).toHaveBeenCalledTimes(1);
    expect(wait.ended).toHaveBeenCalledTimes(1);
    expect(wait.cancelled).toHaveBeenCalledTimes(1);
  });

  it("stop takes the listeners off and disposes the wait; no still listens to nothing", () => {
    const still = new EventTarget();
    const wait = spyWait();
    const stop = listenStillFade(still, wait);
    stop();
    still.dispatchEvent(phase("transitionend", "opacity"));
    expect(wait.ended).not.toHaveBeenCalled();
    expect(wait.dispose).toHaveBeenCalledTimes(1);
    const none = spyWait();
    listenStillFade(null, none)();
    expect(none.dispose).toHaveBeenCalledTimes(1);
  });
});
