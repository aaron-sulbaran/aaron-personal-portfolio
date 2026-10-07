import { siteContent } from "@/lib/content";
import type { SoundtrackState } from "@/lib/soundtrack";

// The playback pill's dock rules, pure (spec section 5). The pill sits at the
// bottom left on the horizon's baseline from the band down, in every music
// state, and is hidden through the hero and the book (the Menu's note covers
// audible music there) and on phones. It lands open with one line of copy per
// state, once per page load, then collapses to the capsule.
export type DockMode = "hidden" | "label" | "capsule";
export type DockLabel = "accepted" | "declined" | "unanswered" | "returning" | "failed";

export interface DockInput {
  music: SoundtrackState;
  reached: boolean; // the band's bottom edge is above the dock line, DOCK.passedPx (bandPassed)
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
// separator ("Music? Play the soundtrack", "Paused. Open soundtrack player").
export function capsuleName(text: string, action: string): string {
  return /[.?!]$/.test(text) ? `${text} ${action}` : `${text}. ${action}`;
}

// The reader has scrolled past the band: its bottom edge is above the dock
// line (DOCK.passedPx from the viewport's top, under the header bar and an
// anchor's landing). A band below the viewport (the hero, the book) is not passed.
export function bandPassed(bottom: number, rootTop: number | null, intersecting: boolean): boolean {
  return !intersecting && bottom <= (rootTop ?? DOCK.passedPx);
}
