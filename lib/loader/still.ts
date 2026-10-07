import { LOADER } from "./progress";

// The loader's end, decided once the tally is done (and each frame while it
// waits), and the hero still it hands to when no scene can run. CoilStage
// provides the still before it settles the tally; the first commit's passive
// effects flush before the loader starts, so the provider is normally there
// already and "wait" is only a safety net on the fast path.

export type StillPoster = { decoded: () => Promise<void> };

let provider: StillPoster | null = null;

export function provideStillPoster(poster: StillPoster): () => void {
  provider = poster;
  return () => {
    if (provider === poster) provider = null;
  };
}

export function stillPoster(): StillPoster | null {
  return provider;
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
