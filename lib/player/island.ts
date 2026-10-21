import type { PhoneModel } from "./settings";
import type { Box } from "./zone";

// The phone island, pure: which iPhone this is (so the black pill can match its
// Dynamic Island), and the boxes the pill takes. Sizes are CSS points, the
// unit of screen.width. A page in Mobile Safari cannot draw into the status
// bar, so the pill is a simulation that sits just under it; where a page does
// extend under the status bar (the top inset is the phone's full safe area,
// as in a home-screen web app with a translucent bar) the pill sits over the
// hardware island itself.
//
// Sources (read 2026-10-21): the island is a static 126 by 37.33 pt cutout
// whose top edge is 11 pt from the screen's top on the 14 Pro class (Suyash
// Srijan's DynamicIslandUtilities, Sept 2022), which agrees with Apple's 460
// ppi and the 20.76 mm width reported for the 17 Pro (GSMArena); screens and
// top safe-area insets are from Use Your Loaf (iPhone 16 and 17 screen sizes)
// and iosref.com. The 62 and 68 pt classes keep the same 10.67 pt gap under
// the island, which puts their island top at 14 and 20 pt; that offset is an
// inference, used only when the page really does extend under the status bar.

export interface IslandSpec {
  model: string | null; // the iPhones this size class covers, or null for a generic pill
  width: number;
  height: number;
  top: number; // the hardware island's top edge, from the screen's top (used when the page draws under the status bar)
  safeTop: number; // the class's top safe-area inset
}

export const ISLAND_PT = { width: 126, height: 37.33, gapBelow: 10.67 } as const;

interface Known {
  short: number;
  long: number;
  safeTop: number;
  models: string;
}

const KNOWN: readonly Known[] = [
  { short: 393, long: 852, safeTop: 59, models: "iPhone 14 Pro, 15, 15 Pro, 16" },
  { short: 430, long: 932, safeTop: 59, models: "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus" },
  { short: 402, long: 874, safeTop: 62, models: "iPhone 16 Pro, 17, 17 Pro" },
  { short: 440, long: 956, safeTop: 62, models: "iPhone 16 Pro Max, 17 Pro Max" },
  { short: 420, long: 912, safeTop: 68, models: "iPhone Air" },
];

// Android punch-holes sit centered on some phones and in a corner on others,
// and the web has no API for them, so every other phone gets a generic pill.
export const GENERIC_ISLAND: IslandSpec = { model: null, width: 120, height: 34, top: 8, safeTop: 0 };

const sameSize = (a: number, b: number) => Math.abs(a - b) < 1;

// The island for a screen's size in CSS points and its device pixel ratio.
// iOS reports the screen in points at 3x for every model with an island, and
// the sides in either order depending on the orientation; Android's ratios
// (2.625, 2.75, 3.5 and so on) never match.
export function islandSpec(screen: { width: number; height: number }, dpr: number): IslandSpec {
  const short = Math.min(screen.width, screen.height);
  const long = Math.max(screen.width, screen.height);
  if (!sameSize(dpr, 3)) return GENERIC_ISLAND;
  const match = KNOWN.find((known) => sameSize(known.short, short) && sameSize(known.long, long));
  if (!match) return GENERIC_ISLAND;
  return { model: match.models, width: ISLAND_PT.width, height: ISLAND_PT.height, top: Math.round((match.safeTop - ISLAND_PT.height - ISLAND_PT.gapBelow) * 100) / 100, safeTop: match.safeTop };
}

// The lab's phone choices, as the screens they stand for.
export const PHONE_PRESETS: Record<Exclude<PhoneModel, "auto">, { width: number; height: number; dpr: number }> = {
  iphone15: { width: 393, height: 852, dpr: 3 },
  iphone17pro: { width: 402, height: 874, dpr: 3 },
  iphone17promax: { width: 440, height: 956, dpr: 3 },
  android: { width: 412, height: 915, dpr: 2.625 },
};

export const GAP_UNDER_STATUS_BAR = 6;

// The pill's top edge. Under the status bar when the page cannot draw there
// (the inset reads under the class's safe area); over the hardware island when
// it can.
export function islandTop(spec: IslandSpec, insetTop: number, gap: number = GAP_UNDER_STATUS_BAR): number {
  return spec.safeTop > 0 && insetTop >= spec.safeTop - 1 ? spec.top : insetTop + gap;
}

// The live-activity look widens the island by a slot each side of the hardware
// (Apple's compact leading and trailing areas), but never past a share of the
// screen's width: the site's header keeps the mark at the left and the Menu
// pill at the right, and a wider pill would sit over the Menu.
export const COMPACT_SLOT = 46;
export const COMPACT_MAX_SHARE = 0.4;
export const compactWidth = (spec: IslandSpec, viewportWidth: number): number =>
  Math.max(spec.width, Math.min(spec.width + COMPACT_SLOT * 2, Math.floor(viewportWidth * COMPACT_MAX_SHARE)));

// Expanded, the island is nearly the screen's width (Apple's is 371 of 393).
export const EXPANDED_MARGIN = 11;
export const EXPANDED_MAX = 420;
export const expandedWidth = (viewportWidth: number): number => Math.min(EXPANDED_MAX, Math.max(compactWidth(GENERIC_ISLAND, viewportWidth), viewportWidth - EXPANDED_MARGIN * 2));

// The collapsed pill's box, for the morph's end.
export function islandBox(viewportWidth: number, spec: IslandSpec, top: number): Box {
  const width = compactWidth(spec, viewportWidth);
  return { left: (viewportWidth - width) / 2, top, width, height: spec.height };
}
