import { GALLERY } from "@/lib/gallery/constants";

// The quick page's motion values. The thumbnail wipe is the card modal's mask-in
// (lib/gallery/constants GALLERY.mask); the chase is how long the drawn line takes
// to catch the reader's high water, like the sections grammar's scrub.
export const QUICK_MOTION = {
  readingLine: 0.7, // of the viewport's height, from its top: where the line's tip follows the reader
  chaseS: 0.6,
  chaseEase: "expo",
  wipeS: GALLERY.mask.lengthMs / 1000,
  wipeEase: GALLERY.ease.gsap,
  settle: GALLERY.mask.settle,
  direction: GALLERY.direction,
  yearLine: 0.5, // the rail's big year shows the item crossing the middle of the viewport
  yearTickS: 0.12, // per year the rail's big year counts through
} as const;

export const SPEED_RANGE = { min: 0.25, max: 3, step: 0.05 } as const;

// speed 1 is the values above; 2 runs everything twice as fast.
export function timings(speed: number) {
  const k = 1 / Math.min(SPEED_RANGE.max, Math.max(SPEED_RANGE.min, speed));
  return { chaseS: QUICK_MOTION.chaseS * k, wipeS: QUICK_MOTION.wipeS * k, yearTickS: QUICK_MOTION.yearTickS * k };
}
