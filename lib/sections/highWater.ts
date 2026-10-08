// A block's reveal only rises within a page load (Aaron, 2026-10-08): the
// trigger's progress drives it up, and scrolling back up leaves it where it
// got to. Given the mark so far and what the trigger reports now: the new
// mark, whether it rose (so the chase toward it restarts), and whether the
// block is whole (so its trigger can be released).

export interface HighWater {
  reached: number;
  moved: boolean;
  done: boolean;
}

export function highWater(reached: number, incoming: number): HighWater {
  const progress = Number.isNaN(incoming) ? 0 : Math.min(1, Math.max(0, incoming));
  const next = Math.max(reached, progress);
  return { reached: next, moved: next > reached, done: next >= 1 };
}
