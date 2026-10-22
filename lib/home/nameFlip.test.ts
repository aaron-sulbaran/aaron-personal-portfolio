import { describe, expect, it } from "vitest";
import {
  LOADER_LOCKUP,
  NAME_ADVANCE_EM,
  NAME_POSITIONS,
  applyFlip,
  centerOf,
  flipTransform,
  headingRect,
  loaderLockupRect,
  loaderNameSizePx,
  travelPx,
  type HeadingLayout,
  type NamePosition,
  type Rect,
} from "@/lib/home/nameFlip";

// A lockup is the name's advance wide and a little over a name tall (the greeting rides above).
const LOCKUP_EM = { width: NAME_ADVANCE_EM, height: 1.3 };
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

// A heading at a size the page would set: the name 13vw wide at most 208px.
function layoutFor(viewport: { width: number; height: number }): HeadingLayout {
  const size = Math.min(208, Math.max(76, viewport.width * 0.24));
  const gridWidth = Math.min(1240, viewport.width * 0.88);
  return {
    stage: { width: viewport.width, height: viewport.height * 0.62 },
    heading: { width: LOCKUP_EM.width * size, height: LOCKUP_EM.height * size },
    grid: { left: (viewport.width - gridWidth) / 2, width: gridWidth },
    topInsetPx: 112,
  };
}

describe("the loader's shrink", () => {
  it("carries the lockup's rect exactly onto the heading's, whatever the position", () => {
    for (const viewport of SIZES) {
      const from = loaderLockupRect(viewport, LOCKUP_EM);
      const layout = layoutFor(viewport);
      for (const position of NAME_POSITIONS) {
        const to = headingRect(position, layout);
        const landed = applyFlip(from, flipTransform(from, to));
        expect(landed.left).toBeCloseTo(to.left, 6);
        expect(landed.top).toBeCloseTo(to.top, 6);
        expect(landed.width).toBeCloseTo(to.width, 6);
        expect(landed.height).toBeCloseTo(to.height, 6);
      }
    }
  });

  it("is a shrink, never a growth, at every size and position", () => {
    for (const viewport of SIZES) {
      const from = loaderLockupRect(viewport, LOCKUP_EM);
      for (const position of NAME_POSITIONS) {
        const flip = flipTransform(from, headingRect(position, layoutFor(viewport)));
        expect(flip.scale, `${position} at ${viewport.width}`).toBeGreaterThan(0);
        expect(flip.scale, `${position} at ${viewport.width}`).toBeLessThanOrEqual(1);
      }
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
});

describe("where each position puts the heading", () => {
  const layout = layoutFor({ width: 1440, height: 900 });

  it("centers it across and down the stage for center", () => {
    const rect = headingRect("center", layout);
    expect(centerOf(rect).x).toBeCloseTo(layout.stage.width / 2, 6);
    expect(centerOf(rect).y).toBeCloseTo(layout.stage.height / 2, 6);
  });

  it("centers it across and puts it under the logo row for top", () => {
    const rect = headingRect("top", layout);
    expect(centerOf(rect).x).toBeCloseTo(layout.stage.width / 2, 6);
    expect(rect.top).toBe(layout.topInsetPx);
  });

  it("starts it on the content column's left edge for topLeft", () => {
    const rect = headingRect("topLeft", layout);
    expect(rect.left).toBe(layout.grid.left);
    expect(rect.top).toBe(layout.topInsetPx);
  });

  it("keeps the heading inside the stage in every position", () => {
    for (const viewport of SIZES) {
      const l = layoutFor(viewport);
      for (const position of NAME_POSITIONS) {
        const rect = headingRect(position, l);
        expect(rect.left, `${position} at ${viewport.width}`).toBeGreaterThanOrEqual(0);
        expect(rect.left + rect.width, `${position} at ${viewport.width}`).toBeLessThanOrEqual(l.stage.width + 0.001);
        expect(rect.top, `${position} at ${viewport.width}`).toBeGreaterThanOrEqual(0);
        expect(rect.top + rect.height, `${position} at ${viewport.width}`).toBeLessThanOrEqual(l.stage.height + 0.001);
      }
    }
  });

  it("makes the lockup travel least for center and most for topLeft on a desktop", () => {
    const viewport = { width: 1440, height: 900 };
    const from = loaderLockupRect(viewport, LOCKUP_EM);
    const l = layoutFor(viewport);
    const travel = (position: NamePosition) => travelPx(from, headingRect(position, l));
    expect(travel("center")).toBeLessThan(travel("top"));
    expect(travel("top")).toBeLessThan(travel("topLeft"));
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
