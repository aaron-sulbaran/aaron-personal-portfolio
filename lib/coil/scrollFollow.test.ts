import { describe, expect, it } from "vitest";
import type { Quad } from "./geometry";
import { carryTransform, parkKey, wholeIn } from "./scrollFollow";

const slot = (top: number) => ({ left: 120, top, width: 240, height: 320 });

describe("the parked card's scroll follow", () => {
  it("carries the layer by the scroll offset the card was drawn at", () => {
    expect(carryTransform(0)).toBe("translateY(0px)");
    expect(carryTransform(412.5)).toBe("translateY(412.5px)");
  });
  it("keeps one key while the dialog scrolls the slot, and a new one when the slot moves in the content", () => {
    expect(parkKey(slot(200), 0, "a", false)).toBe(parkKey(slot(-100), 300, "a", false));
    expect(parkKey(slot(200.004), 0, "a", false)).toBe(parkKey(slot(200), 0, "a", false));
    expect(parkKey(slot(180), 0, "a", false)).not.toBe(parkKey(slot(200), 0, "a", false));
    expect(parkKey(slot(200), 0, "b", false)).not.toBe(parkKey(slot(200), 0, "a", false));
  });
  it("draws a clipped card again on every scroll", () => {
    expect(parkKey(slot(200), 0, "a", true)).not.toBe(parkKey(slot(-100), 300, "a", true));
  });
  it("calls a card whole only with every corner in the viewport", () => {
    const quad = (x: number, y: number): Quad => [
      { x, y },
      { x: x + 240, y },
      { x: x + 240, y: y + 320 },
      { x, y: y + 320 },
    ];
    expect(wholeIn(quad(100, 100), 1440, 900)).toBe(true);
    expect(wholeIn(quad(100, -1), 1440, 900)).toBe(false);
    expect(wholeIn(quad(100, 600), 1440, 900)).toBe(false);
    expect(wholeIn(quad(1300, 100), 1440, 900)).toBe(false);
  });
});
