import type { PillHold } from "./bridge";
import type { BackUp, IntoIsle, OnPlay, PhoneMode } from "./settings";
import type { Zone } from "./zone";

// Where the lab's player lives, as one small state machine (pure; the
// components only dispatch into it).
//
//   closed   nothing of the lab's is showing (the site as it is today)
//   band     the player is open in the band
//   docked   the player is open at the isle's dock, because it was started
//            away from the band (or opened from the pill)
//   to-pill  the band's player is handing off to the pill (the morph runs)
//   to-band  the pill is handing back to the band's player
//   pill     the player has collapsed into the isle (the pill; on phones, the
//            slim bottom bar)
//
// `home` is where the isle hands back to: scrolling back up reopens a player
// that left the band, never one that was docked.

export type PlayerView = "closed" | "band" | "docked" | "to-pill" | "to-band" | "pill";
export type Home = "band" | "dock";

export interface PlayerState {
  view: PlayerView;
  home: Home;
}

export const CLOSED: PlayerState = { view: "closed", home: "band" };

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

// How the band's player leaves for the isle. Phones have no pill: the slim bar
// is the isle there, and it takes the fade unless the morph is chosen. Reduced
// motion never morphs.
export function handoff(config: MachineConfig): Handoff {
  const desktop: Handoff = config.intoIsle === "today" ? "none" : config.intoIsle;
  const chosen: Handoff = config.phone ? (config.phoneMode === "bar" ? (config.intoIsle === "morph" ? "morph" : "fade") : "none") : desktop;
  return chosen === "morph" && config.reduce ? "fade" : chosen;
}

const band: PlayerState = { view: "band", home: "band" };

export function step(state: PlayerState, event: PlayerEvent, config: MachineConfig): PlayerState {
  switch (event.type) {
    case "started": {
      if (config.onPlay === "today") return CLOSED;
      if (config.phone) return event.zone === "in" || config.phoneMode === "band" ? band : { view: "pill", home: "band" };
      return event.zone === "in" && config.roomy ? band : { view: "docked", home: "dock" };
    }
    case "line": {
      const how = handoff(config);
      if (state.home !== "band" || how === "none") return state;
      if (event.past) {
        if (state.view === "band") return { view: how === "morph" ? "to-pill" : "pill", home: "band" };
        return state.view === "to-band" ? { view: "to-pill", home: "band" } : state;
      }
      if (config.backUp !== "reopen") return state;
      if (state.view === "pill") return { view: how === "morph" ? "to-band" : "band", home: "band" };
      return state.view === "to-pill" ? { view: "to-band", home: "band" } : state;
    }
    case "arrived":
      if (state.view === "to-pill") return { ...state, view: "pill" };
      return state.view === "to-band" ? { ...state, view: "band" } : state;
    case "close":
      if (state.view === "docked") return event.pillReady ? { view: "pill", home: "dock" } : CLOSED;
      return state.view === "band" ? CLOSED : state;
    case "open": {
      if (state.view !== "pill") return state;
      if (state.home === "band" && event.zone === "in") return { view: handoff(config) === "morph" ? "to-band" : "band", home: "band" };
      return { view: "docked", home: "dock" };
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
export const bandPlayerMounted = (view: PlayerView, home: Home): boolean => home === "band" && view !== "closed" && view !== "docked";
