import { describe, expect, it } from "vitest";
import { defaultGap, lowerShare, segmentHeights, splitAt, tokenColors, tokenRamps, CODEX_COLORS, TOKEN_SETS } from "./stack";

describe("stacked shares", () => {
  it("gives the lower tool its share of the day, all of an empty or one-tool day", () => {
    expect(lowerShare(3, 1)).toBeCloseTo(0.75, 9);
    expect(lowerShare(0, 0)).toBe(1);
    expect(lowerShare(5, 0)).toBe(1);
    expect(lowerShare(0, 5)).toBe(0);
  });
  it("keeps a sliver at the floor when one is asked for, and never past half", () => {
    expect(lowerShare(990, 10, 0)).toBeCloseTo(0.99, 9);
    expect(lowerShare(990, 10, 0.08)).toBeCloseTo(0.92, 9);
    expect(lowerShare(10, 990, 0.08)).toBeCloseTo(0.08, 9);
    expect(lowerShare(1, 1, 0.9)).toBeCloseTo(0.5, 9);
    expect(lowerShare(0, 10, 0.08)).toBe(0);
  });
  it("cuts a bar into two segments that sum to the bar", () => {
    for (const [h, s] of [[7.6, 0.75], [0.2, 1], [3, 0], [5, 0.33]]) {
      const [lo, up] = segmentHeights(h, s);
      expect(lo + up).toBeCloseTo(h, 9);
      expect(lo).toBeCloseTo(h * s, 9);
    }
    expect(segmentHeights(2, 1.4)).toEqual([2, 0]);
  });
});

describe("the flat split square", () => {
  it("puts the lower tool at the bottom of the square, in proportion", () => {
    expect(splitAt(0.1, 0.8, 0.75)).toBeCloseTo(0.3, 9);
    expect(splitAt(0.1, 0.8, 1)).toBeCloseTo(0.1, 9);
    expect(splitAt(0.1, 0.8, 0)).toBeCloseTo(0.9, 9);
    expect(splitAt(0, 1, -2)).toBe(1);
  });
});

describe("the segment gap", () => {
  it("parts the two brand sets by a pixel and leaves the sea sets touching", () => {
    expect(TOKEN_SETS.map((set) => [set, defaultGap(set)])).toEqual([["brand", 1], ["official", 1], ["sea", 0], ["ink", 0]]);
  });
});

describe("token colours", () => {
  it("names each set's pair of custom properties, never a raw colour", () => {
    expect(tokenColors("brand")).toEqual({ claude: "var(--tokens-brand-claude)", codex: "var(--tokens-brand-codex)" });
    for (const set of TOKEN_SETS) {
      const ramps = tokenRamps(set, 30);
      expect(ramps.claude).toHaveLength(4);
      expect(ramps.codex).toHaveLength(4);
      expect(ramps.claude[3]).toBe(`var(--tokens-${set}-claude)`);
      expect(ramps.codex[0]).toBe(`color-mix(in srgb, var(--tokens-${set}-codex) 30%, var(--color-background))`);
      for (const step of [...ramps.claude, ...ramps.codex]) expect(step).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});

describe("the Codex colour", () => {
  it("keeps the set's own Codex colour for blue and names a token for the other three", () => {
    expect(CODEX_COLORS).toEqual(["blue", "stone", "sand", "slate"]);
    expect(tokenColors("official", "blue").codex).toBe("var(--tokens-official-codex)");
    for (const name of ["stone", "sand", "slate"] as const) {
      expect(tokenColors("official", name)).toEqual({ claude: "var(--tokens-official-claude)", codex: `var(--tokens-codex-${name})` });
      const ramps = tokenRamps("official", 30, name);
      expect(ramps.codex[3]).toBe(`var(--tokens-codex-${name})`);
      expect(ramps.codex[0]).toBe(`color-mix(in srgb, var(--tokens-codex-${name}) 30%, var(--color-background))`);
      expect(ramps.claude[3]).toBe("var(--tokens-official-claude)");
    }
  });
});
