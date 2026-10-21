import { describe, expect, it } from "vitest";
import { fitScale, frameSize } from "./frameFit";

describe("the preview frame's fit", () => {
  it("scales a desktop frame down to fit a narrow room, by width", () => {
    expect(fitScale({ width: 1056, height: 800 }, "desktop")).toBeCloseTo(1056 / 1440);
  });

  it("never scales past life size", () => {
    expect(fitScale({ width: 2400, height: 1200 }, "desktop")).toBe(1);
    expect(fitScale({ width: 600, height: 1600 }, "phone")).toBe(1);
  });

  it("fits a phone by height", () => {
    expect(fitScale({ width: 900, height: 600 }, "phone")).toBeCloseTo(600 / 844);
  });

  it("keeps a 1440px layout in a narrow room and fills the room's height after scaling", () => {
    const size = frameSize({ width: 1056, height: 800 }, "desktop");
    expect(size.width).toBe(1440);
    expect(size.height * size.scale).toBeCloseTo(800);
    expect(size.width * size.scale).toBeCloseTo(1056);
  });

  it("follows the room's real width when it is wider than 1440", () => {
    expect(frameSize({ width: 1800, height: 900 }, "desktop")).toEqual({ width: 1800, height: 900, scale: 1 });
  });

  it("holds a phone at 390 by 844", () => {
    expect(frameSize({ width: 900, height: 1000 }, "phone")).toEqual({ width: 390, height: 844, scale: 1 });
  });

  it("falls back to life size before the room is measured", () => {
    expect(fitScale({ width: 0, height: 0 }, "desktop")).toBe(1);
  });
});
