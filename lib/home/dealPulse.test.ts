import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { pulseGeometry } from "@/lib/home/dealPulse";

describe("the click's ring", () => {
  const box = { left: -77, top: 1000, width: 1434, height: 280 };
  const button = { left: 546, top: 1210, width: 180, height: 44 };

  it("is centered on the button's middle, from the box's corner", () => {
    const { x, y } = pulseGeometry(button, box);
    expect(x).toBe(546 + 90 + 77);
    expect(y).toBe(1210 + 22 - 1000);
  });

  it("grows past the strip's farther side, so it crosses the whole strip at any width", () => {
    for (const width of [390, 1280, 2560]) {
      const wide = { left: 0, top: 0, width, height: 260 };
      const mid = { left: width / 2 - 90, top: 190, width: 180, height: 44 };
      const { x, size } = pulseGeometry(mid, wide);
      for (const edge of [0, width]) expect(size / 2).toBeGreaterThanOrEqual(Math.abs(edge - x) - 1);
    }
  });

  it("is one whole ellipse: its top stops at the strip's top, and it is never rounder than 0.9 of its width", () => {
    for (const width of [390, 1280, 2560]) {
      const wide = { left: 0, top: 0, width, height: 260 };
      const mid = { left: width / 2 - 90, top: 190, width: 180, height: 44 };
      const { y, size, height } = pulseGeometry(mid, wide);
      expect(y - height / 2, `its top at ${width} wide`).toBeGreaterThanOrEqual(-1);
      expect(height / size, `its roundness at ${width} wide`).toBeLessThanOrEqual(0.9 + 0.01);
    }
  });

  it("reads the click's numbers from the constants: a press of 0.97 and a visible ring", () => {
    expect(COIL.deal.click.pressScale).toBe(0.97);
    expect(COIL.deal.click.ringStrength).toBeGreaterThan(0);
    expect(COIL.deal.click.ringMs).toBeGreaterThanOrEqual(500);
  });
});
