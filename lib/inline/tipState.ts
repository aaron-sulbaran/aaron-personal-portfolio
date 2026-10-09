export interface TipTarget { kind: "tip" | "pop"; key: string }
export type TipVia = "hover" | "focus" | "tap";
export interface TipState { target: TipTarget | null; via: TipVia | null }
export type TipEvent =
  | { type: "hover" | "focus" | "press" | "tap"; target: TipTarget }
  | { type: "unhover" | "blur" | "dismiss" };
export const TIP_IDLE: TipState = { target: null, via: null };
export const sameTarget = (a: TipTarget | null, b: TipTarget | null): boolean => !!a && !!b && a.kind === b.kind && a.key === b.key;
// Who shows the shared label. A tap pins it until a second tap on the same
// link, a tap elsewhere or Escape; keyboard focus anchors it under the link
// (Enter toggles it); a mouse shows it while the pointer is on the link.
export function tipReducer(state: TipState, event: TipEvent): TipState {
  switch (event.type) {
    case "hover": return state.via === "tap" || (state.via === "focus" && sameTarget(state.target, event.target)) ? state : { target: event.target, via: "hover" };
    case "unhover": return state.via === "hover" ? TIP_IDLE : state;
    case "focus": return state.via === "tap" && sameTarget(state.target, event.target) ? state : { target: event.target, via: "focus" };
    case "blur": return state.via === "focus" ? TIP_IDLE : state;
    case "press": return sameTarget(state.target, event.target) && state.via !== "hover" ? TIP_IDLE : { target: event.target, via: "focus" };
    case "tap": return state.via === "tap" && sameTarget(state.target, event.target) ? TIP_IDLE : { target: event.target, via: "tap" };
    case "dismiss": return state.target ? TIP_IDLE : state;
  }
}
export function tipMode(state: TipState): "follow" | "anchor" | null {
  return state.target ? (state.via === "hover" ? "follow" : "anchor") : null;
}
