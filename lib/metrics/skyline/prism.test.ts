import { describe, expect, it } from "vitest";
import { camera } from "./maths";
import { frontEdgeX, OUTLINE_LEN, prismSilhouette, roundedCell, SILHOUETTE_LEN } from "./prism";

const pts = (a: Float32Array, n: number) => Array.from({ length: n }, (_, i) => [a[i * 2], a[i * 2 + 1]] as const);
const same = (p: readonly number[], q: readonly number[]) => Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4;
const dedupe = (list: (readonly [number, number])[]) =>
  list.filter((p, i) => !same(p, list[(i + list.length - 1) % list.length]));

describe("the rounded prism", () => {
  const cam = camera(1);
  const base = new Float32Array(OUTLINE_LEN * 2);
  const sil = new Float32Array(SILHOUETTE_LEN * 2);
  roundedCell(base, cam, 2, 3, 0.9, 0.2, 0, 10, 50, 40);

  it("at height zero, its silhouette is the rounded cell itself", () => {
    const n = prismSilhouette(sil, base, OUTLINE_LEN, 0);
    const outline = pts(base, OUTLINE_LEN);
    const outer = dedupe(pts(sil, n));
    expect(outer).toHaveLength(OUTLINE_LEN);
    const start = outline.findIndex((p) => same(p, outer[0]));
    outer.forEach((p, i) => expect(same(p, outline[(start + i) % OUTLINE_LEN])).toBe(true));
  });

  it("raised, it spans the base's bottom to the top face's top, split at the front edge", () => {
    const n = prismSilhouette(sil, base, OUTLINE_LEN, 25);
    const ys = pts(sil, n).map((p) => p[1]);
    const baseYs = pts(base, OUTLINE_LEN).map((p) => p[1]);
    expect(Math.max(...ys)).toBeCloseTo(Math.max(...baseYs), 4);
    expect(Math.min(...ys)).toBeCloseTo(Math.min(...baseYs) - 25, 4);
    const xs = pts(base, OUTLINE_LEN).map((p) => p[0]);
    const front = frontEdgeX(base, OUTLINE_LEN);
    expect(front).toBeGreaterThan(Math.min(...xs));
    expect(front).toBeLessThan(Math.max(...xs));
  });

  it("with no radius, the corners are the square cell's", () => {
    const sq = new Float32Array(OUTLINE_LEN * 2);
    roundedCell(sq, camera(0), 0, 0, 1, 0, 0, 10, 0, 0);
    expect(dedupe(pts(sq, OUTLINE_LEN)).map(([x, y]) => [Math.round(x), Math.round(y)])).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
});
