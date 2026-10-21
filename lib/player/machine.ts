import type { Zone } from "./zone";

// Where the player lives, as one small state machine (pure; the host only
// dispatches into it, through the store in ./viewStore). The band is the
// music's home: with the band on screen the player is the card in the band,
// scrolling past it hands the player to the isle (the pill on a desktop, the
// island on a phone), and scrolling back reopens it in the band. With the band
// off screen, above or below the reader, the isle is what shows: the player is
// reachable wherever the music plays.
//
//   closed   nothing of the player's is showing (no music has started)
//   band     the player is open in the band
//   docked   the player stands open at the isle's dock: the music was started
//            below the band, or the window is too narrow to hold the card
//            beside the band's copy
//   to-pill  the band's player is handing off to the isle (the morph runs)
//   to-band  the isle is handing back to the band's player
//   pill     the player has collapsed into the isle (the pill on a desktop,
//            the island on a phone)

export type PlayerView = "closed" | "band" | "docked" | "to-pill" | "to-band" | "pill";

export interface PlayerState {
  view: PlayerView;
}

export const CLOSED: PlayerState = { view: "closed" };
const BAND: PlayerState = { view: "band" };
const PILL: PlayerState = { view: "pill" };
const DOCKED: PlayerState = { view: "docked" };

export interface MachineConfig {
  phone: boolean;
  // A desktop band wide enough (from 1024px) to hold the card beside the band's copy; narrower, the player docks instead.
  roomy: boolean;
  reduce: boolean;
}

export type PlayerEvent =
  | { type: "started"; zone: Zone }
  | { type: "zone"; zone: Zone }
  | { type: "arrived" }
  | { type: "stopped" };

export type Handoff = "morph" | "fade";

// How the band's player and the isle trade places. Reduced motion never morphs.
export const handoff = (config: MachineConfig): Handoff => (config.reduce ? "fade" : "morph");

// Whether the band can hold the player: a phone always can (it sits under the
// copy), a desktop from 1024px.
const bandHolds = (config: MachineConfig) => config.phone || config.roomy;

export function step(state: PlayerState, event: PlayerEvent, config: MachineConfig): PlayerState {
  switch (event.type) {
    case "started": {
      if (event.zone === "in") return bandHolds(config) ? BAND : DOCKED;
      // The band is not on screen: the isle it is. Pressing the pill's capsule below the band opens the player at the dock; music started anywhere else collapses into the pill.
      return !config.phone && event.zone === "past" ? DOCKED : PILL;
    }
    case "zone": {
      const how = handoff(config);
      if (event.zone === "in") {
        if (!bandHolds(config)) return state.view === "band" || state.view === "to-band" || state.view === "to-pill" ? DOCKED : state;
        if (state.view === "docked") return BAND;
        if (state.view === "pill") return { view: how === "morph" ? "to-band" : "band" };
        return state.view === "to-pill" ? { view: "to-band" } : state;
      }
      if (state.view === "band") return { view: how === "morph" ? "to-pill" : "pill" };
      return state.view === "to-band" ? { view: "to-pill" } : state;
    }
    case "arrived":
      if (state.view === "to-pill") return PILL;
      return state.view === "to-band" ? BAND : state;
    case "stopped":
      return CLOSED;
  }
}

// Whether the isle is on screen: the player has collapsed into it or stands at
// its dock. The stock capsule pill ("Music?", "Music", "Paused") steps away for
// every view but closed, since the player is the pill then.
export const isleShown = (view: PlayerView): boolean => view === "pill" || view === "docked";
export const playerOwnsPill = (view: PlayerView): boolean => view !== "closed";

// Whether the band's own player element is in the page, and on show (it stays
// mounted through a hand-off so its box can be measured, and is only hidden).
export const bandPlayerMounted = (view: PlayerView): boolean => view !== "closed" && view !== "docked";
export const bandPlayerShown = (view: PlayerView): boolean => view === "band";
