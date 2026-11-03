import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODAL_DISMISS_HOLD, MODAL_DISMISS_RAMP } from "@/lib/modal";
import { SUMMON_AFTER_MS, onMarkSummon, summonMarkCard } from "@/lib/mark/summon";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("asking for the logo's easter egg from elsewhere", () => {
  it("waits for the closing card's frost to be held and cleared, then tells the logo once", () => {
    expect(SUMMON_AFTER_MS).toBe(Math.round((MODAL_DISMISS_HOLD + MODAL_DISMISS_RAMP) * 1000));
    const played = vi.fn();
    const stop = onMarkSummon(played);
    summonMarkCard();
    vi.advanceTimersByTime(SUMMON_AFTER_MS - 1);
    expect(played).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(played).toHaveBeenCalledTimes(1);
    stop();
  });

  it("takes a second ask while one waits for the same ask, and a later ask for a new one", () => {
    const played = vi.fn();
    const stop = onMarkSummon(played);
    summonMarkCard();
    vi.advanceTimersByTime(100);
    summonMarkCard();
    vi.advanceTimersByTime(SUMMON_AFTER_MS);
    expect(played).toHaveBeenCalledTimes(1);
    summonMarkCard();
    vi.advanceTimersByTime(SUMMON_AFTER_MS);
    expect(played).toHaveBeenCalledTimes(2);
    stop();
  });

  it("tells nothing once the logo has gone", () => {
    const played = vi.fn();
    onMarkSummon(played)();
    summonMarkCard();
    vi.advanceTimersByTime(SUMMON_AFTER_MS);
    expect(played).not.toHaveBeenCalled();
  });
});
