import { describe, expect, it } from "vitest";
import { compositionFor, inputFor, sameDrivers, selectDrivers } from "@/lib/coil/drivers";

const desktop = { width: 1440, height: 900 };

describe("drivers", () => {
  it("composes by aspect: narrow under 0.8 width to height", () => {
    expect(compositionFor(desktop)).toBe("wide");
    expect(compositionFor({ width: 390, height: 844 })).toBe("narrow");
    expect(compositionFor({ width: 768, height: 1024 })).toBe("narrow");
    expect(compositionFor({ width: 1024, height: 768 })).toBe("wide");
    expect(compositionFor({ width: 800, height: 1000 })).toBe("wide");
    expect(compositionFor({ width: 799, height: 1000 })).toBe("narrow");
    expect(compositionFor({ width: 500, height: 0 })).toBe("wide");
  });

  it("drives input by capability: only a fine, hovering pointer gets hover and wheel capture", () => {
    expect(inputFor(true, true)).toBe("fine");
    expect(inputFor(true, false)).toBe("coarse");
    expect(inputFor(false, true)).toBe("coarse");
    expect(inputFor(false, false)).toBe("coarse");
  });

  it("keeps composition and input independent (a narrow desktop window stays fine)", () => {
    expect(selectDrivers({ viewport: { width: 600, height: 900 }, finePointer: true, canHover: true, reducedMotion: false })).toEqual({
      composition: "narrow",
      input: "fine",
      scene: true,
    });
    expect(selectDrivers({ viewport: { width: 1180, height: 820 }, finePointer: false, canHover: false, reducedMotion: false })).toEqual({
      composition: "wide",
      input: "coarse",
      scene: true,
    });
  });

  it("renders no scene under reduced motion", () => {
    expect(selectDrivers({ viewport: desktop, finePointer: true, canHover: true, reducedMotion: true }).scene).toBe(false);
  });

  it("compares by value", () => {
    const a = selectDrivers({ viewport: desktop, finePointer: true, canHover: true, reducedMotion: false });
    const b = selectDrivers({ viewport: { width: 1920, height: 1080 }, finePointer: true, canHover: true, reducedMotion: false });
    expect(sameDrivers(a, b)).toBe(true);
    expect(sameDrivers(a, { ...b, scene: false })).toBe(false);
  });
});
