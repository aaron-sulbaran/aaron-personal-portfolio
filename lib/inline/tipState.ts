export interface TipTarget { kind: "tip" | "pop"; key: string }
export type TipVia = "hover" | "focus" | "tap" | "grace";
export interface TipState { target: TipTarget | null; via: TipVia | null }
export type TipEvent =
  | { type: "hover" | "focus" | "press" | "tap"; target: TipTarget }
  | { type: "unhover" | "leave" | "expire" | "blur" | "dismiss" };
export const TIP_IDLE: TipState = { target: null, via: null };
export const sameTarget = (a: TipTarget | null, b: TipTarget | null): boolean => !!a && !!b && a.kind === b.kind && a.key === b.key;
// Who shows the shared label. A tap pins it until a second tap on the same
// link, a tap elsewhere or Escape; keyboard focus anchors it under the link
// (Enter toggles it); a mouse shows it while the pointer is on the link. A
// tip that holds a link lets the pointer travel from the word to the label:
// leaving either starts a short grace (TIP_GRACE_MS), and arriving on either
// before it expires (a hover on the same target) takes it back.
export const TIP_GRACE_MS = 220;
export function tipReducer(state: TipState, event: TipEvent): TipState {
  switch (event.type) {
    case "hover": return state.via === "tap" || (state.via === "focus" && sameTarget(state.target, event.target)) ? state : { target: event.target, via: "hover" };
    case "unhover": return state.via === "hover" ? TIP_IDLE : state;
    case "leave": return state.via === "hover" ? { target: state.target, via: "grace" } : state;
    case "expire": return state.via === "grace" ? TIP_IDLE : state;
    case "focus": return state.via === "tap" && sameTarget(state.target, event.target) ? state : { target: event.target, via: "focus" };
    case "blur": return state.via === "focus" ? TIP_IDLE : state;
    case "press": return sameTarget(state.target, event.target) && state.via !== "hover" ? TIP_IDLE : { target: event.target, via: "focus" };
    case "tap": return state.via === "tap" && sameTarget(state.target, event.target) ? TIP_IDLE : { target: event.target, via: "tap" };
    case "dismiss": return state.target ? TIP_IDLE : state;
  }
}
// A label that holds a link never trails the pointer: it stays under its word so the pointer can reach it.
export function tipMode(state: TipState, holdsLink = false): "follow" | "anchor" | null {
  return state.target ? (state.via === "hover" && !holdsLink ? "follow" : "anchor") : null;
}
