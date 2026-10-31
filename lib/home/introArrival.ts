import { COIL } from "@/lib/coil/constants";

// Page 1's words arriving on load (slice 5). The steps are the order Aaron
// asked for, on the two-paragraph page: the name's line, paragraph 1, the
// band's question, paragraph 2, the strip's button. Each [data-arrive] element carries its
// step (--arrive-step); the stagger, the item's duration and the rise are CSS
// custom properties on the page (lib/home/introDom.ts) and app/globals.css
// plays them as transitions once <html data-intro-words> says "play".
//
// The ease is the site's strong ease out, fixed here and in the stylesheet
// (cubic-bezier(0.23, 1, 0.32, 1)); everything animated is transform and opacity.

export const ARRIVAL_STEP = {
  name: 0,
  // The two paragraphs, by index in siteContent.intro.blocks: one before the band, one after it.
  blocks: [1, 3],
  band: 2,
  button: 4,
} as const;

export const ARRIVAL_STEPS = 5;

export type ArrivalKnobs = { arrivalTotalMs: number; arrivalStaggerMs: number; arrivalRisePx: number };

export const DEFAULT_ARRIVAL: ArrivalKnobs = {
  arrivalTotalMs: COIL.intro.arrival.totalMs,
  arrivalStaggerMs: COIL.intro.arrival.staggerMs,
  arrivalRisePx: COIL.intro.arrival.risePx,
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// The arrival's timing: each item's own duration (the total less the staggers
// before the last step starts, held to 250 ms to 2 s), and when the last one is
// done (the head script's "play" can become "done" then).
export function arrivalPlan(knobs: ArrivalKnobs = DEFAULT_ARRIVAL) {
  const before = (ARRIVAL_STEPS - 1) * knobs.arrivalStaggerMs;
  const itemMs = clamp(knobs.arrivalTotalMs - before, 250, 2000);
  return { itemMs, staggerMs: knobs.arrivalStaggerMs, risePx: knobs.arrivalRisePx, doneMs: before + itemMs };
}

// The page's custom properties for it: the stylesheet's whole input.
export function arrivalVars(knobs: ArrivalKnobs = DEFAULT_ARRIVAL): Record<string, string> {
  const plan = arrivalPlan(knobs);
  return {
    "--arrive-item": `${plan.itemMs}ms`,
    "--arrive-stagger": `${plan.staggerMs}ms`,
    "--arrive-rise": `${plan.risePx}px`,
  };
}

// The step as a style value, for the element that arrives.
export function arrivalStyle(step: number): Record<string, number> {
  return { "--arrive-step": step };
}
