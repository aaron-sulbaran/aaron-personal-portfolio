import { describe, expect, it } from "vitest";
import { AHEAD_TOP, barBox, BAR, cornerRadius, ghostOpacity, ISLE, isleBox, lerpBox, toBox, zoneOf } from "./zone";

const VH = 900;

describe("the band's zone against the hand-off line", () => {
  it("is past once the band's bottom edge has risen to the line", () => {
    expect(zoneOf({ top: -300, bottom: 0.4 * VH }, VH, 0.4)).toBe("past");
    expect(zoneOf({ top: -500, bottom: -200 }, VH, 0.4)).toBe("past");
  });

  it("is in while the band is on screen below the line", () => {
    expect(zoneOf({ top: 100, bottom: 400 }, VH, 0.4)).toBe("in");
    expect(zoneOf({ top: 300, bottom: 600 }, VH, 0.4)).toBe("in");
  });

  it("is ahead while the band is still below the fold", () => {
    expect(zoneOf({ top: AHEAD_TOP * VH, bottom: AHEAD_TOP * VH + 300 }, VH, 0.4)).toBe("ahead");
    expect(zoneOf({ top: 2000, bottom: 2300 }, VH, 0.4)).toBe("ahead");
  });

  it("moves the past boundary with the line", () => {
    const rect = { top: -100, bottom: 200 };
    expect(zoneOf(rect, VH, 0.1)).toBe("in");
    expect(zoneOf(rect, VH, 0.3)).toBe("past");
  });
});

describe("the boxes the hand-off travels between", () => {
  it("puts the isle on the pill's dock: 24px from the left and 54px up", () => {
    const box = isleBox(VH);
    expect(box.left).toBe(ISLE.insetPx);
    expect(box.top + box.height).toBe(VH - ISLE.bottomPx);
    expect(box.height).toBe(36);
  });

  it("spans the phone's width in the bar, 12px in from each side", () => {
    const box = barBox(390, 844);
    expect(box.width).toBe(390 - 2 * BAR.insetPx);
    expect(box.top + box.height).toBe(844 - BAR.bottomPx);
  });

  it("interpolates a box and lands exactly on the ends", () => {
    const from = { left: 800, top: 40, width: 560, height: 240 };
    const to = isleBox(VH);
    expect(lerpBox(from, to, 0)).toEqual(from);
    expect(lerpBox(from, to, 1)).toEqual(to);
    expect(lerpBox(from, to, 0.5).width).toBeCloseTo((560 + ISLE.widthPx) / 2);
  });

  it("reads a rect into a box", () => {
    expect(toBox({ left: 1, top: 2, width: 3, height: 4 })).toEqual({ left: 1, top: 2, width: 3, height: 4 });
  });

  it("rounds the corners no further than a full pill of the box's height", () => {
    expect(cornerRadius(22, { left: 0, top: 0, width: 190, height: 36 })).toBe(18);
    expect(cornerRadius(22, { left: 0, top: 0, width: 560, height: 240 })).toBe(22);
  });
});

describe("the pill's ghost inside the travelling glass", () => {
  it("is absent while the glass is the card and fully in by the isle", () => {
    expect(ghostOpacity(0)).toBe(0);
    expect(ghostOpacity(0.6)).toBe(0);
    expect(ghostOpacity(1)).toBe(1);
  });

  it("rises steadily between", () => {
    expect(ghostOpacity(0.8)).toBeCloseTo(0.5);
    expect(ghostOpacity(0.7)).toBeLessThan(ghostOpacity(0.9));
  });
});
