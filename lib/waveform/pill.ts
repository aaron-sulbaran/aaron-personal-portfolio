import type { SoundtrackState } from "@/lib/soundtrack";

// The playback pill's rules, pure. The pill is a mini-player: the band under
// the book is where the music is offered and controlled, so the pill only
// appears once music has been chosen (on or paused) and the band is off
// screen, anywhere on the page. Audible music always has a visible control
// that way, and the ask is never duplicated.
export function pillVisible({ music, bandInView }: { music: SoundtrackState; bandInView: boolean }): boolean {
  return (music === "on" || music === "paused") && !bandInView;
}

// Hover choreography (spec 6.4): hover grows the capsule into a preview with a
// delayed tooltip, a click opens the card, leaving the card minimizes it but
// remembers it briefly (`recent`) so a quick re-hover snaps back, and a short
// `suppress` window stops the leave from bouncing straight back open. Timers
// live in the hook; they only dispatch tip, graceEnd and suppressEnd here.
export type PillMode = "collapsed" | "preview" | "expanded";

export interface HoverState {
  mode: PillMode;
  tip: boolean;
  recent: boolean;
  suppress: boolean;
}

export type HoverEvent =
  | { type: "enter" }
  | { type: "leave" }
  | { type: "tip" }
  | { type: "open" }
  | { type: "cardLeave" }
  | { type: "collapse" }
  | { type: "graceEnd" }
  | { type: "suppressEnd" }
  | { type: "reset" };

export const HOVER_START: HoverState = { mode: "collapsed", tip: false, recent: false, suppress: false };

export function hoverReducer(state: HoverState, event: HoverEvent): HoverState {
  switch (event.type) {
    case "enter":
      if (state.mode === "expanded" || state.suppress) return state;
      if (state.recent) return { ...state, mode: "expanded", tip: false };
      return { ...state, mode: "preview" };
    case "leave":
      return state.mode === "expanded" ? state : { ...state, mode: "collapsed", tip: false };
    case "tip":
      return state.mode === "preview" ? { ...state, tip: true } : state;
    case "open":
      return { ...state, mode: "expanded", tip: false, recent: false };
    case "cardLeave":
      return { mode: "collapsed", tip: false, recent: true, suppress: true };
    case "collapse":
      return { ...state, mode: "collapsed", tip: false, recent: false };
    case "graceEnd":
      return { ...state, recent: false };
    case "suppressEnd":
      return { ...state, suppress: false };
    case "reset":
      return HOVER_START;
  }
}
