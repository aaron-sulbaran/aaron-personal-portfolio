import { describe, expect, it } from "vitest";
import { highWater } from "@/lib/sections/highWater";

// Aaron, 2026-10-08: scrolling down masks a block in; scrolling back up leaves
// it where it got to. A block's reveal never decreases within a page load.

describe("the high-water mark", () => {
  it("rises with the trigger while the reader scrolls down", () => {
    expect(highWater(0.2, 0.5)).toEqual({ reached: 0.5, moved: true, done: false });
  });

  it("holds where it got to when the reader scrolls back up", () => {
    expect(highWater(0.6, 0.3)).toEqual({ reached: 0.6, moved: false, done: false });
    expect(highWater(0.6, 0)).toEqual({ reached: 0.6, moved: false, done: false });
  });

  it("does not restart the chase when the trigger comes back to the same mark", () => {
    expect(highWater(0.6, 0.6).moved).toBe(false);
  });

  it("climbs again only once the reader comes back down past the mark", () => {
    expect(highWater(0.6, 0.55).reached).toBe(0.6);
    expect(highWater(0.6, 0.7)).toEqual({ reached: 0.7, moved: true, done: false });
  });

  it("is done, so the trigger can be released, once the block is whole", () => {
    expect(highWater(0.9, 1)).toEqual({ reached: 1, moved: true, done: true });
    expect(highWater(1, 0.2)).toEqual({ reached: 1, moved: false, done: true });
  });

  it("clamps what the trigger reports to 0..1 and ignores a NaN", () => {
    expect(highWater(0.4, 1.3)).toEqual({ reached: 1, moved: true, done: true });
    expect(highWater(0.4, -0.2).reached).toBe(0.4);
    expect(highWater(0.4, Number.NaN)).toEqual({ reached: 0.4, moved: false, done: false });
  });
});
