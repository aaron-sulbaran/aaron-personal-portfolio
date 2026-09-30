import { describe, expect, it } from "vitest";
import {
  FONT_ITEMS,
  LOAD_WEIGHTS,
  LOADER,
  SCENE_ITEMS,
  createLoadTally,
  displayPercent,
  slowDelay,
} from "@/lib/loader/progress";

describe("load tally", () => {
  it("weighs each item and reaches 1 only when every item resolved", () => {
    const tally = createLoadTally({ items: SCENE_ITEMS, startMs: 0 });
    expect(tally.progress()).toBe(0);
    tally.report("fonts");
    expect(tally.progress()).toBeCloseTo(LOAD_WEIGHTS.fonts, 6);
    tally.report("chunk");
    tally.report("textures", 0.5);
    expect(tally.progress()).toBeCloseTo(LOAD_WEIGHTS.fonts + LOAD_WEIGHTS.chunk + LOAD_WEIGHTS.textures / 2, 6);
    tally.report("textures", 1);
    expect(tally.done()).toBe(false);
    expect(tally.progress()).toBeLessThan(1);
    expect(displayPercent(tally.progress(), tally.done())).toBeLessThan(100);
    tally.report("frame");
    expect(tally.done()).toBe(true);
    expect(tally.progress()).toBe(1);
    expect(displayPercent(tally.progress(), tally.done())).toBe(100);
  });

  it("never runs backwards", () => {
    const tally = createLoadTally({ items: SCENE_ITEMS, startMs: 0 });
    let last = 0;
    const steps: [Parameters<typeof tally.report>[0], number][] = [
      ["textures", 0.4],
      ["textures", 0.2],
      ["chunk", 1],
      ["textures", 0.3],
      ["fonts", 1],
      ["textures", 0.9],
      ["frame", 1],
      ["textures", 1],
    ];
    steps.forEach(([item, fraction]) => {
      tally.report(item, fraction);
      const now = tally.progress();
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    });
    expect(last).toBe(1);
  });

  it("stays under 100 on the display while one item is nearly done", () => {
    const tally = createLoadTally({ items: SCENE_ITEMS, startMs: 0 });
    tally.settle(["fonts", "chunk", "frame"]);
    tally.report("textures", 0.9999);
    expect(tally.done()).toBe(false);
    expect(displayPercent(tally.progress(), tally.done())).toBe(99);
  });

  it("ignores items it does not track (the reduced tally is fonts only)", () => {
    const tally = createLoadTally({ items: FONT_ITEMS, startMs: 0 });
    tally.report("chunk");
    tally.report("frame");
    expect(tally.progress()).toBe(0);
    tally.report("fonts");
    expect(tally.done()).toBe(true);
    expect(tally.progress()).toBe(1);
  });

  it("gives up at 6s and still completes", () => {
    const tally = createLoadTally({ items: SCENE_ITEMS, startMs: 1000 });
    let heard = 0;
    tally.subscribe(() => {
      heard += 1;
    });
    tally.report("fonts");
    tally.check(1000 + LOADER.giveUpMs - 1);
    expect(tally.done()).toBe(false);
    tally.check(1000 + LOADER.giveUpMs);
    expect(tally.done()).toBe(true);
    expect(tally.gaveUp()).toBe(true);
    expect(tally.progress()).toBe(1);
    expect(heard).toBe(2);
  });

  it("does not give up once everything resolved in time", () => {
    const tally = createLoadTally({ items: FONT_ITEMS, startMs: 0 });
    tally.report("fonts");
    tally.check(LOADER.giveUpMs * 2);
    expect(tally.gaveUp()).toBe(false);
  });

  it("notifies only on real changes", () => {
    const tally = createLoadTally({ items: SCENE_ITEMS, startMs: 0 });
    let heard = 0;
    tally.subscribe(() => {
      heard += 1;
    });
    tally.report("chunk");
    tally.report("chunk");
    tally.report("textures", 0.5);
    tally.report("textures", 0.25);
    expect(heard).toBe(2);
  });
});

describe("slow debug schedule", () => {
  it("delays an item to its slot and never below zero", () => {
    expect(slowDelay("chunk", 1, 0)).toBe(1100);
    expect(slowDelay("chunk", 1, 5000)).toBe(0);
    expect(slowDelay("textures", 0, 0)).toBe(1300);
    expect(slowDelay("textures", 1, 0)).toBe(2700);
  });
});
