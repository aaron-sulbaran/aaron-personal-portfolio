import { describe, expect, it } from "vitest";
import { LOADER_LOCKUP, NAME_ADVANCE_EM, applyFlip, centerOf, flipTransform, loaderLockupRect, loaderNameSizePx, travelPx, type Rect } from "@/lib/home/nameFlip";

// A lockup is the name's advance wide and a little over a name tall (the greeting rides above).
const LOCKUP_EM = { width: NAME_ADVANCE_EM, height: 1.3 };
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

// The first screen's lockup at the size the page sets (10vw on a desktop, 12vw on a phone), top left of the name's column.
function placeFor(viewport: { width: number; height: number }): Rect {
  const size = viewport.width >= 768 ? Math.min(192, Math.max(48, viewport.width * 0.1)) : Math.min(192, Math.max(48, viewport.width * 0.12));
  return { left: viewport.width * 0.06, top: 84, width: LOCKUP_EM.width * size, height: LOCKUP_EM.height * size };
}

describe("the loader's shrink", () => {
  it("carries the lockup's rect exactly onto the name's place on the first screen", () => {
    for (const viewport of SIZES) {
      const from = loaderLockupRect(viewport, LOCKUP_EM);
      const to = placeFor(viewport);
      const landed = applyFlip(from, flipTransform(from, to));
      expect(landed.left).toBeCloseTo(to.left, 6);
      expect(landed.top).toBeCloseTo(to.top, 6);
      expect(landed.width).toBeCloseTo(to.width, 6);
      expect(landed.height).toBeCloseTo(to.height, 6);
    }
  });

  it("is a shrink, never a growth, at every size", () => {
    for (const viewport of SIZES) {
      const flip = flipTransform(loaderLockupRect(viewport, LOCKUP_EM), placeFor(viewport));
      expect(flip.scale, `at ${viewport.width}`).toBeGreaterThan(0);
      expect(flip.scale, `at ${viewport.width}`).toBeLessThanOrEqual(1);
    }
  });

  it("leaves the lockup where it is when it already is the heading", () => {
    const rect: Rect = { left: 10, top: 20, width: 300, height: 90 };
    expect(flipTransform(rect, rect)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("never divides by an empty lockup", () => {
    const flip = flipTransform({ left: 0, top: 0, width: 0, height: 0 }, { left: 5, top: 6, width: 100, height: 30 });
    expect(Number.isFinite(flip.scale)).toBe(true);
    expect(flip).toEqual({ x: 5, y: 6, scale: 1 });
  });

  it("measures how far the lockup's middle travels", () => {
    expect(travelPx({ left: 0, top: 0, width: 100, height: 40 }, { left: 30, top: 40, width: 100, height: 40 })).toBeCloseTo(50, 6);
  });
});

describe("the loader's lockup", () => {
  it("fills the width less a gutter on each side on a landscape screen", () => {
    const size = loaderNameSizePx({ width: 1440, height: 900 });
    expect(size).toBeLessThanOrEqual(900 * LOADER_LOCKUP.maxHeightShare);
    const phone = loaderNameSizePx({ width: 390, height: 844 });
    expect(phone * 2.76636).toBeCloseTo(390 - 2 * LOADER_LOCKUP.gutterPx, 4);
  });

  it("stays at most the height share of a wide, short screen", () => {
    expect(loaderNameSizePx({ width: 2560, height: 800 })).toBeCloseTo(800 * LOADER_LOCKUP.maxHeightShare, 6);
  });

  it("sits in the middle of the screen", () => {
    for (const viewport of SIZES) {
      const rect = loaderLockupRect(viewport, LOCKUP_EM);
      expect(centerOf(rect).x).toBeCloseTo(viewport.width / 2, 6);
      expect(centerOf(rect).y).toBeCloseTo(viewport.height / 2, 6);
    }
  });
});
