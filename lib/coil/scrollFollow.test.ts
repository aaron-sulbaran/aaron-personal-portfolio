import { describe, expect, it } from "vitest";
import { carryTransform, followable, followOffset, FOLLOW_RANGE_PX } from "./scrollFollow";

describe("the parked card's scroll follow", () => {
  it("leaves the card where it was drawn when the modal has not scrolled on, and moves it with the slot when it has", () => {
    expect(followOffset(0, 0)).toBe(0);
    expect(followOffset(240, 240)).toBe(0);
    expect(followOffset(0, 300)).toBe(-300);
    expect(followOffset(120, 420)).toBe(-300);
  });
  it("carries the layer by the scroll offset of the draw, to cancel the animation's own minus offset", () => {
    expect(carryTransform(0)).toBe("translateY(0px)");
    expect(carryTransform(412.5)).toBe("translateY(412.5px)");
  });
  it("covers a modal far taller than any card's", () => {
    expect(FOLLOW_RANGE_PX).toBeGreaterThan(20_000);
  });
  it("runs only where the browser has scroll-driven animations and the layer attached to the modal's timeline", () => {
    expect(followable(true, true)).toBe(true);
    expect(followable(true, false)).toBe(false);
    expect(followable(false, true)).toBe(false);
  });
});
