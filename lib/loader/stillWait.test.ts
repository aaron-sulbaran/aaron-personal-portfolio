import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStillWait, type StillWaitTimers } from "@/lib/loader/stillWait";

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

  it("tells onStart when the fade starts, once, and never after it has left or been disposed", () => {
    const onStart = vi.fn();
    const leave = vi.fn();
    const wait = createStillWait({ fadeMs: FADE, slackMs: SLACK, startGuardMs: GUARD, timers: fakeTimers(), leave, onStart });
    expect(onStart).not.toHaveBeenCalled();
    wait.started();
    expect(onStart).toHaveBeenCalledTimes(1);
    wait.ended();
    wait.started();
    expect(onStart).toHaveBeenCalledTimes(1);
    const disposed = vi.fn();
    const other = createStillWait({ fadeMs: FADE, slackMs: SLACK, startGuardMs: GUARD, timers: fakeTimers(), leave, onStart: disposed });
    other.dispose();
    other.started();
    expect(disposed).not.toHaveBeenCalled();
  });
});
