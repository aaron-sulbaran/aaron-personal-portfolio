// The tile pictures' own reveal, apart from the timeline. A tile's picture wipes
// in once, when the tile's top crosses the reveal line (a share of the viewport's
// height, from its top), so a tile that is wholly on screen never sits as an
// empty frame while the drawn line catches up. One way: a revealed tile stays
// revealed. Pure.

export interface TileBox { key: string; top: number; bottom: number }

// The tiles whose top has crossed the line (tops are px from the viewport's top,
// so a tile scrolled past upward has crossed it too) and are not yet revealed.
export function dueTiles(tiles: readonly TileBox[], viewportHeight: number, line: number, revealed: ReadonlySet<string>): TileBox[] {
  const edge = viewportHeight * line;
  return tiles.filter((tile) => tile.top <= edge && !revealed.has(tile.key));
}

// Only a tile that is on screen is worth a wipe; one wholly above the viewport
// (a jump down the page) opens at once.
export const worthAnimating = (tile: TileBox, viewportHeight: number): boolean => tile.bottom > 0 && tile.top < viewportHeight;
