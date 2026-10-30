import { describe, expect, it } from "vitest";
import { maskGrid, wholePxBox } from "./pixelGrid";
import { paintedBaseline } from "./lineAnchor";

// The fill's canvas on whole px, its mask on the buffer's own grid, and the
// baseline the page paints a line on.
describe("wholePxBox", () => {
  it("rounds each edge of the host's box to a whole px in the page's coordinates and says where that is inside the host", () => {
    // Page 1's name at 1280 before the grid was on whole px: the host at 38.40625, 89.609375.
    const box = wholePxBox({ left: 38.40625, top: 89.609375, right: 475.703125, bottom: 274.421875 }, { x: 0, y: 0 });
    expect(box).toEqual({ left: 38, top: 90, width: 438, height: 184, inHost: { left: 38 - 38.40625, top: 90 - 89.609375 } });
  });

  it("counts in the page's coordinates, so a scroll of a fraction does not move it off the grid", () => {
    const box = wholePxBox({ left: 10.25, top: -500.25, right: 110.75, bottom: -400.25 }, { x: 0, y: 1000.5 });
    expect(box.top + 1000.5).toBe(Math.round(-500.25 + 1000.5));
    expect(box.left).toBe(10);
    expect(box.width).toBe(101);
    expect(box.height).toBe(100);
  });

  it("is never empty", () => {
    expect(wholePxBox({ left: 3.4, top: 3.4, right: 3.45, bottom: 3.45 }, { x: 0, y: 0 })).toMatchObject({ width: 1, height: 1 });
  });
});

describe("maskGrid", () => {
  it("grows the mask's rect to whole buffer pixels, so a texel is a buffer pixel", () => {
    const { px, rect } = maskGrid({ x: 33.3, y: 10.26, w: 100.1, h: 40.2 }, 2);
    expect(px).toEqual({ x: 66, y: 20, w: 201, h: 81 });
    expect(rect).toEqual({ x: 33, y: 10, w: 100.5, h: 40.5 });
    expect(rect.x).toBeLessThanOrEqual(33.3);
    expect(rect.x + rect.w).toBeGreaterThanOrEqual(133.4);
  });

  it("at 1x the grid is the CSS px", () => {
    expect(maskGrid({ x: 0.5, y: 0.5, w: 10, h: 10 }, 1).rect).toEqual({ x: 0, y: 0, w: 11, h: 11 });
  });
});

describe("paintedBaseline", () => {
  // Page 1's name, 1440 by 900 at 2x on a Mac (Chrome lays out in CSS px there): the layout's
  // baseline 249.59375, its text box's top 131.59375, painted on 250 (measured).
  it("moves the layout's baseline as the text box's top is rounded", () => {
    expect(paintedBaseline({ x: 100, y: 249.59375, top: 131.59375 }, 0, 1)).toBe(250);
    // 1100 wide: the box top 130.375 rounds down, and the baseline with it (measured 220).
    expect(paintedBaseline({ x: 66, y: 220.375, top: 130.375 }, 0, 1)).toBe(220);
  });

  it("rounds in the page's coordinates, and in device px where the page lays out in them", () => {
    expect(paintedBaseline({ x: 0, y: 99.75, top: 9.75 }, 0.5, 1)).toBe(99.5);
    expect(paintedBaseline({ x: 0, y: 99.75, top: 9.75 }, 0, 2)).toBe(100);
  });

  it("leaves a baseline whose text box is on a whole px where it is", () => {
    expect(paintedBaseline({ x: 0, y: 236, top: 131 }, 0, 1)).toBe(236);
  });
});
