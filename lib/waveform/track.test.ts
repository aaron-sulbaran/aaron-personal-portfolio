import { describe, expect, it } from "vitest";
import { bandLayout } from "./layout";
import { junction, swell } from "./sweep";
import { layTrack } from "./track";

const layout = bandLayout(1440, 270);
const n = layout.columns;

function lay(sweep: number, side: "band" | "horizon", base: Float32Array) {
  const xs = new Float32Array(n);
  const offsets = new Float32Array(n);
  const weights = new Float32Array(n);
  layTrack(layout, sweep, side, 60, base, xs, offsets, weights, { dy: 0, scale: 1 });
  return { xs, offsets, weights };
}

describe("layTrack", () => {
  it("a column at strength 0 paints at weight 0 mid-sweep, swell or not", () => {
    const { weights } = lay(0.5, "band", new Float32Array(n).fill(0));
    for (const w of weights) expect(w).toBe(0);
  });

  it("a column at strength 1 takes the junction scale times the full swell", () => {
    for (const side of ["band", "horizon"] as const) {
      const { weights } = lay(0.5, side, new Float32Array(n).fill(1));
      for (let i = 0; i < n; i++) {
        const { scale } = junction(i, n, 0.5, side, 60);
        expect(weights[i]).toBeCloseTo(scale * swell(0.5), 6);
      }
    }
  });

  it("is an identity at rest: the band at 0 and the horizon at 1", () => {
    const base = new Float32Array(n).map((_, i) => (i % 7) / 6);
    for (const [sweep, side] of [[0, "band"], [1, "horizon"]] as const) {
      const { xs, offsets, weights } = lay(sweep, side, base);
      for (let i = 0; i < n; i++) {
        expect(xs[i]).toBeCloseTo(layout.startX + i * layout.spacing, 9);
        expect(offsets[i]).toBe(0);
        expect(weights[i]).toBeCloseTo(base[i], 6);
      }
    }
  });

  it("clamps the sampled strength to the grid at both edges", () => {
    const base = new Float32Array(n).fill(0.5);
    base[0] = 0.1;
    base[n - 1] = 0.9;
    // Mid-sweep the band's head has left past the left edge and the
    // horizon's tail sits past the right edge; neither reads out of range.
    const band = lay(0.5, "band", base);
    expect(band.xs[0]).toBeLessThan(0);
    expect(band.weights[0]).toBeCloseTo(0.1 * (1 + (swell(0.5) - 1) * 0.1), 6);
    const horizon = lay(0.5, "horizon", base);
    expect(horizon.xs[n - 1]).toBeGreaterThan(1440);
    expect(horizon.weights[n - 1]).toBeCloseTo(0.9 * (1 + (swell(0.5) - 1) * 0.9), 6);
  });
});
