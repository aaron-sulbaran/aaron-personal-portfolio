import { describe, expect, it } from "vitest";
import { AHEAD_TOP, ISLE, ISLE_LINE } from "./constants";
import { cornerRadius, ghostOpacity, isleBox, lerpBox, toBox, zoneFrom } from "./zone";

const VH = 900;

describe("the zone from the two scroll reads", () => {
  it("is past first, then ahead, else in", () => {
    expect(zoneFrom(true, true)).toBe("past");
    expect(zoneFrom(true, false)).toBe("past");
    expect(zoneFrom(false, true)).toBe("ahead");
    expect(zoneFrom(false, false)).toBe("in");
  });

  it("hands off at 0.4 of the viewport, with the band ahead until its top reaches three quarters", () => {
    expect(ISLE_LINE).toBe(0.4);
    expect(AHEAD_TOP).toBe(0.75);
  });
});

describe("the boxes the hand-off travels between", () => {
  it("puts the isle on the pill's dock: 24px from the left and 54px up, the collapsed pill's size", () => {
    const box = isleBox(VH);
    expect(box.left).toBe(ISLE.insetPx);
    expect(box.top + box.height).toBe(VH - ISLE.bottomPx);
    expect(box.height).toBe(54);
    expect(box.width).toBe(252);
    expect(ISLE.openWidthPx).toBeGreaterThan(ISLE.widthPx);
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
    expect(cornerRadius(22, { left: 0, top: 0, width: 252, height: 36 })).toBe(18);
    expect(cornerRadius(27, { left: 0, top: 0, width: 252, height: 54 })).toBe(27);
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
