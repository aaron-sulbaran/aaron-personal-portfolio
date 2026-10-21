import type { PillHold } from "./bridge";
import type { BackUp, IntoIsle, OnPlay, PhoneMode } from "./settings";
import type { Zone } from "./zone";

// Where the lab's player lives, as one small state machine (pure; the
// components only dispatch into it). The band is the music's home hub: with
// the band on screen the player is the sheet in the band, scrolling past it
// hands the player to the isle, scrolling back reopens it in the band, and
// scrolling further up (the book, the hero) leaves it parked in the band, with
// no isle above the band.
//
//   closed   nothing of the lab's is showing (the site as it is today)
//   band     the player is open in the band (parked there when the band is off
//            screen above the reader)
//   docked   the player stands open at the isle's dock: the music was started
//            below the band, or the pill was pressed there, or the window is
//            too narrow to hold it beside the band's copy
//   to-pill  the band's player is handing off to the pill (the morph runs)
//   to-band  the pill is handing back to the band's player
//   pill     the player has collapsed into the isle (the pill on a desktop;
//            the island or the slim bottom bar on a phone)

export type PlayerView = "closed" | "band" | "docked" | "to-pill" | "to-band" | "pill";

export interface PlayerState {
  view: PlayerView;
}

export const CLOSED: PlayerState = { view: "closed" };
const BAND: PlayerState = { view: "band" };
const PILL: PlayerState = { view: "pill" };
const DOCKED: PlayerState = { view: "docked" };

export interface MachineConfig {
  onPlay: OnPlay;
  intoIsle: IntoIsle;
  backUp: BackUp;
  phone: boolean;
  phoneMode: PhoneMode;
  // A desktop band wide enough (from 1024px) to hold the card beside the band's copy; narrower, the player docks instead.
  roomy: boolean;
  reduce: boolean;
}

export type PlayerEvent =
  | { type: "started"; zone: Zone }
  | { type: "line"; past: boolean }
  | { type: "arrived" }
  | { type: "close"; pillReady: boolean }
  | { type: "open"; zone: Zone }
  | { type: "stopped" }
  | { type: "reset" };

export type Handoff = "none" | "morph" | "fade";

// How the band's player leaves for the isle. Phones have no pill: the island
// or the slim bar is the isle there, and it takes the fade unless the morph is
// chosen. Reduced motion never morphs.
export function handoff(config: MachineConfig): Handoff {
  const desktop: Handoff = config.intoIsle === "today" ? "none" : config.intoIsle;
  const chosen: Handoff = config.phone ? (config.phoneMode === "band" ? "none" : config.intoIsle === "morph" ? "morph" : "fade") : desktop;
  return chosen === "morph" && config.reduce ? "fade" : chosen;
}

// Whether the band can hold the player: a phone always can (it sits under the
// copy), a desktop from 1024px.
const bandHolds = (config: MachineConfig) => config.phone || config.roomy;

export function step(state: PlayerState, event: PlayerEvent, config: MachineConfig): PlayerState {
  switch (event.type) {
    case "started": {
      if (config.onPlay === "today") return CLOSED;
      if (!bandHolds(config)) return DOCKED;
      if (event.zone !== "past") return BAND;
      if (config.phone) return config.phoneMode === "band" ? BAND : PILL;
      return DOCKED;
    }
    case "line": {
      const how = handoff(config);
      if (event.past) {
        if (how === "none") return state;
        if (state.view === "band") return { view: how === "morph" ? "to-pill" : "pill" };
        return state.view === "to-band" ? { view: "to-pill" } : state;
      }
      if (config.backUp !== "reopen") return state;
      if (state.view === "docked") return bandHolds(config) ? BAND : state;
      if (state.view === "pill") return { view: how === "morph" ? "to-band" : "band" };
      return state.view === "to-pill" ? { view: "to-band" } : state;
    }
    case "arrived":
      if (state.view === "to-pill") return PILL;
      return state.view === "to-band" ? BAND : state;
    case "close":
      if (state.view === "docked") return event.pillReady ? PILL : CLOSED;
      return state.view === "band" ? CLOSED : state;
    case "open": {
      if (state.view !== "pill") return state;
      if (event.zone === "in" && bandHolds(config)) return { view: handoff(config) === "morph" ? "to-band" : "band" };
      return DOCKED;
    }
    case "stopped":
    case "reset":
      return CLOSED;
  }
}

// What the real pill does while the lab's player is in a given view. A pill
// the player has collapsed into stays up wherever the reader is, except in the
// hero and the book (the band still below the fold), where the pill is never
// shown and the Menu's note covers the music.
export function pillHold(view: PlayerView, ahead: boolean): PillHold {
  if (view === "pill") return ahead ? "auto" : "hold";
  return view === "docked" || view === "to-pill" || view === "to-band" ? "away" : "auto";
}

// Whether the band's own player element is on show (it stays mounted through a
// hand-off so its box can be measured, and is only hidden).
export const bandPlayerShown = (view: PlayerView): boolean => view === "band";
export const bandPlayerMounted = (view: PlayerView): boolean => view !== "closed" && view !== "docked";
