import { DOT_GAP } from "@/lib/waveform/dots";
import { MAX_THICK, MUSIC, RUN_START, SHAPE_GAIN } from "./constants";
import type { SpineSamples } from "./geometry";
import type { Rect } from "./spine";

// Columns along the line, laid out on resize, never per frame: column j sits
// at arc s_j = j * spacing + spacing / 2 with its point, unit normal, bend
// taper and whether it sits on a text block's ink. The band's run uses the
// same grid, so the two views meet in phase.
export interface PathColumns { count: number; s: Float32Array; x: Float32Array; y: Float32Array; nx: Float32Array; ny: Float32Array; taper: Float32Array; inWords: Uint8Array }

const alloc = (count: number): PathColumns => ({
  count,
  s: new Float32Array(count), x: new Float32Array(count), y: new Float32Array(count),
  nx: new Float32Array(count), ny: new Float32Array(count), taper: new Float32Array(count), inWords: new Uint8Array(count),
});
export const EMPTY_COLUMNS = alloc(0);

// The farthest a column's dots sit from its point (shape with breath and a
// pluck, plus the rows), and the lab's tile reach with the music on.
export const dotReach = (amp: number) => amp * SHAPE_GAIN * 1.5 + MAX_THICK * DOT_GAP;
export const tileReach = (amp: number) => amp * (0.75 + MUSIC.share) + 24;

export function layColumns(samples: SpineSamples, spacing: number, amp: number, blocks: Rect[]): PathColumns {
  const c = alloc(Math.max(0, Math.floor(samples.length / spacing)));
  for (let j = 0; j < c.count; j++) {
    const s = j * spacing + spacing / 2;
    const i = Math.min(samples.count - 1, Math.round(s / samples.step));
    c.s[j] = s;
    c.x[j] = samples.x[i];
    c.y[j] = samples.y[i];
    c.nx[j] = samples.nx[i];
    c.ny[j] = samples.ny[i];
    // The farthest dot stays inside 80 percent of the bend's radius.
    c.taper[j] = Math.min(1, (0.8 * samples.radius[i]) / Math.max(1, amp * 0.55));
    for (const b of blocks) {
      if (c.x[j] > b.left - 4 && c.x[j] < b.right + 4 && c.y[j] > b.top - 4 && c.y[j] < b.bottom + 4) {
        c.inWords[j] = 1;
        break;
      }
    }
  }
  return c;
}

export function runColumns(width: number, baseline: number, spacing: number): PathColumns {
  const c = alloc(Math.max(0, Math.ceil((width - RUN_START) / spacing)));
  for (let j = 0; j < c.count; j++) {
    c.s[j] = j * spacing + spacing / 2;
    c.x[j] = c.s[j] + RUN_START;
    c.y[j] = baseline;
    c.ny[j] = 1;
    c.taper[j] = 1;
  }
  return c;
}

export interface TileMap { first: Int32Array; count: Int32Array; list: Int32Array }

export function mapTiles(cols: PathColumns, tilePx: number, tiles: number, reach: number): TileMap {
  const first = new Int32Array(tiles);
  const count = new Int32Array(tiles);
  const lo = (j: number) => Math.max(0, Math.floor((cols.y[j] - reach) / tilePx));
  const hi = (j: number) => Math.min(tiles - 1, Math.floor((cols.y[j] + reach) / tilePx));
  for (let j = 0; j < cols.count; j++) for (let t = lo(j); t <= hi(j); t++) count[t]++;
  let total = 0;
  for (let t = 0; t < tiles; t++) {
    first[t] = total;
    total += count[t];
    count[t] = 0;
  }
  const list = new Int32Array(total);
  for (let j = 0; j < cols.count; j++) for (let t = lo(j); t <= hi(j); t++) list[first[t] + count[t]++] = j;
  return { first, count, list };
}
