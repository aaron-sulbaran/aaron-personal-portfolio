import { describe, expect, it } from "vitest";
import { dueTiles, worthAnimating, type TileBox } from "./reveal";

const tile = (key: string, top: number, height = 160): TileBox => ({ key, top, bottom: top + height });
const tiles = [tile("above", -400), tile("on", 300), tile("lowest", 820), tile("below", 1200)];

describe("dueTiles", () => {
  it("is every tile whose top has crossed the line, above the viewport included", () => {
    expect(dueTiles(tiles, 900, 0.92, new Set()).map((t) => t.key)).toEqual(["above", "on", "lowest"]);
  });

  it("waits for the top, not the tile's middle: a tile just under the line is not due yet", () => {
    expect(dueTiles([tile("a", 829)], 900, 0.92, new Set())).toEqual([]);
    expect(dueTiles([tile("a", 828)], 900, 0.92, new Set()).map((t) => t.key)).toEqual(["a"]);
  });

  it("covers a tile fully on screen even in the viewport's bottom third", () => {
    const wholly = tile("wholly", 900 - 160 - 10);
    expect(dueTiles([wholly], 900, 0.92, new Set()).map((t) => t.key)).toEqual(["wholly"]);
  });

  it("never returns a tile twice", () => {
    expect(dueTiles(tiles, 900, 0.92, new Set(["above", "on"])).map((t) => t.key)).toEqual(["lowest"]);
  });

  it("tracks the viewport's height", () => {
    expect(dueTiles(tiles, 844, 0.92, new Set()).map((t) => t.key)).toEqual(["above", "on"]);
  });
});

describe("worthAnimating", () => {
  it("is true only for a tile at least partly on screen", () => {
    expect(worthAnimating(tile("a", 300), 900)).toBe(true);
    expect(worthAnimating(tile("a", -100), 900)).toBe(true);
    expect(worthAnimating(tile("a", -400), 900)).toBe(false);
    expect(worthAnimating(tile("a", 900), 900)).toBe(false);
  });
});
