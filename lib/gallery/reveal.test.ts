import { describe, expect, it } from "vitest";
import { clipIn, clipOut, textIn, textOut } from "./reveal";

// Sides of an inset(top right bottom left) clip, in percent of the box.
const insets = (clip: string) => {
  const [top, right, bottom, left] = clip.replace(/^inset\(|\)$/g, "").split(" ").map((n) => Number.parseFloat(n));
  return { top, right, bottom, left };
};
const mirror = (clip: string) => {
  const { top, right, bottom, left } = insets(clip);
  return `inset(${top}% ${left}% ${bottom}% ${right}%)`;
};
const hidden = (clip: string) => {
  const { right, left } = insets(clip);
  return right + left >= 100;
};
const visible = (clip: string) => {
  const { right, left } = insets(clip);
  return right <= 0 && left <= 0;
};

describe("the sideways clips", () => {
  it("left to right are the text masks as they are", () => {
    expect(clipIn("ltr")).toEqual({ from: textIn("ltr").from.clipPath, to: textIn("ltr").to.clipPath });
    expect(clipOut("ltr")).toEqual({ from: textOut("ltr").from.clipPath, to: textOut("ltr").to.clipPath });
  });

  it("right to left are their exact mirrors", () => {
    for (const make of [clipIn, clipOut]) {
      expect(make("rtl").from).toBe(mirror(make("ltr").from));
      expect(make("rtl").to).toBe(mirror(make("ltr").to));
    }
  });

  it("start fully hidden and end fully visible coming in, and the reverse going out, in both directions", () => {
    for (const direction of ["ltr", "rtl"] as const) {
      expect(hidden(clipIn(direction).from), `${direction} in starts hidden`).toBe(true);
      expect(visible(clipIn(direction).to), `${direction} in ends visible`).toBe(true);
      expect(visible(clipOut(direction).from), `${direction} out starts visible`).toBe(true);
      expect(hidden(clipOut(direction).to), `${direction} out ends hidden`).toBe(true);
    }
  });

  it("leave room above and below for ink, and open from opposite edges", () => {
    for (const direction of ["ltr", "rtl"] as const) {
      expect(insets(clipIn(direction).to).top).toBeLessThan(0);
      expect(insets(clipIn(direction).to).bottom).toBeLessThan(0);
    }
    expect(insets(clipIn("ltr").from).right).toBeGreaterThan(0);
    expect(insets(clipIn("rtl").from).left).toBeGreaterThan(0);
  });

  it("a block that goes out and comes back in the same direction meets itself at the same edge", () => {
    for (const direction of ["ltr", "rtl"] as const) expect(clipOut(direction).from).toBe(clipIn(direction).to);
  });
});
