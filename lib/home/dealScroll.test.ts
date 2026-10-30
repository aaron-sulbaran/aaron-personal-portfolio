import { describe, expect, it } from "vitest";
import { dealScrollSeconds } from "./dealScroll";

describe("the deal's scroll", () => {
  it("jumps under reduced motion", () => {
    expect(dealScrollSeconds(900, true)).toBe(0);
  });

  it("takes longer for a longer way, within a floor and a ceiling", () => {
    expect(dealScrollSeconds(200, false)).toBe(0.6);
    expect(dealScrollSeconds(1800, false)).toBe(1);
    expect(dealScrollSeconds(9000, false)).toBe(1.4);
    expect(dealScrollSeconds(-1800, false)).toBe(1);
  });
});

describe("the deal's own scroll, while it moves the page", () => {
  it("is moving from the hand leg's first tick to its end, and not after a kill", async () => {
    const { gsap } = await import("@/lib/gsap");
    const { addHandScroll, dealScrollMoving } = await import("./dealScroll");
    const writes: number[] = [];
    const host = globalThis as unknown as { window?: { scrollTo: (o: { top: number }) => void } };
    const before = host.window;
    host.window = { scrollTo: ({ top }) => void writes.push(top) };
    try {
      const plan = { durationMs: 1000, startVelocity: 0, ease: (p: number) => p };
      const master = gsap.timeline({ paused: true });
      master.to({ ms: 0 }, { ms: 2000, duration: 2, ease: "none" }, 0);
      const leg = addHandScroll(master, plan, 100, 500);
      expect(dealScrollMoving()).toBe(false);
      master.progress(0.25);
      expect(dealScrollMoving()).toBe(true);
      expect(writes.at(-1)).toBeCloseTo(300, 6);
      master.progress(0.75);
      expect(dealScrollMoving()).toBe(false);
      expect(writes.at(-1)).toBe(500);
      const again = gsap.timeline({ paused: true });
      again.to({ ms: 0 }, { ms: 2000, duration: 2, ease: "none" }, 0);
      const second = addHandScroll(again, plan, 100, 500);
      again.progress(0.1);
      expect(dealScrollMoving()).toBe(true);
      second.kill();
      expect(dealScrollMoving()).toBe(false);
      leg.kill();
    } finally {
      host.window = before;
    }
  });
});
