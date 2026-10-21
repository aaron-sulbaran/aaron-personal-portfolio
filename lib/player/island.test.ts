import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HEADER_ROW, ISLAND } from "./constants";
import { expandedFit, headerTop, islandBox, islandFit, markRight, menuLeftFallback } from "./island";

// The Menu pill's real width with the Listen note gone: its label and padding.
const MENU_WIDTH = 64;
const menuLeftOf = (viewportWidth: number) => viewportWidth - (viewportWidth >= 640 ? 20 : 12) - MENU_WIDTH;

describe("the island in the header row", () => {
  it("stands on the Menu pill's top edge and height, at every phone width", () => {
    for (const width of [360, 375, 393, 402, 430, 440, 639]) {
      expect(headerTop(width)).toBe(12);
      expect(islandBox(width, menuLeftOf(width)).top).toBe(12);
    }
    for (const width of [640, 700, 767]) expect(headerTop(width)).toBe(16);
    expect(islandBox(393).height).toBe(HEADER_ROW.heightPx);
    expect(HEADER_ROW.heightPx).toBe(40);
  });

  it("centers on the Menu pill's line: the same vertical center within a pixel", () => {
    for (const width of [360, 393, 440, 700]) {
      const box = islandBox(width, menuLeftOf(width));
      expect(box.top + box.height / 2).toBeCloseTo(headerTop(width) + HEADER_ROW.heightPx / 2, 5);
    }
  });

  it("stays clear of the mark and the Menu pill from 360 to 440 wide", () => {
    for (let width = 360; width <= 440; width += 4) {
      const menuLeft = menuLeftOf(width);
      const { left, width: wide } = islandFit(width, menuLeft);
      expect(left, `${width}: clear of the mark`).toBeGreaterThanOrEqual(markRight(width) + HEADER_ROW.clearPx);
      expect(left + wide, `${width}: clear of the Menu pill`).toBeLessThanOrEqual(menuLeft - HEADER_ROW.clearPx);
    }
  });

  it("is centered on the screen when that keeps it clear of both", () => {
    const { left, width } = islandFit(393, menuLeftOf(393));
    expect(left + width / 2).toBeCloseTo(393 / 2, 5);
  });

  it("slides toward the roomier side, never onto the Menu pill, when a wider Menu pill takes the room", () => {
    const wide = islandFit(360, 360 - 12 - 150);
    expect(wide.left).toBeGreaterThanOrEqual(markRight(360) + HEADER_ROW.clearPx);
    expect(wide.left + wide.width).toBeLessThanOrEqual(360 - 12 - 150 - HEADER_ROW.clearPx);
  });

  it("is a share of the screen between the live activity's bounds", () => {
    expect(islandFit(393, menuLeftOf(393)).width).toBe(Math.floor(393 * ISLAND.compactShare));
    expect(islandFit(767, menuLeftOf(767)).width).toBeLessThanOrEqual(ISLAND.compactMaxPx);
    expect(islandFit(360, menuLeftOf(360)).width).toBeGreaterThanOrEqual(ISLAND.compactMinPx);
  });

  it("falls back to the Menu pill's usual place until it is measured", () => {
    expect(menuLeftFallback(393)).toBe(393 - 12 - HEADER_ROW.menuWidthPx);
    expect(menuLeftFallback(700)).toBe(700 - 20 - HEADER_ROW.menuWidthPx);
  });

  it("opens nearly the screen's width, centered, and no wider than the cap", () => {
    expect(expandedFit(393)).toEqual({ left: 11, width: 371 });
    expect(expandedFit(767).width).toBe(ISLAND.expandedMaxPx);
    const fit = expandedFit(600);
    expect(fit.left * 2 + fit.width).toBe(600);
  });
});

describe("the header row's real seats", () => {
  const menu = readFileSync("components/menu/MenuPill.tsx", "utf8");
  const nav = readFileSync("components/SiteNav.tsx", "utf8");

  it("matches the Menu pill's top edge and height", () => {
    expect(menu).toContain(`top-${HEADER_ROW.topPx / 4}`);
    expect(menu).toContain(`sm:top-${HEADER_ROW.topSmPx / 4}`);
    expect(menu).toContain(`min-h-${HEADER_ROW.heightPx / 4}`);
    expect(menu).toContain("right-[calc(12px+var(--scrollbar-comp))]");
    expect(menu).toContain("sm:right-[calc(20px+var(--scrollbar-comp))]");
  });

  it("matches the mark's place at its right edge", () => {
    expect(nav).toContain("left-4 top-4");
    expect(nav).toContain("h-8 w-8");
    expect(nav).toContain("sm:left-6 sm:h-10 sm:w-10");
    expect(HEADER_ROW.markRightPx).toBe(16 + 32);
    expect(HEADER_ROW.markRightSmPx).toBe(24 + 40);
  });
});
