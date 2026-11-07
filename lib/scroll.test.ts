import { describe, expect, it } from "vitest";
import { JUMP, jumpIsShort, sectionRestY } from "./scroll";

describe("a section jump's resting place", () => {
  it("is the section's top less its scroll margin", () => {
    // #connect at 230px in view from scrollY 2721, with a 96px margin: rest at 2855.
    expect(sectionRestY({ top: 230, scrollY: 2721, marginTop: 96, maxScroll: 3206 })).toBe(2855);
  });

  it("stops at the page's end when the section sits too low to reach the top", () => {
    expect(sectionRestY({ top: 600, scrollY: 2900, marginTop: 96, maxScroll: 3206 })).toBe(3206);
  });

  it("never goes above the top of the page", () => {
    expect(sectionRestY({ top: -40, scrollY: 20, marginTop: 96, maxScroll: 3206 })).toBe(0);
  });
});

describe("a jump that rested short", () => {
  it("is short when the page shifted above the section on the way", () => {
    expect(jumpIsShort(2855, 2721)).toBe(true);
  });

  it("is not short within the tolerance, so a subpixel rest never scrolls again", () => {
    expect(jumpIsShort(2855, 2855 - JUMP.tolerancePx)).toBe(false);
    expect(jumpIsShort(2855.4, 2855)).toBe(false);
  });
});
