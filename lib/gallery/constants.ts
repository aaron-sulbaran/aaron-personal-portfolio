import { uniformBoxes } from "./boxes";
import type { PhoneGrouping } from "./plan";

// The gallery lab's round six values, Aaron's pick of 2026-10-09 (branch lab,
// app/lab/gallery/settings.ts ROUND_SIX at ae9b6dd). Change a value here and
// nowhere else.
export const GALLERY = {
  wideQuery: "(min-width: 1024px)", // the rows from here up, the pager below
  verticalWidth: 320, // the vertical box, 3:4 (320 by 427)
  horizontalWidth: 424, // the horizontal box, 4:3 (424 by 318), about the same area
  wideFrom: 1, // width over height from which a photo takes the horizontal box
  textWidth: 460, // the words beside a photo
  proseMaxWidth: "62ch", // words with no photo beside them
  rowGap: 64,
  columnGap: 56, // photo to words
  panelPadding: 40,
  panelBorder: 1,
  headerTile: { width: 60, height: 80 }, // 3:4, so a flown logo card fills it
  headerTileCompact: { width: 42, height: 56 }, // the phone header's, clear of the close button
  talosTileCompact: { width: 51, height: 68 }, // Talos's phone tile: its mark at 40 percent is 20.4px
  talosMarkMinPx: 20, // the Talos kit's smallest mark (interactions-brief.md section 2)
  pager: {
    stageMax: 0.4, // of the visible height
    wordlessMax: 0.55, // grouping B's photo-only pages
    slideMs: 360,
    flickPx: 96,
    dismissMs: 240, // the panel's travel off the screen when a flick closes it
    springBackMs: 260, // the panel's return when a vertical drag falls short
    slopPx: 8, // a drag picks its axis once it has moved this far
    swipePx: 48, // a sideways drag this far turns a page
    flickSpeed: 0.6, // a quicker release (px per ms) turns or closes on a short drag
    minFlickPx: 24, // the least a quick release must have travelled to count
    wordsRoomPx: 128, // under the stage: the caption and two lines of words
    captionRoomPx: 72, // under a wordless page's stage
    stageFloorPx: 120,
    wordsFadePx: 28, // the soft fade at the foot of a page's words that scroll
    insetPx: 74, // the backdrop's px-4, the panel's p-5 and its 1px border, both sides
    sheetInsetPx: 48, // the backdrop's py-6, top and bottom: the sheet is the visible height less this
  },
  rotate: {
    intervalMs: 3000, // a photo stays 3s (round six; round five was 4.5s)
    changeMs: 640,
    delayMs: 1200, // after the landing, before the clock starts
    visible: 1 / 3, // of the frame on screen, or the clock holds
    captionOut: 0.5, // the old caption's clip closes over the first half of the change
    captionInAt: 0.25, // the new one's opens over the last 75 percent
    marksInsetPx: 8, // a phone stage's marks, inside the current photo's bottom right corner
    tapPx: 10, // a phone tap that moves further is a swipe
    holdMs: 500, // a phone press held longer only holds the group
  },
  mask: {
    landingMs: 520, // the flight's 520ms, FLIGHT_MS in components/FlyingTile.tsx
    lengthMs: 480,
    staggerMs: 110,
    lineStaggerMs: 45,
    settle: 1.02,
  },
  direction: "ltr", // every reveal reads left to right (round six)
  ease: { gsap: "site", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
} as const;

export const BOXES = uniformBoxes(GALLERY.verticalWidth, GALLERY.horizontalWidth);

// The phone's grouping. A ("paragraph") ships; B ("photo") is a one-line switch;
// C ("strip") needs the lab's PagerStrip, which this slice does not build, so the
// type refuses it.
export const PHONE_GROUPING: Exclude<PhoneGrouping, "strip"> = "paragraph";
