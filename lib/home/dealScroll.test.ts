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
