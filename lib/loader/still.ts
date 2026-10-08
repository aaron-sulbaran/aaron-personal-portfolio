import type { BakedLockup } from "@/lib/coil/heroStill";
import { LOADER } from "./progress";

// The loader's end, decided once the tally is done (and each frame while it
// waits), and the hero still it hands to when no scene can run. CoilStage
// provides the still before it settles the tally; the first commit's passive
// effects flush before the loader starts, so the provider is normally there
// already and "wait" is only a safety net on the fast path.

// decoded: the still fetched and decoded. target: the lockup it bakes behind
// its cards, where the visible still shows it (viewport px, after object-fit
// cover), or null while no still box shows; the loader lands its resting
// lockup there (lib/loader/stillLanding.ts).
export type StillPoster = { decoded: () => Promise<void>; target: () => BakedLockup | null };

let provider: StillPoster | null = null;
let gaveUp = false;

// A new provider is a new load: the give-up below starts over.
export function provideStillPoster(poster: StillPoster): () => void {
  provider = poster;
  gaveUp = false;
  return () => {
    if (provider === poster) provider = null;
  };
}

export function stillPoster(): StillPoster | null {
  return provider;
}

// The loader gave up on the still (lib/loader/stillGiveUp.ts) and handed its
// lockup to the h1 lockup: a still that decodes after this arrives late and
// brings its own dissolve (lib/home/stillReadiness.ts, data-still-late).
export function markStillGaveUp(): void {
  gaveUp = true;
}

export function stillGaveUp(): boolean {
  return gaveUp;
}

// The scene's lockup: none drawn, on screen to land on, or off screen.
export type LoaderTarget = "none" | "landable" | "away";
export type LoaderEnd = "rest" | "continuity" | "dissolve" | "fade" | "skip" | "wait";
export type LoaderEndInput = {
  reduced: boolean;
  paneShown: boolean; // the load outlived the guard
  target: LoaderTarget;
  still: boolean; // a still is provided: no scene can run
  waitedMs: number; // since the tally completed
};

export function loaderEnd({ reduced, paneShown, target, still, waitedMs }: LoaderEndInput): LoaderEnd {
  if (reduced) return paneShown ? "fade" : "skip";
  if (target !== "none") return !paneShown ? "rest" : target === "landable" ? "continuity" : "fade";
  if (still) return "dissolve";
  if (!paneShown && waitedMs < LOADER.handoffGiveUpMs) return "wait";
  return paneShown ? "fade" : "skip";
}
