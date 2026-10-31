import { describe, expect, it } from "vitest";
import { mvpCentreShift } from "./mvpCentre";

describe("the MVP line's glide", () => {
  it("is half the width the full name adds, to the left", () => {
    expect(mvpCentreShift(27, 187)).toBe(-80);
    expect(mvpCentreShift(27.31, 180.5)).toBeCloseTo(-76.595, 6);
  });

  it("ends the whole sentence centred where the short one stood", () => {
    const [lead, short, full] = [86, 27, 187];
    const restCentre = (lead + short) / 2;
    const shift = mvpCentreShift(short, full);
    expect(shift + (lead + full) / 2).toBeCloseTo(restCentre, 9);
  });

  it("is nothing where the full name is not drawn or not measured yet", () => {
    expect(mvpCentreShift(27, 0)).toBe(0);
    expect(mvpCentreShift(0, 0)).toBe(0);
    expect(mvpCentreShift(0, 187)).toBe(0);
    expect(mvpCentreShift(27, 27)).toBe(0);
    expect(mvpCentreShift(Number.NaN, 187)).toBe(0);
  });
});
