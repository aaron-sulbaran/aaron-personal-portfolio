import { describe, expect, it } from "vitest";
import { COMPACT_SLOT, compactWidth, expandedWidth, GENERIC_ISLAND, islandBox, islandSpec, islandTop, ISLAND_PT, PHONE_PRESETS } from "./island";

describe("which phone's island to match", () => {
  it("reads the 14 Pro class from its 393 by 852 screen at 3x, in either orientation", () => {
    for (const screen of [{ width: 393, height: 852 }, { width: 852, height: 393 }]) {
      expect(islandSpec(screen, 3)).toMatchObject({ width: 126, height: 37.33, top: 11, safeTop: 59 });
    }
  });

  it("knows every size class that has an island", () => {
    const sizes = [[393, 852, 59], [430, 932, 59], [402, 874, 62], [440, 956, 62], [420, 912, 68]] as const;
    for (const [width, height, safeTop] of sizes) {
      const spec = islandSpec({ width, height }, 3);
      expect(spec.model).not.toBeNull();
      expect(spec.safeTop).toBe(safeTop);
      expect(spec.width).toBe(ISLAND_PT.width);
    }
  });

  it("keeps the gap under the island the same in every class", () => {
    for (const [width, height] of [[393, 852], [402, 874], [420, 912]] as const) {
      const spec = islandSpec({ width, height }, 3);
      expect(spec.safeTop - (spec.top + spec.height)).toBeCloseTo(ISLAND_PT.gapBelow, 1);
    }
  });

  it("falls back to the generic pill for a notch iPhone, an Android phone and anything else", () => {
    expect(islandSpec({ width: 390, height: 844 }, 3)).toBe(GENERIC_ISLAND);
    expect(islandSpec({ width: 412, height: 915 }, 2.625)).toBe(GENERIC_ISLAND);
    expect(islandSpec({ width: 393, height: 852 }, 2)).toBe(GENERIC_ISLAND);
    expect(islandSpec({ width: 1440, height: 900 }, 2)).toBe(GENERIC_ISLAND);
  });

  it("has a preset for each lab phone that resolves to the island it names", () => {
    expect(islandSpec(PHONE_PRESETS.iphone15, PHONE_PRESETS.iphone15.dpr).model).toMatch(/15/);
    expect(islandSpec(PHONE_PRESETS.iphone17pro, PHONE_PRESETS.iphone17pro.dpr).model).toMatch(/17 Pro/);
    expect(islandSpec(PHONE_PRESETS.iphone17promax, PHONE_PRESETS.iphone17promax.dpr).model).toMatch(/17 Pro Max/);
    expect(islandSpec(PHONE_PRESETS.android, PHONE_PRESETS.android.dpr)).toBe(GENERIC_ISLAND);
  });
});

describe("where the pill sits", () => {
  const spec = islandSpec({ width: 393, height: 852 }, 3);

  it("sits a small gap under the status bar when the page cannot draw there (the inset reads 0)", () => {
    expect(islandTop(spec, 0)).toBe(6);
    expect(islandTop(GENERIC_ISLAND, 0)).toBe(6);
  });

  it("sits over the hardware island when the page extends under the status bar", () => {
    expect(islandTop(spec, 59)).toBe(11);
    expect(islandTop(spec, 58.5)).toBe(11);
  });

  it("stays under the inset when it is some other number", () => {
    expect(islandTop(spec, 20)).toBe(26);
    expect(islandTop(GENERIC_ISLAND, 24)).toBe(30);
  });
});

describe("the pill's widths", () => {
  it("widens the hardware island by a slot each side for the live-activity look, on a screen with room", () => {
    expect(compactWidth(islandSpec({ width: 393, height: 852 }, 3), 600)).toBe(126 + COMPACT_SLOT * 2);
  });

  it("stays clear of the header's Menu pill: no wider than 40 percent of the screen", () => {
    const spec = islandSpec({ width: 393, height: 852 }, 3);
    expect(compactWidth(spec, 393)).toBe(157);
    expect(compactWidth(spec, 440)).toBe(176);
    expect(compactWidth(GENERIC_ISLAND, 412)).toBe(164);
    for (const width of [360, 375, 393, 412, 430, 440]) expect(width / 2 + compactWidth(spec, width) / 2).toBeLessThan(width - 106);
  });

  it("never narrows below the hardware island it stands for", () => {
    expect(compactWidth(islandSpec({ width: 393, height: 852 }, 3), 200)).toBe(126);
  });

  it("expands to nearly the screen's width, capped on big phones", () => {
    expect(expandedWidth(393)).toBe(371);
    expect(expandedWidth(440)).toBe(418);
    expect(expandedWidth(700)).toBe(420);
  });

  it("is centred for the morph's end", () => {
    const spec = islandSpec({ width: 393, height: 852 }, 3);
    const box = islandBox(393, spec, 6);
    expect(box.left + box.width / 2).toBeCloseTo(196.5);
    expect(box).toMatchObject({ top: 6, height: 37.33, width: compactWidth(spec, 393) });
  });
});
