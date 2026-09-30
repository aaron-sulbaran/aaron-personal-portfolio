import type { CoilGeometry, Quad, Silhouette } from "@/lib/coil/geometry";
import type { CoilSceneApi } from "./types";

// The scene's QA surface, all behind ?coildebug (and the ?name / ?drift picks
// it shares a parser with): the tokens, the window.__coil stats object the
// Playwright suite reads, and (with the flight token) the probe's scene hooks.
// Without the query nothing here is created and every call is a null check.
//
// Tokens: poster (the field's first frame, no cards, no name), nocards,
// noname, at=<s> (the field and the fill held on one moment), entrance=<ms>
// (the drawn entrance frozen there), throw=render, throw=frame (the error
// boundary paths), flight (lib/coil/flightProbe.ts). Any value turns on
// window.__coil.

export function debugTokens() {
  const value = new URLSearchParams(window.location.search).get("coildebug");
  return new Set(value ? value.split(",").map((token) => token.trim()) : []);
}

export type DebugFlags = {
  debugMode: string | null;
  posterMode: boolean;
  // QA only: ?coildebug=nocards hides the helix and noname the name (contrast
  // and warm-share reads); at=<seconds> holds the field and the fill on one
  // moment.
  hideCards: boolean;
  hideName: boolean;
  heldAt: number | null;
  // ?coildebug=entrance=<ms> freezes the drawn entrance at that moment (the
  // real clock still ends it, so the page unlocks).
  forcedEntranceMs: number | null;
  // The live picks: ?name=<fill> and ?drift=<preset>.
  nameParam: string | null;
  driftParam: string | null;
};

export function readDebugFlags(): DebugFlags {
  const params = new URLSearchParams(window.location.search);
  const debugMode = params.get("coildebug");
  const qaTokens = debugTokens();
  const heldAtToken = [...qaTokens].map((token) => token.match(/^at=(\d+(?:\.\d+)?)$/)).find(Boolean);
  const forcedEntrance = debugMode
    ?.split(",")
    .map((token) => token.trim().match(/^entrance=(-?\d+(?:\.\d+)?)$/))
    .find(Boolean);
  return {
    debugMode,
    posterMode: debugMode === "poster",
    hideCards: qaTokens.has("nocards"),
    hideName: qaTokens.has("noname"),
    heldAt: heldAtToken ? Number(heldAtToken[1]) : null,
    forcedEntranceMs: forcedEntrance ? Number(forcedEntrance[1]) : null,
    nameParam: params.get("name"),
    driftParam: params.get("drift"),
  };
}

// Slice 7, QA only: ?coildebug=throw=frame throws from the loop a second in.
export function throwFrameAt() {
  return debugTokens().has("throw=frame") ? performance.now() + 1000 : Number.POSITIVE_INFINITY;
}

export type DebugStats = {
  intervals: number[];
  work: number[];
  steps: number[];
  envelope: number[];
  captured: number;
  released: number;
  geo?: CoilGeometry;
  offset: () => number;
  hovered: () => number;
  capturing: () => boolean;
  // ---- fx-input debug: the live wheel owner and the helix hull ----
  owner?: () => "coil" | "page" | "none";
  silhouette?: () => Silhouette | null;
  // ---- end fx-input debug ----
  api?: CoilSceneApi;
  // Slice 7: what the scene spends, as live (the DPR in use, the buffer,
  // the card textures actually uploaded).
  budget?: () => object;
  // Slice 7: every visible card's bent corners in viewport px (for the
  // header and greeting overlap checks).
  visibleQuads?: () => Quad[];
  // ---- fx-hero debug: CPU ms of the name pass (the fill's clock and the repel) per frame ----
  namePass?: number[];
  nameFx?: () => object;
  // ---- end fx-hero debug ----
  // Slice 4: the entrance clock and the name.
  entrance?: () => object;
  // Slice 5: the unwind and the row focus.
  unwindAt?: number[];
  unwindState?: () => object;
  unwindMs?: () => number;
  focusKey?: () => string | null;
  // Slice 7: the touch drag.
  drag?: () => object;
};

export type DebugReads = {
  offset: () => number;
  hovered: () => number;
  capturing: () => boolean;
  owner: () => "coil" | "page" | "none";
  silhouette: () => Silhouette | null;
};

// The stats object, installed as window.__coil (only with ?coildebug).
export function createDebugStats(flags: DebugFlags, reads: DebugReads): DebugStats | null {
  const debug: DebugStats | null = flags.debugMode
    ? {
        intervals: [],
        work: [],
        steps: [],
        envelope: [],
        captured: 0,
        released: 0,
        ...reads,
      }
    : null;
  if (debug) (window as unknown as { __coil?: DebugStats }).__coil = debug;
  return debug;
}

export function removeDebugStats(debug: DebugStats | null) {
  if (debug) delete (window as unknown as { __coil?: DebugStats }).__coil;
}

export function pushStat(list: number[], value: number) {
  list.push(value);
  if (list.length > 6000) list.shift();
}
