import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchDeal, getDeal } from "@/lib/home/deal";
import { setBeforeDealScroll, startClickDeal } from "@/lib/home/dealFlow";
import { scrollToCards } from "@/lib/home/dealScroll";

// The click path's order: hold the entrance, await the "before the deal
// scrolls" hook, scroll to the cards, lift the hold on the arrival.
vi.mock("@/lib/home/dealScroll", () => ({
  scrollToCards: vi.fn((_reduced: boolean, onDone?: () => void) => onDone?.()),
}));

const scroll = vi.mocked(scrollToCards);

beforeEach(() => {
  dispatchDeal({ type: "reset" });
  scroll.mockClear();
});
afterEach(() => setBeforeDealScroll(null));

describe("the click path", () => {
  it("scrolls to the cards with no hook registered, holding the entrance until it arrives", async () => {
    scroll.mockImplementationOnce((_reduced, onDone) => {
      expect(getDeal().hold).toBe(true);
      onDone?.();
    });
    await startClickDeal(false);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.calls[0][0]).toBe(false);
    expect(getDeal().hold).toBe(false);
  });

  it("awaits the hook before the page scrolls, with the entrance held the whole time", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    setBeforeDealScroll(
      () =>
        new Promise<void>((resolve) => {
          order.push("hook");
          release = () => {
            order.push("hook done");
            resolve();
          };
        }),
    );
    scroll.mockImplementationOnce((_reduced, onDone) => {
      order.push("scroll");
      onDone?.();
    });
    const click = startClickDeal(false);
    await Promise.resolve();
    expect(order).toEqual(["hook"]);
    expect(getDeal().hold).toBe(true);
    expect(scroll).not.toHaveBeenCalled();
    release();
    await click;
    expect(order).toEqual(["hook", "hook done", "scroll"]);
    expect(getDeal().hold).toBe(false);
  });

  it("still scrolls when the hook fails", async () => {
    setBeforeDealScroll(() => Promise.reject(new Error("spin failed")));
    await startClickDeal(false);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("clears the hook with the cleanup it returned", async () => {
    const hook = vi.fn(() => Promise.resolve());
    const clear = setBeforeDealScroll(hook);
    clear();
    await startClickDeal(false);
    expect(hook).not.toHaveBeenCalled();
  });

  it("deals at once and jumps under reduced motion, with no hook", async () => {
    const hook = vi.fn(() => Promise.resolve());
    setBeforeDealScroll(hook);
    await startClickDeal(true);
    expect(hook).not.toHaveBeenCalled();
    expect(scroll).toHaveBeenCalledWith(true);
    expect(getDeal()).toMatchObject({ phase: "dealt", spent: true });
  });

  it("only scrolls back once dealt, with no hook and no replay", async () => {
    dispatchDeal({ type: "skip" });
    const hook = vi.fn(() => Promise.resolve());
    setBeforeDealScroll(hook);
    const before = getDeal();
    await startClickDeal(false);
    expect(hook).not.toHaveBeenCalled();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(getDeal().entrances).toBe(before.entrances);
  });

  it("does nothing while the deal is under way", async () => {
    dispatchDeal({ type: "enter", source: "view" });
    await startClickDeal(false);
    expect(scroll).not.toHaveBeenCalled();
  });
});
