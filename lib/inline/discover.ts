// When a word counts as met, and what a photo pop needs ready before it opens.
// A tip or pop is discovered once its label has stayed shown for
// DISCOVER_DWELL_MS (useTipController): a word passing under the pointer while
// the page scrolls shows its label for a moment, but that is not a look, so the
// word fills for good only after a beat. The clock belongs to the word, not to
// how it is shown, so hover, grace, focus and tap on the same word share one
// dwell. A definition is met when it opens (useDefinition), never here.
import type { TipState } from "./tipState";
import { tipView, type PopPhoto } from "./view";
import { visitedId } from "./visited";

export const DISCOVER_DWELL_MS = 600;

export function discoverableId({ target }: TipState): string | null {
  if (!target || target.kind === "def" || !tipView(target.kind, target.key)) return null;
  return visitedId({ kind: target.kind, key: target.key, href: null });
}

// Every photo a pop shows the moment it opens: its one photo, or each frame of
// a pop that cycles (PopCycle renders them all at once). usePopWarmup loads
// these before a hover, so a label opens on its own photo at once.
export function popPhotos(key: string): PopPhoto[] {
  const view = tipView("pop", key);
  if (!view) return [];
  if (view.cycle) return view.cycle.map((frame) => frame.photo);
  return view.photo ? [view.photo] : [];
}
