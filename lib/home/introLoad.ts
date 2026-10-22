// The loader's tally: a weighted sum of what really resolves, never a timer
// dressed up as progress (restored from the retired loader, a230df4^,
// lib/loader/progress.ts, cut to page 1's two items):
//
//   fonts   Profa Black (the name) and the rest of document.fonts settled
//   field   the name's field drew its first live frame, or, where it cannot
//           run (reduced motion, no WebGL 2, a failed chunk), its poster decoded
//
// Monotonic (an item's fraction only rises), reads 1 only once every item has
// resolved, and gives up at the cap: a stalled asset then counts as resolved,
// so the loader always completes and the page is never held hostage. Pure:
// time comes in through check(nowMs), so the tests drive it directly.

export type LoadItem = "fonts" | "field";

export const LOAD_WEIGHTS: Readonly<Record<LoadItem, number>> = { fonts: 0.35, field: 0.65 };
export const INTRO_ITEMS: readonly LoadItem[] = ["fonts", "field"];

export type LoadTally = {
  report: (item: LoadItem, fraction?: number) => void;
  // Resolves every listed item at once (the field failed or went away).
  settle: (items?: readonly LoadItem[]) => void;
  // Applies the give-up once nowMs passes the deadline.
  check: (nowMs: number) => void;
  progress: () => number; // 0 to 1, 1 only when done
  done: () => boolean;
  gaveUp: () => boolean;
};

export type TallyOptions = {
  items: readonly LoadItem[];
  startMs: number;
  giveUpMs: number;
  weights?: Readonly<Record<LoadItem, number>>;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

export function createLoadTally({ items, startMs, giveUpMs, weights = LOAD_WEIGHTS }: TallyOptions): LoadTally {
  const tracked = new Set(items);
  const fractions = new Map<LoadItem, number>(items.map((item) => [item, 0]));
  const total = items.reduce((sum, item) => sum + weights[item], 0);
  let gaveUp = false;
  let peak = 0;
  const allResolved = () => items.every((item) => (fractions.get(item) ?? 0) >= 1);
  const raise = (item: LoadItem, fraction: number) => {
    if (!tracked.has(item)) return;
    const next = clamp01(fraction);
    if (next > (fractions.get(item) ?? 0)) fractions.set(item, next);
  };
  return {
    report: (item, fraction = 1) => raise(item, fraction),
    settle: (list = items) => list.forEach((item) => raise(item, 1)),
    check(nowMs) {
      if (gaveUp || allResolved() || nowMs - startMs < giveUpMs) return;
      gaveUp = true;
      items.forEach((item) => fractions.set(item, 1));
    },
    progress() {
      if (total <= 0 || allResolved()) return 1;
      const sum = items.reduce((acc, item) => acc + weights[item] * (fractions.get(item) ?? 0), 0);
      // Strictly below 1 until every item resolved, and never backwards.
      peak = Math.max(peak, Math.min(sum / total, 0.999));
      return peak;
    },
    done: allResolved,
    gaveUp: () => gaveUp,
  };
}

// The displayed number: whole percent, 100 only once the load is done.
export function displayPercent(progress: number, done: boolean): number {
  if (done) return 100;
  return Math.min(99, Math.floor(clamp01(progress) * 100));
}

// The fill the loader shows is never ahead of what has really loaded, and never
// faster than its shortest run (`fillMs`): the real tally caps it, the clock
// lifts it. Once everything has loaded it follows the clock to full.
export function fillTarget(tallyProgress: number, tallyDone: boolean, elapsedMs: number, fillMs: number): number {
  const lift = 1 - (1 - clamp01(fillMs > 0 ? elapsedMs / fillMs : 1)) ** 2;
  return tallyDone ? lift : Math.min(lift, clamp01(tallyProgress));
}

// The loader is full: the shortest run has passed and everything loaded.
export function fillComplete(tallyDone: boolean, elapsedMs: number, fillMs: number): boolean {
  return tallyDone && elapsedMs >= fillMs;
}

// The shown fill chases its target, exponentially (rate per second), and lands
// exactly on a full target.
export function easeFill(shown: number, target: number, dtSec: number, rate = 14): number {
  if (target >= 1) return 1;
  return shown + (target - shown) * (1 - Math.exp(-Math.max(0, dtSec) * rate));
}

// The percent shows only for a load still running at `afterMs`, never a status word.
export function showNumber(elapsedMs: number, tallyDone: boolean, afterMs: number): boolean {
  return elapsedMs >= afterMs && !tallyDone;
}

// ---------------------------------------------------------------- the page's tally

// What the page has already reported, kept for the page's life: the field may
// draw its first frame before the loader begins its run (and a replay begins a
// new run with the field long since drawn).
const facts = new Map<LoadItem, number>();
let current: LoadTally | null = null;

export function reportIntroLoad(item: LoadItem, fraction = 1): void {
  facts.set(item, Math.max(facts.get(item) ?? 0, clamp01(fraction)));
  current?.report(item, fraction);
}

export function beginIntroLoad(startMs: number, giveUpMs: number): LoadTally {
  const tally = createLoadTally({ items: INTRO_ITEMS, startMs, giveUpMs });
  facts.forEach((fraction, item) => tally.report(item, fraction));
  current = tally;
  return tally;
}

export function endIntroLoad(tally: LoadTally): void {
  if (current === tally) current = null;
}

export function resetIntroLoadFacts(): void {
  facts.clear();
}
