import { COIL, type CoilConstants } from "@/lib/coil/constants";

// The deal's trigger as a scroll position, and when the page decides on the
// reader's input before the browser scrolls (lib/home/triggerGuard.ts is the DOM
// half). Pure and tested.
//
// Why it exists: the cutscene started from the page's `scroll` event, which only
// arrives after the browser's compositor has applied the wheel or the touch that
// moved the page. On a busy main thread (a slow phone, a page mid-render) a
// fling's wheels go on being applied for frames before the page hears of any of
// them, so it could run past the trigger and past page 2 before the deal took it
// (Aaron: "it can take them all the way to the bottom without the animation
// playing"; 499 px past page 2 in the merged e2e). Within about a viewport above
// the trigger the page listens to the input itself, with listeners that can
// cancel it, and starts the deal on the event that would carry it past.

export type TriggerGeometry = {
  scrollY: number;
  railTop: number; // the rail's top edge in the viewport, px (lib/home/stickyRange.ts)
  range: number; // the rail's height less the stage's, px (0: no sticky range)
  sectionTop: number; // the cards section's top edge in the viewport, px
  viewportHeight: number;
};

// The scroll position at which the page reaches the deal's trigger: where
// stickyProgress (lib/home/stickyRange.ts) reaches enterAtProgress, the place
// lib/home/deal.ts dealTrigger starts the deal from, for the page as it is laid
// out now.
export function triggerScrollY(g: TriggerGeometry, t = COIL.deal.trigger): number {
  if (g.range > 1) return g.scrollY + g.railTop + t.enterAtProgress * g.range;
  return g.scrollY + g.sectionTop - (1 - t.enterAtProgress) * Math.max(1, g.viewportHeight);
}

// Whether the page listens: the deal is waiting for the reader's scroll to play
// it, and the page is above the trigger by no more than guardAheadVh viewports.
// Anywhere else ordinary scrolling never meets a listener that could hold it.
export function guardArmed(a: { scrollY: number; triggerY: number; viewportHeight: number; waiting: boolean }, c: CoilConstants = COIL): boolean {
  if (!a.waiting) return false;
  const ahead = c.deal.cutscene.guardAheadVh * Math.max(1, a.viewportHeight);
  return a.scrollY < a.triggerY && a.scrollY >= a.triggerY - ahead;
}

// Half a pixel of slack: scroll positions are fractional on a dense screen.
const CROSS_SLACK_PX = 0.5;

// Whether a step down the page (px: a wheel's, a finger's or a key's) would carry
// it to the trigger or past it.
export function crossesTrigger(scrollY: number, stepPx: number, triggerY: number): boolean {
  return stepPx > 0 && scrollY + stepPx >= triggerY - CROSS_SLACK_PX;
}

// How far a scroll key moves the page, px down (negative: up), as Chromium
// scrolls it: an arrow 40 px, a page 87.5 percent of the viewport, End and Home
// all the way. 0 for any other key.
const ARROW_PX = 40;
const PAGE_SHARE = 0.875;
export function keyStepPx(key: string, shiftKey: boolean, viewportHeight: number): number {
  const page = PAGE_SHARE * viewportHeight;
  switch (key) {
    case "ArrowDown":
      return ARROW_PX;
    case "ArrowUp":
      return -ARROW_PX;
    case "PageDown":
      return page;
    case "PageUp":
      return -page;
    case " ":
    case "Spacebar":
      return shiftKey ? -page : page;
    case "End":
      return Number.POSITIVE_INFINITY;
    case "Home":
      return Number.NEGATIVE_INFINITY;
    default:
      return 0;
  }
}
