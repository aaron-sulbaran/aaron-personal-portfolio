import { describe, expect, it } from "vitest";
import { LOGO_CLEAR_PAD_PX, wordsUnderLogo, type Box } from "./logoClear";

// The logo at 1440: 40px square, 24px in and 16px down.
const LOGO: Box = { left: 24, top: 16, right: 64, bottom: 56 };
const row = (top: number, left = 32, width = 198, height = 40): Box => ({ left, top, right: left + width, bottom: top + height });

describe("wordsUnderLogo", () => {
  it("is true while a title of page 2's list crosses the logo", () => {
    expect(wordsUnderLogo(LOGO, [row(18)])).toBe(true);
    expect(wordsUnderLogo(LOGO, [row(-20)])).toBe(true);
  });

  it("is false once the list is clear of the logo, above or below", () => {
    expect(wordsUnderLogo(LOGO, [row(200)])).toBe(false);
    expect(wordsUnderLogo(LOGO, [row(-100)])).toBe(false);
  });

  it("steps aside a few pixels before the words touch the logo", () => {
    expect(wordsUnderLogo(LOGO, [row(LOGO.bottom + LOGO_CLEAR_PAD_PX - 1)])).toBe(true);
    expect(wordsUnderLogo(LOGO, [row(LOGO.bottom + LOGO_CLEAR_PAD_PX)])).toBe(false);
  });

  it("ignores a column that is level with the logo but beside it, like page 2's Builds column", () => {
    expect(wordsUnderLogo(LOGO, [row(18, 1235)])).toBe(false);
  });

  it("ignores a box with no area, the hidden copy of the title in the other layout", () => {
    expect(wordsUnderLogo(LOGO, [{ left: 0, top: 0, right: 0, bottom: 0 }])).toBe(false);
    expect(wordsUnderLogo(LOGO, [row(18, 32, 0)])).toBe(false);
  });

  it("is true when any one of several parts is under it", () => {
    expect(wordsUnderLogo(LOGO, [row(400), row(18), row(800)])).toBe(true);
    expect(wordsUnderLogo(LOGO, [])).toBe(false);
  });
});
