"use client";

import { useSyncExternalStore } from "react";
import { COIL } from "@/lib/coil/constants";

// The deal's state machine (hero rework, slice 2): the cards start face down in
// the deck and are dealt into the Coil once per page load, never persisted.
//
//   idle      nothing has happened; the cards section is closed
//   riffling  the deck shuffles in place (a click, or the reader scrolling down
//             past it); the section is still closed
//   dealing   the cards fly from the deck into the Coil and the section opens
//             around them; nothing can be opened yet
//   dealt     at rest; the cards are the reader's
//
// What triggers each step is pure (dealTrigger, tested): the click path
// riffles, scrolls to the cards, then deals on arrival; the scroll path
// riffles while the cards section peeks and deals when it is far enough up; a
// load with the section already in view deals at once with no riffle. Reduced
// motion starts dealt (no riffle, no flight, no opening) but not spent: the
// fork keeps its invitation until the reader deals.

export type DealPhase = "idle" | "riffling" | "dealing" | "dealt";
export type DealSource = "click" | "scroll" | "view" | "skip" | "reduced";

export type DealState = {
  phase: DealPhase;
  // The reader has dealt (the deck, or by reaching the cards): the fork shows
  // its after state once the deal is under way.
  spent: boolean;
  // The click path is scrolling to the cards: the entrance waits for the arrival.
  hold: boolean;
  source: DealSource | null;
  // How many times each step has run this page load (QA reads them).
  riffles: number;
  entrances: number;
};

export type DealAction =
  | { type: "riffle"; source: DealSource }
  | { type: "enter"; source: DealSource }
  | { type: "finish" }
  // Everything at once: a reduced-motion click, a title chosen before the deal
  // is over, the lab's skip.
  | { type: "skip" }
  // Reduced motion came on: dealt at once, spent or not as it was.
  | { type: "reduced" }
  | { type: "hold"; on: boolean }
  | { type: "reset" };

export const DEAL_IDLE: DealState = { phase: "idle", spent: false, hold: false, source: null, riffles: 0, entrances: 0 };
export const DEAL_REDUCED: DealState = { ...DEAL_IDLE, phase: "dealt" };

export function dealReducer(state: DealState, action: DealAction): DealState {
  switch (action.type) {
    case "riffle":
      return state.phase === "idle" ? { ...state, phase: "riffling", spent: true, source: action.source, riffles: state.riffles + 1 } : state;
    case "enter":
      if (state.phase === "idle" || state.phase === "riffling") {
        return { ...state, phase: "dealing", spent: true, hold: false, source: state.source ?? action.source, entrances: state.entrances + 1 };
      }
      // Dealt without a deal (reduced motion): reaching the cards spends it.
      return state.phase === "dealt" && !state.spent ? { ...state, spent: true } : state;
    case "finish":
      return state.phase === "dealing" ? { ...state, phase: "dealt" } : state;
    case "skip":
      return state.phase === "dealt" ? (state.spent ? state : { ...state, spent: true }) : { ...state, phase: "dealt", spent: true, hold: false };
    case "reduced":
      return state.phase === "dealt" ? state : { ...state, phase: "dealt", hold: false };
    case "hold":
      return state.hold === action.on ? state : { ...state, hold: action.on };
    case "reset":
      return { ...DEAL_IDLE, riffles: state.riffles, entrances: state.entrances };
  }
}

// ---- the triggers ----

export type TriggerFrame = {
  sectionTop: number; // the cards section's box in the viewport, px
  sectionBottom: number;
  viewportHeight: number;
  scrollingDown: boolean;
};

export type DealTrigger = "riffle" | "enter" | null;

// What the cards section's place in the viewport asks for now. The entrance
// zone: its top edge at or above `enterAt` of the viewport and its bottom edge
// not yet above `outAt` (so a load or a scroll up from below finds it too). The
// riffle: only on the first way down (never on a load, never on a scroll up),
// between the section starting to peek and the entrance zone, and only when the
// knob has it on.
export function dealTrigger(frame: TriggerFrame, state: DealState, riffleOn: boolean, t = COIL.deal.trigger): DealTrigger {
  const height = Math.max(1, frame.viewportHeight);
  const top = frame.sectionTop / height;
  const bottom = frame.sectionBottom / height;
  const inZone = top <= t.enterAt && bottom >= t.outAt;
  if (state.phase === "dealing") return null;
  if (state.phase === "dealt") return !state.spent && inZone ? "enter" : null;
  if (state.hold) return null;
  if (inZone) return "enter";
  if (state.phase === "idle" && riffleOn && frame.scrollingDown && top <= t.riffleAt && top > t.enterAt) return "riffle";
  return null;
}

// What a click on the fork does.
//   riffle  the deck riffles (then the flow scrolls to the cards)
//   scroll  scroll to the cards, no deal step of its own (the riffle is off, or it ran)
//   jump    the instant deal: reduced motion
//   back    already dealt: only scroll to the cards, no replay
//   none    the deal is under way
export type ClickPlan = "riffle" | "scroll" | "jump" | "back" | "none";

export function clickPlan(state: DealState, reducedMotion: boolean, riffleOn: boolean): ClickPlan {
  if (state.phase === "dealt") return reducedMotion && !state.spent ? "jump" : "back";
  if (state.phase === "dealing") return "none";
  if (reducedMotion) return "jump";
  if (state.phase === "idle" && riffleOn) return "riffle";
  return "scroll";
}

// The fork's after state: the deck is spent, the button leads back.
export function isSpent(state: DealState): boolean {
  return state.spent && (state.phase === "dealing" || state.phase === "dealt");
}

// What <html data-deal> says: "closed" until the deal starts (the init script
// writes "pending" before hydration; the same look), then "dealing", "dealt".
export type DealAttribute = "closed" | "dealing" | "dealt";

export function dealAttribute(state: DealState): DealAttribute {
  if (state.phase === "dealt") return "dealt";
  return state.phase === "dealing" ? "dealing" : "closed";
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
    root.setAttribute("data-deal-riffles", String(state.riffles));
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
