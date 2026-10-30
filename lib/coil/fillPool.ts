// Which titles hold a WebGL context of their own right now (the title fill,
// components/coil/fill/pool.ts). One canvas a title, created only near the
// viewport and released once far, with at most FILL_POOL.cap of them alive at
// once on top of the Coil's: the nearest titles that want one get one. Pure.
//
//   near   within `nearViewports` of the viewport: a title may start one
//   far    more than `farViewports` away: a title lets its one go
//   in between, a title keeps what it has (no thrash at the edge).

export const FILL_POOL = {
  cap: 2,
  nearViewports: 1,
  farViewports: 2,
} as const;

// Titles held in their own ink, not the fill: none. The bar is 3:1 against
// what is really behind a title (lib/coil/letterContrast.ts titleContrast).
// Page 2's ("work") sits on the Coil's blue field, and its letters are made of
// that field behind them (TitleFill backdrop "coil"), so the ink's floor stands
// off the real backdrop. It reads 3.5:1 in dark and on a phone, and 2.75:1 at
// its weakest at 1280 in light (2026-10-30), where the field is palest: the
// floor's 0.31 of OKLab lightness gives no more there. Aaron chose the fill
// anyway ("part two title has to include the gradient", 2026-10-30), a known
// gap, and the name's floor stays where it is. A title named here would wait in
// its ink; ?coildebug=fill-all draws it regardless.
export const FILL_HELD_IN_INK: readonly string[] = [];

export type PoolEntry = {
  readonly id: string;
  readonly alive: boolean;
  // May it draw at all now (motion allowed, WebGL, its own gate: page 2's waits out the deal).
  readonly eligible: boolean;
  // px between the title and the viewport: 0 while any of it is on screen.
  readonly distance: number;
};

export type PoolPlan = { readonly acquire: readonly string[]; readonly release: readonly string[] };

export function planPool(entries: readonly PoolEntry[], viewportH: number, pool: { cap: number; nearViewports: number; farViewports: number } = FILL_POOL): PoolPlan {
  const near = pool.nearViewports * viewportH;
  const far = pool.farViewports * viewportH;
  const wanting = entries
    .filter((e) => e.eligible && (e.distance <= near || (e.alive && e.distance <= far)))
    // The nearest first; on a tie, one already alive keeps its context.
    .sort((a, b) => a.distance - b.distance || Number(b.alive) - Number(a.alive));
  const keep = new Set(wanting.slice(0, pool.cap).map((e) => e.id));
  return {
    acquire: entries.filter((e) => !e.alive && keep.has(e.id)).map((e) => e.id),
    release: entries.filter((e) => e.alive && !keep.has(e.id)).map((e) => e.id),
  };
}

// px from a rect to the viewport's band [0, viewportH): 0 when they overlap.
export function distanceToViewport(rect: { top: number; bottom: number }, viewportH: number): number {
  if (rect.bottom <= 0) return -rect.bottom;
  if (rect.top >= viewportH) return rect.top - viewportH;
  return 0;
}
