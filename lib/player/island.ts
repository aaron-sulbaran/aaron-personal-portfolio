import { HEADER_ROW, ISLAND } from "./constants";
import type { Box } from "./zone";

// The phone island, pure: where the black pill sits in the header row and how
// wide it is. It stands on the Menu pill's line (the same top edge and the same
// height), between the AS mark and the Menu pill, and a phone has no status bar
// for a page to draw into, so it never pretends to be the hardware island.
// Sizes are CSS px.

const small = (viewportWidth: number) => viewportWidth >= HEADER_ROW.smMinPx;

// The header row's top edge and height: the Menu pill's.
export const headerTop = (viewportWidth: number): number => (small(viewportWidth) ? HEADER_ROW.topSmPx : HEADER_ROW.topPx);

// The AS mark's right edge, and the Menu pill's left edge when it is not measured.
export const markRight = (viewportWidth: number): number => (small(viewportWidth) ? HEADER_ROW.markRightSmPx : HEADER_ROW.markRightPx);
export const menuLeftFallback = (viewportWidth: number): number =>
  viewportWidth - (small(viewportWidth) ? HEADER_ROW.menuInsetSmPx : HEADER_ROW.menuInsetPx) - HEADER_ROW.menuWidthPx;

export interface IslandFit {
  left: number;
  width: number;
}

// The collapsed island: a share of the screen, kept between the mark and the
// Menu pill. It is centered on the screen when that keeps it clear of both,
// else centered in the room they leave, so it never sits on either.
export function islandFit(viewportWidth: number, menuLeft: number = menuLeftFallback(viewportWidth)): IslandFit {
  const roomLeft = markRight(viewportWidth) + HEADER_ROW.clearPx;
  const roomRight = menuLeft - HEADER_ROW.clearPx;
  const room = Math.max(0, roomRight - roomLeft);
  const wanted = Math.min(ISLAND.compactMaxPx, Math.max(ISLAND.compactMinPx, Math.floor(viewportWidth * ISLAND.compactShare)));
  const width = Math.min(wanted, room);
  const centered = (viewportWidth - width) / 2;
  const left = centered >= roomLeft && centered + width <= roomRight ? centered : roomLeft + (room - width) / 2;
  return { left, width };
}

// Expanded, the island is nearly the screen's width (Apple's is 371 of 393),
// centered, and grows down from the header row.
export function expandedFit(viewportWidth: number): IslandFit {
  const width = Math.min(ISLAND.expandedMaxPx, viewportWidth - ISLAND.expandedMarginPx * 2);
  return { left: (viewportWidth - width) / 2, width };
}

// The collapsed island's box, for the morph's end.
export function islandBox(viewportWidth: number, menuLeft?: number): Box {
  const { left, width } = islandFit(viewportWidth, menuLeft);
  return { left, top: headerTop(viewportWidth), width, height: HEADER_ROW.heightPx };
}
