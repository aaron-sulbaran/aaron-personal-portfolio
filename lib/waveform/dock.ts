import { siteContent } from "@/lib/content";
import type { SoundtrackState } from "@/lib/soundtrack";

// The stock playback pill's dock rules, pure (spec section 5). The pill sits at
// the bottom left on the dock's line from the band down whenever the player
// (components/player) is not the pill, and is hidden through the hero and the
// book and on phones. It lands open with one line of copy per state, once per
// page load, then collapses to the capsule.
export type DockMode = "hidden" | "label" | "capsule";
export type DockLabel = "accepted" | "declined" | "unanswered" | "returning" | "failed";

export interface DockInput {
  music: SoundtrackState;
  reached: boolean; // the band's bottom edge is above the dock line, DOCK.passedPx (useBandPassed's ScrollTrigger)
  phone: boolean;
  labelShown: boolean; // this page load already showed the label for this state
  returning: boolean; // a stored "on" restored this session and not yet greeted
  failed: boolean; // the reconciler downgraded on to paused inside the start window
}

export const DOCK = {
  fadeMs: 300,
  holdMs: 2600,
  collapseMs: 360,
  // The dock line: the header bar (72px) plus the sections' anchor landing
  // (scroll-mt-24, 96px) and slack: a reader at an anchor below the band has passed it.
  passedPx: 112,
  capsulePx: 36,
  hitPx: 44,
  baselineFromBottomPx: 72,
  insetPx: 24, // the header mark's sm:left-6, so the mark and the pill share one left edge
};

export function dockMode(input: DockInput): DockMode {
  if (input.phone || !input.reached) return "hidden";
  return input.labelShown ? "capsule" : "label";
}

// Whether the open label's hold (DOCK.holdMs) is counting down: the pill has
// landed open and no deal is playing. The deal is a cutscene that holds the
// screen for about 3 s (lib/home/dealLock.ts), and the band is a short scroll
// above its trigger, so a label that lands on the way down would spend its whole
// hold under it, unread (a returning visitor's "Welcome back" collapsed mid-deal).
// While the deal plays the label stays open and its clock waits; it starts from
// the top once the deal is dealt. Where no deal plays (a deep load, reduced
// motion, cards already dealt) it counts from the landing, as it always did.
export function labelHoldRuns({ mode, landed, dealPlaying }: { mode: DockMode; landed: boolean; dealPlaying: boolean }): boolean {
  return mode === "label" && landed && !dealPlaying;
}

export function dockLabel(input: DockInput): DockLabel {
  if (input.failed) return "failed";
  if (input.returning) return "returning";
  if (input.music === "off") return "declined";
  if (input.music === "before") return "unanswered";
  return "accepted";
}

export function capsuleText(music: SoundtrackState, trackTitle: string): string {
  const c = siteContent.soundtrack;
  if (music === "on") return trackTitle;
  if (music === "paused") return c.capsulePaused;
  if (music === "before") return c.capsuleUnanswered;
  return c.capsuleOff;
}

// The capsule's accessible name: its visible text, then its action, with one
// separator ("Music? Play the soundtrack", "Paused. Resume the soundtrack").
export function capsuleName(text: string, action: string): string {
  return /[.?!]$/.test(text) ? `${text} ${action}` : `${text}. ${action}`;
}
