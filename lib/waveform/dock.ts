import { siteContent } from "@/lib/content";
import type { SoundtrackState } from "@/lib/soundtrack";

// The playback pill's dock rules, pure (spec section 5). The pill sits at the
// bottom centre on the horizon's baseline from the band down, in every music
// state, and is hidden through the hero and the book (the Menu's note covers
// audible music there) and on phones. It lands open with one line of copy per
// state, once per page load, then collapses to the capsule.
export type DockMode = "hidden" | "label" | "capsule";
export type DockLabel = "accepted" | "declined" | "unanswered" | "returning" | "failed";

export interface DockInput {
  music: SoundtrackState;
  reached: boolean; // the band's centre has crossed the viewport (sweep target > DOCK.arriveAtSweep)
  phone: boolean;
  labelShown: boolean; // this page load already showed the label for this state
  returning: boolean; // a stored "on" restored this session and not yet greeted
  failed: boolean; // the reconciler downgraded on to paused inside the start window
}

export const DOCK = {
  arriveMs: 600,
  holdMs: 2600,
  collapseMs: 360,
  arriveAtSweep: 0.35,
  capsulePx: 36,
  hitPx: 44,
  baselineFromBottomPx: 72,
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

// The arrival source: the band records the control the visitor pressed and
// the pill takes it once, when it next arrives, to condense out of it.
let source: DOMRect | null = null;

export function setDockSource(rect: DOMRect | null): void {
  source = rect;
}

export function takeDockSource(): DOMRect | null {
  const taken = source;
  source = null;
  return taken;
}
