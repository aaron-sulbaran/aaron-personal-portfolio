import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DUCK_ALPHA } from "./duck";
import { blendOver, contrastRatio, hexToRgb } from "./contrast";

// Reads the token hexes from globals.css so a palette change fails here first.
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const token = (block: string, name: string) => {
  const scope = block === "light" ? css.split("[data-theme=\"dark\"]")[0] : css.slice(css.indexOf("[data-theme=\"dark\"]"));
  const m = scope.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found in ${block}`);
  return hexToRgb(m[1]);
};

describe("ducked dots keep muted body text readable", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: muted text on the darkest ducked dot is at least 4.5 to 1`, () => {
      const bg = token(theme, "--color-background");
      const text = token(theme, "--color-muted");
      const dot = blendOver(bg, token(theme, "--color-muted"), DUCK_ALPHA[theme]);
      const dotAccent = blendOver(bg, token(theme, "--color-accent"), DUCK_ALPHA[theme]);
      expect(contrastRatio(text, dot)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(text, dotAccent)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("contrastRatio matches WCAG for black on white", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });
});
