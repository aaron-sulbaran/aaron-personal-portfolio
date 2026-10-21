import { useSyncExternalStore } from "react";
import type { CreditMode, NotNow, StatusLine } from "./settings";

// The few things the lab changes in the real band, pill and wave, as a tiny
// store: they read it, and in production nothing ever writes it, so they read
// today's values (TODAY below is the production behavior).
//
//   pill         "auto" is the pill's own rule (it appears once the band is
//                passed); "hold" shows it now; "away" keeps it hidden while the
//                lab's own surface stands in its place.
//   credit       where the band's credit line sits.
//   creditBelow  the lab's card is open over the band's lower right, so the
//                line rides under it as a caption.
//   status       "hidden": the lab's sheet is the feedback in the band, so the
//                band drops its status sentence and the Pause or Resume beside
//                the heading.
//   notNow       "buttons": after Not now, Play it and Freeze the wave sit
//                beside the "No problem" line, and the lone freeze link goes.
//   waveWait     null is today. A number makes the wave one line that follows
//                the scroll only while the band's bottom edge is above this
//                share of the viewport's height (in both directions; below it,
//                only the band's own run is drawn and nothing of the path
//                overlaps it), and holds it after an answer until the band
//                first scrolls away.
//   idle         0 is today. A positive number is the idle ripple's strength: a
//                gentle wave travels through the line while no music shapes it.
//   labPill      the lab's own pill stands in for the real pill's card, so the
//                band keeps its freeze link while music plays.

export type PillHold = "auto" | "hold" | "away";

export interface PlayerBridge {
  pill: PillHold;
  credit: CreditMode;
  creditBelow: boolean;
  status: StatusLine;
  notNow: NotNow;
  waveWait: number | null;
  idle: number;
  labPill: boolean;
}

export const TODAY: PlayerBridge = { pill: "auto", credit: "band", creditBelow: false, status: "today", notNow: "today", waveWait: null, idle: 0, labPill: false };

let bridge: PlayerBridge = TODAY;
const listeners = new Set<() => void>();

export const getBridge = (): PlayerBridge => bridge;

export function setBridge(patch: Partial<PlayerBridge>): void {
  const next = { ...bridge, ...patch };
  if ((Object.keys(next) as (keyof PlayerBridge)[]).every((key) => next[key] === bridge[key])) return;
  bridge = next;
  listeners.forEach((listener) => listener());
}

export function resetBridge(): void {
  setBridge(TODAY);
}

export const subscribeBridge = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function usePlayerBridge(): PlayerBridge {
  return useSyncExternalStore(subscribeBridge, () => bridge, () => TODAY);
}

export function pillReached(pill: PillHold, passed: boolean): boolean {
  if (pill === "hold") return true;
  if (pill === "away") return false;
  return passed;
}
