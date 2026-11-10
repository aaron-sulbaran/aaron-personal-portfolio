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
  rowMaxCrop: 0.15, // a row's photo is drawn whole, in its own shape, when its orientation's box would cut more of it than this (lib/gallery/boxes rowBox)
  rowGap: 64,
  proseGap: 20, // between the paragraphs of a card with no photos: a reading rhythm, not a row's
  columnGap: 56, // photo to words
  stickyTop: 0, // a row whose media is taller than its words (the jobs card's post) pins its words at the top of the modal's scroll (inside its padding), beside the media as it passes
  panelPadding: 40,
  panelBorder: 1,
  // The jobs card's media column holds two pieces side by side (a name tag and its photo, or the two tags of the next row), each this wide,
  // so a pair is as wide as the LinkedIn post's frame, 504 (components/card/PostEmbed): 244 + 16 + 244.
  cluster: { itemWidth: 244, gap: 16, tagHeight: 330 },
  // The LinkedIn post's frame, which scrolls inside itself (Jolie Zhou's are 600 tall, 520 on a phone): this tall on a desktop row; on a
  // phone's page the frame and its link (together) take the room the post's paragraph above them leaves, up to pageMax (lib/gallery/
  // paginate). Between teaser and pageMin the frame would cut through the post's photos (at 280 it cut his photo off at the face, "really
  // unsettling", Aaron, 2026-11-09), so a page short of pageMin gives the post pageMin and lets the words scroll above it, keeping them at
  // least wordsMin, and a page too short for that shows only the post's head, its line and "...more" (teaser).
  post: { rowHeight: 600, pageMin: 420, pageMax: 520, teaser: 182, wordsMin: 120 },
  headerTile: { width: 60, height: 80 }, // 3:4, so a flown logo card fills it
  headerTileCompact: { width: 42, height: 56 }, // the phone header's, clear of the close button
  talosTileCompact: { width: 51, height: 68 }, // Talos's phone tile: its mark at 40 percent is 20.4px
  talosMarkMinPx: 20, // the Talos kit's smallest mark (interactions-brief.md section 2)
  pager: {
    stageMax: 0.4, // of the visible height: a page's photo stage at its tallest (shorter where its words need the room)
    wordlessMax: 0.55, // grouping B's photo-only pages
    slideMs: 360,
    flickPx: 96,
    dismissMs: 240, // the panel's travel off the screen when a flick closes it
    springBackMs: 260, // the panel's return when a vertical drag falls short
    slopPx: 8, // a drag picks its axis once it has moved this far
    swipePx: 48, // a sideways drag this far turns a page
    flickSpeed: 0.6, // a quicker release (px per ms) turns or closes on a short drag
    minFlickPx: 24, // the least a quick release must have travelled to count
    wordsRoomPx: 128, // under the stage before the pager has measured: the caption and two lines of words
    captionRoomPx: 72, // under a wordless page's stage
    stageFloorPx: 140, // a photo stage's shortest beside words: past it the words go on to another page with a photo of its own
    wideFloorShare: 0.7, // a stage of wide photos may be shorter than that, down to the height that keeps them this share of the page's width
    stageMinPx: 100, // and never shorter than this
    photoMinShare: 0.6, // a photo on a short stage keeps this share of the page's width, cropped about its subject (lib/gallery/boxes phoneBox)
    photoMaxCrop: 0.2, // and is never cropped past this share of the picture, however wide the page (a 900 by 600 window would slice a portrait down to a strip, and 30 percent still cut the Aritzia poster's heading off on a 375 by 667 phone)
    tagMaxPx: 340, // a name tag's widest on a phone page (the jobs card): its height is its own; so is the post card's
    pageGapPx: 12, // between a page's stage, its caption and its words (PagerPage's gap-3)
    blockGapPx: 16, // between the blocks of a page's words (PagerPage's gap-4)
    endPadPx: 24, // under the last block of words that scroll (PagerPage's pb-6), clear of the fade
    fitFloor: 0.8, // a name tag or the post's card taller than a short phone's page is shrunk to fit, but never below this share of its size
    longTitleChars: 24, // a longer modal title steps down a size in the phone header, so it takes three lines, not four
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

