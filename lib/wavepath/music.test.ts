import { describe, expect, it } from "vitest";
import { MUSIC, SPECTRUM_BINS } from "./constants";
import { bandAt, createMusic, stepMusic } from "./music";

describe("the music", () => {
  it("Not now is the still shape: no share and no bins, whatever the analyser holds", () => {
    const m = createMusic();
    const loud = new Float32Array(SPECTRUM_BINS).fill(0.6);
    for (let k = 0; k < 120; k++) stepMusic(m, 1 / 60, false, loud);
    expect(m.share).toBe(0);
    expect(Math.max(...m.bins)).toBe(0);
    expect(stepMusic(m, 1 / 60, false, loud)).toBe(false);
  });
  it("Play it hands every column to the music, and a bin rises at the band's speed", () => {
    const m = createMusic();
    for (let k = 0; k < 600; k++) stepMusic(m, 1 / 60, true, new Float32Array(SPECTRUM_BINS));
    expect(m.share).toBeGreaterThan(0.99);
    stepMusic(m, MUSIC.attackS, true, new Float32Array(SPECTRUM_BINS).fill(0.5));
    expect(m.bins[0]).toBeCloseTo(0.5 * MUSIC.intensity * m.share * (1 - Math.exp(-1)), 2);
  });
  it("reads between bins", () => {
    const bins = new Float32Array(SPECTRUM_BINS);
    bins[1] = 1;
    expect(bandAt(bins, 0.5 / (SPECTRUM_BINS - 1))).toBeCloseTo(0.5);
  });
});
