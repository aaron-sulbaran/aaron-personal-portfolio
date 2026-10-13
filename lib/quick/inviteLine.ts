"use client";

import { useSyncExternalStore } from "react";

// Mode B's hero line, between the invite (components/invite/ExpressInvite.tsx,
// which decides) and the hero's own line slot (HeroOverlay's HintLine, which
// draws). The hero's other one-time lines wait while it is pending or showing.
//
//   off      no line this visit
//   pending  it may play once the hero rests
//   showing  on screen for its hold
//   chosen   the visitor took it (the invite answers and runs the transition)
//   done     gone; the other lines may play

export type InviteLinePhase = "off" | "pending" | "showing" | "chosen" | "done";

let phase: InviteLinePhase = "off";
const listeners = new Set<() => void>();

export function getInviteLine(): InviteLinePhase {
  return phase;
}

export function setInviteLine(next: InviteLinePhase) {
  if (phase === next) return;
  phase = next;
  listeners.forEach((listener) => listener());
}

export function subscribeInviteLine(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInviteLine(): InviteLinePhase {
  return useSyncExternalStore(subscribeInviteLine, getInviteLine, () => "off");
}

// The other lines hold back while this one may still play.
export const holdsOtherLines = (line: InviteLinePhase) => line === "pending" || line === "showing";
