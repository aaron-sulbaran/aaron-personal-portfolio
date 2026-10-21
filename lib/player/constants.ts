import { DOCK } from "@/lib/waveform/dock";

// The player's numbers, from the music player lab's third round (Aaron tuned
// them by hand). Change them here, never in a component.

// Where the band hands the player to the isle: the band's bottom edge rising
// above this share of the viewport's height, from its top, and coming back
// across it on the way up. One fraction for every screen.
export const ISLE_LINE = 0.4;

// The band is ahead of the reader (the hero, the book) while its top edge is at
// or below this share of the viewport's height.
export const AHEAD_TOP = 0.75;

// The hand-off between the band's player and the isle, in seconds. The glass
// keeps the player card's corners (px) until the box is shorter than a pill.
export const MORPH = { seconds: 0.56, fadeSeconds: 0.22, cardRadiusPx: 22 } as const;

// The desktop isle: one pill with two states, bottom left on the dock's line,
// the same left edge as the header's mark. Collapsed it is the cover, the
// title, the artist and the note (54px tall, 252px wide); open it grows up from
// the same corner to the full player's width.
export const ISLE = {
  insetPx: DOCK.insetPx,
  bottomPx: DOCK.baselineFromBottomPx - DOCK.capsulePx / 2,
  heightPx: 54,
  widthPx: 252,
  openWidthPx: 360,
} as const;

// The pill opens after the pointer has stayed this long (a passing cursor never
// flickers it open), and stays open this long after the pointer leaves it (a
// wobble at its edge does not shut it).
export const PILL_OPEN_MS = 140;
export const PILL_CLOSE_MS = 280;

// Open, by hover or by a click that pinned it, the pill folds back after this
// long with no pointer movement, click, wheel or key inside it. Never while a
// seek is being dragged or the keyboard's focus is inside it.
export const PILL_IDLE_MS = 4000;

// The isle rides up to stay clear of what it would cover. FOOTER_GAP_PX: its
// bottom edge sits this far above the footer's top edge, so the period stays
// free. In the hero the Coil and Band toggle (and the Coil control that stands
// in its place) hold the dock's corner: HERO_CONTROLS is their seat in
// components/coil/ShapeToggle (bottom-[24px], h-10), and the isle rises
// HERO_LIFT_PX above its dock line while the band is still ahead of the reader.
export const FOOTER_GAP_PX = 14;
export const HERO_CONTROLS = { bottomPx: 24, heightPx: 40 } as const;
export const HERO_LIFT_PX = 56;

// The phone's island sits in the header row, on the Menu pill's line: the same
// height and the same top edge (components/menu/MenuPill: min-h-10, top-3 and
// sm:top-4), between the AS mark and the Menu pill (components/SiteNav: the
// mark is left-4 w-8, and sm:left-6 sm:w-10). clearPx is its gap to either.
export const HEADER_ROW = {
  smMinPx: 640,
  heightPx: 40,
  topPx: 12,
  topSmPx: 16,
  markRightPx: 48,
  markRightSmPx: 64,
  menuInsetPx: 12,
  menuInsetSmPx: 20,
  menuWidthPx: 64, // the Menu pill's width until it can be measured
  clearPx: 10,
} as const;

// Collapsed, the island is a live activity: the cover at the left and the
// level bars at the right. It takes this share of the screen's width, never
// less than minPx or more than maxPx, and never more than the room the header
// row leaves it. Expanded, it is nearly the screen's width (marginPx each
// side), at most maxPx wide.
export const ISLAND = {
  compactShare: 0.4,
  compactMinPx: 126,
  compactMaxPx: 218,
  expandedMarginPx: 11,
  expandedMaxPx: 420,
  swipeUpPx: 36,
} as const;

// How often the playhead is read while a player shows it and the music plays.
export const PLAYHEAD_POLL_MS = 250;
