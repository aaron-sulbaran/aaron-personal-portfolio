"use client";

import { useSyncExternalStore } from "react";
import { COIL } from "@/lib/coil/constants";

// The deal's state machine (hero rework): the cards are dealt into the Coil
// once per page load, never persisted.
//
//   idle      nothing has happened; the cards section is closed
//   dealing   the ribbon becomes the wheel and the wheel the Coil, the field
//             opens and the columns arrive; nothing can be opened yet, except
//             that the Coil takes the wheel the moment it is unfurled (below)
//   dealt     at rest; the cards are the reader's
//
// What triggers each step is pure (dealTrigger, tested): a click or the
// reader scrolling far enough into the sticky stage's range plays the deal, and
// with the scene drawing either is the cutscene (the page holds the reader's
// scroll until the Coil is unfurled and its own eased scroll brings the page to
// page 2: components/home/useDealDirector.ts); a load with the section already
// in view deals at once. Reduced motion starts dealt (no spin, no flight, no
// opening) but not spent: the teaser keeps its invitation until the reader
// deals.

export type DealPhase = "idle" | "dealing" | "dealt";
export type DealSource = "click" | "scroll" | "view" | "skip" | "reduced";

export type DealState = {
  phase: DealPhase;
  // The reader has dealt (the deck, or by reaching the cards): the fork shows
  // its after state once the deal is under way.
  spent: boolean;
  // The Coil is unfurled (the scene's clock has run out) while the columns are
  // still arriving: it takes the wheel and the pointer from here on, not from
  // when the columns are in.
  unfurled: boolean;
  // The click path is scrolling to the cards: the entrance waits for the arrival.
  hold: boolean;
  source: DealSource | null;
  // How many times the deal has played this page load (QA reads it).
  entrances: number;
};

export type DealAction =
  | { type: "enter"; source: DealSource }
  | { type: "unfurl" }
  | { type: "finish" }
  // Everything at once: a reduced-motion click, a title chosen before the deal
  // is over, the lab's skip.
  | { type: "skip" }
  // Reduced motion came on: dealt at once, spent or not as it was.
  | { type: "reduced" }
  | { type: "hold"; on: boolean }
  | { type: "reset" };

export const DEAL_IDLE: DealState = { phase: "idle", spent: false, unfurled: false, hold: false, source: null, entrances: 0 };
export const DEAL_REDUCED: DealState = { ...DEAL_IDLE, phase: "dealt" };

export function dealReducer(state: DealState, action: DealAction): DealState {
  switch (action.type) {
    case "enter":
      if (state.phase === "idle") {
        return { ...state, phase: "dealing", spent: true, unfurled: false, hold: false, source: state.source ?? action.source, entrances: state.entrances + 1 };
      }
      // Dealt without a deal (reduced motion): reaching the cards spends it.
      return state.phase === "dealt" && !state.spent ? { ...state, spent: true } : state;
    case "unfurl":
      return state.phase === "dealing" && !state.unfurled ? { ...state, unfurled: true } : state;
    case "finish":
      return state.phase === "dealing" ? { ...state, phase: "dealt" } : state;
    case "skip":
      return state.phase === "dealt" ? (state.spent ? state : { ...state, spent: true }) : { ...state, phase: "dealt", spent: true, hold: false };
    case "reduced":
      return state.phase === "dealt" ? state : { ...state, phase: "dealt", hold: false };
    case "hold":
      return state.hold === action.on ? state : { ...state, hold: action.on };
    case "reset":
      return { ...DEAL_IDLE, entrances: state.entrances };
  }
}

// ---- the triggers ----

export type TriggerFrame = {
  // How far through the sticky stage's range the reader is: 0 where the stage
  // sticks (page 1's foot at the top of the screen), 1 where it lets go (the
  // cards section's top there). Below 0 the stage has not stuck yet.
  stickyProgress: number;
  sectionTop: number; // the cards section's box in the viewport, px
  sectionBottom: number;
  viewportHeight: number;
  scrollingDown: boolean;
};

