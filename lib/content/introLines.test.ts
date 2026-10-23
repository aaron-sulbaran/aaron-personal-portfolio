import { describe, expect, it } from "vitest";
import { visibleText } from "./links";
import { intro } from "./intro";
import { FIRST_SCREEN_LINES } from "./introLines";

const [first, second] = intro.blocks[0].sentences;

describe("the first-screen lab's lines", () => {
  it("offer none, short and long", () => {
    expect(Object.keys(FIRST_SCREEN_LINES)).toEqual(["none", "short", "long"]);
    expect(FIRST_SCREEN_LINES.none).toBeNull();
  });

  it("cut the short line from block 1's first sentence", () => {
    expect(FIRST_SCREEN_LINES.short).toBe(first);
    expect(visibleText(FIRST_SCREEN_LINES.short)).toMatch(/^I'm a product-focused engineer\.$/);
  });

  it("cut the long line from block 1's first two sentences, in order", () => {
    expect(FIRST_SCREEN_LINES.long).toBe(`${first} ${second}`);
    expect(FIRST_SCREEN_LINES.long.startsWith(FIRST_SCREEN_LINES.short)).toBe(true);
    expect(visibleText(FIRST_SCREEN_LINES.long)).toContain("UT Austin");
  });

  it("never uses an em dash", () => {
    for (const line of [FIRST_SCREEN_LINES.short, FIRST_SCREEN_LINES.long]) expect(line).not.toContain("—");
  });
});
