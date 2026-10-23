import { describe, expect, it } from "vitest";
import { landingColors } from "@/lib/home/loaderLanding";

describe("what the loader's lockup wears as it lands", () => {
  const target = { gradient: { top: 80, height: 120, from: [200, 220, 240], to: [100, 140, 180] }, inkAlpha: 0.264 } as const;

  it("wears the middle of the composite's gradient on the name, at the letters' ink", () => {
    const colors = landingColors(target);
    expect(colors.name).toBe("rgb(150, 180, 210)");
    expect(colors.nameOpacity).toBeCloseTo(0.264, 9);
  });

  it("wears the gradient's top colour, solid, on the greeting above it", () => {
    expect(landingColors(target).greeting).toBe("rgb(200, 220, 240)");
  });

  it("holds the ink to 0 through 1 and the bytes to 0 through 255", () => {
    expect(landingColors({ ...target, inkAlpha: 3 }).nameOpacity).toBe(1);
    expect(landingColors({ ...target, inkAlpha: -1 }).nameOpacity).toBe(0);
    expect(landingColors({ ...target, gradient: { ...target.gradient, from: [300, -5, 10], to: [300, -5, 10] } }).name).toBe("rgb(255, 0, 10)");
  });
});