export type DealTrigger = "enter" | null;

// What the reader's place on the page asks for now. The entrance zone: far
// enough through the sticky range (enterAtProgress) and the cards section's
// bottom edge not yet above `outAt` of the viewport (so a load, an anchor jump
// or a scroll up from below finds it too). Play on threshold, never scrub: the
// deal is a choreography on its own clock, not the scroll's.
export function dealTrigger(frame: TriggerFrame, state: DealState, t = COIL.deal.trigger): DealTrigger {
  const height = Math.max(1, frame.viewportHeight);
  const bottom = frame.sectionBottom / height;
  const inZone = frame.stickyProgress >= t.enterAtProgress && bottom >= t.outAt;
  if (state.phase === "dealing") return null;
  if (state.phase === "dealt") return !state.spent && inZone ? "enter" : null;
  if (state.hold) return null;
  return inZone ? "enter" : null;
}

// What a click on the teaser does.
//   scroll  the deal, whose own clock scrolls the page to the cards
//   jump    the instant deal: reduced motion
//   back    already dealt: only scroll to the cards, no replay
//   none    the deal is under way
export type ClickPlan = "scroll" | "jump" | "back" | "none";

export function clickPlan(state: DealState, reducedMotion: boolean): ClickPlan {
  if (state.phase === "dealt") return reducedMotion && !state.spent ? "jump" : "back";
  if (state.phase === "dealing") return "none";
  return reducedMotion ? "jump" : "scroll";
}

// The teaser's after state: the cards are dealt, the text is back and the
// button leads back to them. While the deal plays the teaser's text is leaving
// and the button still reads "Deal me in", so the label never flips under a
// line that is still fading.
export function isAfter(state: DealState): boolean {
  return state.spent && state.phase === "dealt";
}

// The Coil may take the wheel, the pointer and the drag: the cards are dealt, or
// the Coil is unfurled and only the columns are still arriving.
export function coilIsTheirs(state: DealState): boolean {
  return state.phase === "dealt" || (state.phase === "dealing" && state.unfurled);
}

// What <html data-deal> says: "closed" until the deal starts (the init script
// writes "pending" before hydration; the same look), then "dealing", then
// "unfurled" (the Coil takes the pointer and the wheel, the columns still
// arriving), then "dealt".
export type DealAttribute = "closed" | "dealing" | "unfurled" | "dealt";

export function dealAttribute(state: DealState): DealAttribute {
  if (state.phase === "dealt") return "dealt";
  if (state.phase !== "dealing") return "closed";
  return state.unfurled ? "unfurled" : "dealing";
}

// ---- the store ----

const initial = (): DealState =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? DEAL_REDUCED : DEAL_IDLE;

let state: DealState = initial();
const listeners = new Set<() => void>();
let mirrored = false;
let debug = false;

export function getDeal(): DealState {
  return state;
}

function mirror() {
  if (!mirrored || typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-deal", dealAttribute(state));
  if (debug) {
    root.setAttribute("data-deal-phase", state.phase);
    root.setAttribute("data-deal-entrances", String(state.entrances));
  }
}

export function dispatchDeal(action: DealAction) {
  const next = dealReducer(state, action);
  if (next === state) return;
  state = next;
  mirror();
  listeners.forEach((listener) => listener());
}

// The home's controller takes the attribute over from the init script once it
// has mounted: from here <html data-deal> follows the state. The release leaves
// the last value in place (the page is going away or the home is, and the
// attribute only styles the home's own section).
export function claimDealMirror(): () => void {
  mirrored = true;
  debug = typeof location !== "undefined" && /[?&]coildebug/.test(location.search);
  mirror();
  return () => {
    mirrored = false;
  };
}

export function subscribeDeal(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverState = (): DealState => DEAL_IDLE;

export function useDeal(): DealState {
  return useSyncExternalStore(subscribeDeal, getDeal, serverState);
}

// Whether the cards have been dealt into the Coil.
export function useDealt(): boolean {
  return useDeal().phase === "dealt";
}
