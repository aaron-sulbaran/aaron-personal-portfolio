// The scene's ?coildebug and ?drift flags, parsed from a query string. Pure,
// so the token rules are tested; components/coil/scene/debug.ts reads the
// page's own search. Token list and meanings: scene/debug.ts.
export type DebugFlags = {
  debugMode: string | null;
  // ?coildebug=poster: the field's first frame, no cards, no name.
  posterMode: boolean;
  // ?coildebug=still: the scene at rest for the hero stills
  // (scripts/render-posters.mjs): cards and name drawn, nothing moving.
  stillMode: boolean;
  // The poster and the still hold one moment: the field clock at 0 (the
  // posters' fieldClocks(0), lib/coil/drift.ts), the entrance finished, the
  // conveyor idle at its start, the name's surface clock and wake still.
  pinned: boolean;
  hideCards: boolean;
  hideName: boolean;
  heldAt: number | null;
  forcedEntranceMs: number | null;
  inkOverride: number | null;
  driftParam: string | null;
};

export function parseDebugFlags(search: string): DebugFlags {
  const params = new URLSearchParams(search);
  const debugMode = params.get("coildebug");
  const tokens = new Set(debugMode ? debugMode.split(",").map((token) => token.trim()) : []);
  const match = (pattern: RegExp) => [...tokens].map((token) => token.match(pattern)).find(Boolean);
  const heldAt = match(/^at=(\d+(?:\.\d+)?)$/);
  const ink = match(/^ink=(\d+(?:\.\d+)?)$/);
  const forced = match(/^entrance=(-?\d+(?:\.\d+)?)$/);
  const posterMode = debugMode === "poster";
  const stillMode = tokens.has("still");
  return {
    debugMode,
    posterMode,
    stillMode,
    pinned: posterMode || stillMode,
    hideCards: tokens.has("nocards"),
    hideName: tokens.has("noname"),
    heldAt: heldAt ? Number(heldAt[1]) : null,
    inkOverride: ink ? Math.min(1, Number(ink[1]) / 100) : null,
    forcedEntranceMs: forced ? Number(forced[1]) : null,
    driftParam: params.get("drift"),
  };
}

// The field's clock (seconds) this frame: 0 when pinned, else the at= hold, else the live clock.
export function heldFieldS(flags: Pick<DebugFlags, "pinned" | "heldAt">, elapsedS: number): number {
  return flags.pinned ? 0 : (flags.heldAt ?? elapsedS);
}
