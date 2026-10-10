// The wave path's QA surface, only with `wavedebug` in the URL (query, or
// after the hash): window.__wavePath. Without it pathProbe() is null and every
// caller pays one null check.
export type ProbeFrame = { head: number; target: number; length: number; runLen: number; train: number | null; decided: boolean; runFlat: number };
export interface PathProbe { paints: number; ticks: number; layouts: number; frame: () => ProbeFrame | null; visibleDots: () => number }
type Read = { frame: () => ProbeFrame; visibleDots: () => number };

let probe: PathProbe | null | undefined;
let read: Read | null = null;

export function pathProbe(): PathProbe | null {
  if (probe !== undefined) return probe;
  if (typeof window === "undefined" || !/wavedebug/.test(window.location.search + window.location.hash)) return (probe = null);
  probe = { paints: 0, ticks: 0, layouts: 0, frame: () => read?.frame() ?? null, visibleDots: () => read?.visibleDots() ?? 0 };
  (window as unknown as { __wavePath: PathProbe }).__wavePath = probe;
  return probe;
}

export function attachProbe(next: Read): () => void {
  if (!pathProbe()) return () => {};
  read = next;
  return () => {
    if (read === next) read = null;
  };
}
