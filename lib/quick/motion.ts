import { GALLERY } from "@/lib/gallery/constants";

// The quick page's motion values. The thumbnail wipe is the card modal's mask-in
// (lib/gallery/constants GALLERY.mask); the chase is how long the drawn line takes
// to catch the reader's high water, like the sections grammar's scrub.
export const QUICK_MOTION = {
  readingLine: 0.7, // of the viewport's height, from its top: where the line's tip follows the reader
  revealLine: 0.92, // of the viewport's height: a tile's picture wipes in once its top crosses this, apart from the timeline
  chaseS: 0.6,
  chaseEase: "expo",
  wipeS: GALLERY.mask.lengthMs / 1000,
  wipeEase: GALLERY.ease.gsap,
  settle: GALLERY.mask.settle,
  direction: GALLERY.direction,
  yearLine: 0.5, // the rail's big year shows the item crossing the middle of the viewport
  yearTickS: 0.12, // per year the rail's big year counts through
} as const;

// The title's unfold (M, V and P spelling out): how long the title waits in view
// before it starts, the gap between the three, how long each takes to open, and
// the lab's ranges for all three.
export const TITLE_UNFOLD = {
  delayMs: 600,
  staggerMs: 120,
  durationMs: 800,
  delayRange: { min: 0, max: 3000, step: 50 },
  staggerRange: { min: 0, max: 400, step: 10 },
  durationRange: { min: 200, max: 2000, step: 50 },
} as const;

export const SPEED_RANGE = { min: 0.25, max: 3, step: 0.05 } as const;

// speed 1 is the values above; 2 runs everything twice as fast.
export function timings(speed: number) {
  const k = 1 / Math.min(SPEED_RANGE.max, Math.max(SPEED_RANGE.min, speed));
  return { chaseS: QUICK_MOTION.chaseS * k, wipeS: QUICK_MOTION.wipeS * k, yearTickS: QUICK_MOTION.yearTickS * k };
}
