// The loader's truthful tally: a weighted sum of real assets resolving, never
// a timer dressed up as progress. The Coil home reports four items:
//
//   fonts     Profa Black (the name) and the rest of document.fonts settled
//   chunk     the scene's dynamic chunk (three and all) imported
//   textures  each strand card's photo or logo source loaded (a fraction)
//   frame     the scene drew its first field frame
//
// Without a scene (reduced motion, no WebGL 2) only the fonts count. The tally
// is monotonic (an item's fraction only ever rises), reads 1 only once every
// item has resolved, and gives up at 6s: a stalled asset then counts as
// resolved so the loader always completes and the page is never held hostage.
//
// Pure: time comes in through check(nowMs), so the tests drive it directly.

export type LoadItem = "fonts" | "chunk" | "textures" | "frame";

export const LOAD_WEIGHTS: Readonly<Record<LoadItem, number>> = {
  fonts: 0.15,
  chunk: 0.25,
  textures: 0.45,
  frame: 0.15,
};

export const SCENE_ITEMS: readonly LoadItem[] = ["fonts", "chunk", "textures", "frame"];
export const FONT_ITEMS: readonly LoadItem[] = ["fonts"];

// The loader's timing (docs/design-decisions-2026-09-28.md section 3).
export const LOADER = {
  guardMs: 250, // nothing shows before this; a load done sooner skips the loader
  numberAfterMs: 600, // the number shows only for loads still running here
  holdMs: 150, // at 100, before the exit
  exitMs: 800, // the continuity exit, on the site ease
  reducedFadeMs: 300, // reduced motion (and no scene): a plain fade
  giveUpMs: 6000, // a stalled asset counts as resolved after this
  // The entrance starts this long before the exit ends (the scaffold allows
  // up to 250ms of overlap): the stack gathers as the name settles.
  entranceOverlapMs: 200,
} as const;

export type LoadTally = {
  // Raises an item's resolved fraction (0 to 1); lower values are ignored.
  report: (item: LoadItem, fraction?: number) => void;
  // Resolves every listed item at once (the scene failed or went away).
  settle: (items?: readonly LoadItem[]) => void;
  // Applies the give-up once nowMs passes the deadline.
  check: (nowMs: number) => void;
  progress: () => number; // 0 to 1, 1 only when done
  done: () => boolean;
  gaveUp: () => boolean;
  subscribe: (listener: () => void) => () => void;
};

export type TallyOptions = {
  items: readonly LoadItem[];
  startMs: number;
  giveUpMs?: number;
  weights?: Readonly<Record<LoadItem, number>>;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

export function createLoadTally({
  items,
  startMs,
  giveUpMs = LOADER.giveUpMs,
  weights = LOAD_WEIGHTS,
}: TallyOptions): LoadTally {
  const tracked = new Set(items);
  const fractions = new Map<LoadItem, number>(items.map((item) => [item, 0]));
  const total = items.reduce((sum, item) => sum + weights[item], 0);
  const listeners = new Set<() => void>();
  let gaveUp = false;
  let peak = 0;

  const allResolved = () => items.every((item) => (fractions.get(item) ?? 0) >= 1);
  const emit = () => listeners.forEach((listener) => listener());

  function raise(item: LoadItem, fraction: number) {
    if (!tracked.has(item)) return false;
    const next = clamp01(fraction);
    if (next <= (fractions.get(item) ?? 0)) return false;
    fractions.set(item, next);
    return true;
  }

  const tally: LoadTally = {
    report(item, fraction = 1) {
      if (raise(item, fraction)) emit();
    },
    settle(list = items) {
      let changed = false;
      list.forEach((item) => {
        changed = raise(item, 1) || changed;
      });
      if (changed) emit();
    },
    check(nowMs) {
      if (gaveUp || allResolved() || nowMs - startMs < giveUpMs) return;
      gaveUp = true;
      items.forEach((item) => fractions.set(item, 1));
      emit();
    },
    progress() {
      if (total <= 0 || allResolved()) return 1;
      const sum = items.reduce((acc, item) => acc + weights[item] * (fractions.get(item) ?? 0), 0);
      // Strictly below 1 until every item resolved, and never backwards.
      peak = Math.max(peak, Math.min(sum / total, 0.999));
      return peak;
    },
    done: () => allResolved(),
    gaveUp: () => gaveUp,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return tally;
}

// The displayed number: whole percent, 100 only once the tally is done.
export function displayPercent(progress: number, done: boolean) {
  if (done) return 100;
  return Math.min(99, Math.floor(clamp01(progress) * 100));
}

// ---------------------------------------------------------------- the page's tally

// One tally per home mount: the controller begins it before paint, and the
// stage, the scene and the loader report into it without a React render.
let current: LoadTally | null = null;

// A debug delay (?coildebug=slow) so a cached local build can show a slow
// load: each item lands no earlier than its slot in this schedule (ms since
// the tally began). Truthful to the real events, only later.
export const SLOW_SCHEDULE_MS: Readonly<Record<LoadItem, readonly [number, number]>> = {
  fonts: [500, 500],
  chunk: [1100, 1100],
  textures: [1300, 2700], // fraction 0 at the first value, 1 at the second
  frame: [3000, 3000],
};

export function slowDelay(item: LoadItem, fraction: number, sinceStartMs: number) {
  const [from, to] = SLOW_SCHEDULE_MS[item];
  const due = from + (to - from) * clamp01(fraction);
  return Math.max(0, due - sinceStartMs);
}

// The ?coildebug tokens, comma separated ("slow,handoff").
export function coilDebugFlags(search: string): Set<string> {
  const value = new URLSearchParams(search).get("coildebug");
  return new Set(value ? value.split(",").map((token) => token.trim()) : []);
}

export function beginHomeLoad(items: readonly LoadItem[], startMs: number, slow = false): LoadTally {
  const tally = createLoadTally({ items, startMs });
  if (!slow) {
    current = tally;
    return tally;
  }
  const report = tally.report;
  const settle = tally.settle;
  const later = (fn: () => void, item: LoadItem, fraction: number) => {
    const wait = slowDelay(item, fraction, performance.now() - startMs);
    if (wait <= 0) fn();
    else window.setTimeout(fn, wait);
  };
  current = {
    ...tally,
    report: (item, fraction = 1) => later(() => report(item, fraction), item, fraction),
    settle: (list = items) => list.forEach((item) => later(() => settle([item]), item, 1)),
  };
  return current;
}

export function homeLoad(): LoadTally | null {
  return current;
}

export function reportHomeLoad(item: LoadItem, fraction = 1) {
  current?.report(item, fraction);
}

export function settleHomeLoad(items?: readonly LoadItem[]) {
  current?.settle(items);
}

export function endHomeLoad(tally: LoadTally) {
  if (current === tally) current = null;
}
