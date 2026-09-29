import { describe, expect, it } from "vitest";
import { COIL } from "@/lib/coil/constants";
import { compositionFor, inputFor, sameDrivers, selectDrivers } from "@/lib/coil/drivers";
import { solveGeometry } from "@/lib/coil/geometry";

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

  it("composes phones and tablet portrait narrow: every card once, the relaxed axis, at most 6.2 per turn", () => {
    const panes = [
      { width: 360, height: 780 }, // small Android
      { width: 390, height: 844 }, // iPhone
      { width: 430, height: 932 }, // iPhone Pro Max
      { width: 412, height: 915 }, // Pixel
      { width: 768, height: 1024 }, // iPad portrait
    ];
    for (const viewport of panes) {
      expect(compositionFor(viewport)).toBe("narrow");
      const geo = solveGeometry(viewport, 14);
      expect(geo.narrow).toBe(true);
      expect(geo.slotCount).toBe(14);
      expect(geo.repeats).toBe(0);
      expect(geo.cardsPerTurn).toBeLessThanOrEqual(COIL.narrow.maxCardsPerTurn);
      expect(geo.axisRad).toBeCloseTo((COIL.axisDeg * COIL.narrow.axisFactor * Math.PI) / 180, 12);
      expect(geo.clearTopPx).toBe(COIL.narrow.headerClearPx + COIL.narrow.introBandPx);
    }
  });

  it("composes tablet landscape and phones on their side wide, repeats filling the pane", () => {
    for (const viewport of [{ width: 1024, height: 768 }, { width: 844, height: 390 }]) {
      expect(compositionFor(viewport)).toBe("wide");
      const geo = solveGeometry(viewport, 14);
      expect(geo.slotCount).toBeGreaterThanOrEqual(14);
      expect(geo.clearTopPx).toBe(0);
    }
  });
});
