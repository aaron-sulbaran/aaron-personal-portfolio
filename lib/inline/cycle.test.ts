import { describe, expect, it } from "vitest";
import { frameState, nextFrame, POP_CYCLE_MS } from "@/lib/inline/cycle";

describe("a cycling pop's beat", () => {
  it("changes photo every 1.6 seconds", () => {
    expect(POP_CYCLE_MS).toBe(1600);
  });
  it("steps through the frames in order and loops back to the first", () => {
    expect([0, 1, 2, 3].map((index) => nextFrame(index, 4))).toEqual([1, 2, 3, 0]);
    expect(nextFrame(0, 1)).toBe(0);
    expect(nextFrame(3, 0)).toBe(0);
  });
  it("keeps the photo being replaced whole under the one fading in, and hides the rest", () => {
    expect([0, 1, 2, 3].map((index) => frameState(index, 0, -1))).toEqual(["active", "idle", "idle", "idle"]);
    expect([0, 1, 2, 3].map((index) => frameState(index, 2, 1))).toEqual(["idle", "previous", "active", "idle"]);
    expect([0, 1, 2, 3].map((index) => frameState(index, 0, 3))).toEqual(["active", "idle", "idle", "previous"]);
  });
});
