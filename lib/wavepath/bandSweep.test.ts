import { describe, expect, it } from "vitest";
import { chaseLevel, sweepLevel, tailAtLevel } from "./bandSweep";
import { BAND_SWEEP_S, RELEASE_LINE } from "./constants";

// A 1440 wide run of 1448 px with the train's 480 px soft tail, and the release line at 0.4 of a 900 px viewport (360 px).
const run = 1448;
const fade = 480;
const line = RELEASE_LINE * 900;
const tail = (bottom: number) => tailAtLevel(sweepLevel(bottom, line), run, fade);

describe("the band's run swept by the scroll", () => {
  it("keeps the whole run while the band's bottom edge is at or below the release line", () => {
    for (const bottom of [569, 400, line]) expect(tail(bottom)).toBe(-fade);
  });
  it("keeps none of it once that edge is at the viewport's top or above", () => {
    for (const bottom of [0, -50, -900]) expect(tail(bottom)).toBe(run);
  });
  it("moves the tail from the run's left end to its right in step with the scroll, both ways", () => {
    const tails = [line, 270, 180, 90, 0].map(tail);
    for (let i = 1; i < tails.length; i++) expect(tails[i]).toBeGreaterThan(tails[i - 1]);
    expect(tail(line / 2)).toBeCloseTo((run - fade) / 2, 9);
  });
  it("never sweeps with no release line", () => {
    expect(sweepLevel(-100, 0)).toBe(0);
  });
});

describe("the shortest sweep", () => {
  it("is half a second (Aaron, 2026-11-10, the band lab's pick)", () => {
    expect(BAND_SWEEP_S).toBe(0.5);
  });
  it("takes at least the shortest sweep from gone to whole, however quick the flick", () => {
    let level = 1;
    let frames = 0;
    while (level > 0 && frames < 1000) {
      level = chaseLevel(level, 0, 1 / 60, BAND_SWEEP_S);
      frames++;
    }
    expect(level).toBe(0);
    expect(frames / 60).toBeGreaterThanOrEqual(BAND_SWEEP_S - 1e-9);
    expect(frames / 60).toBeLessThan(BAND_SWEEP_S + 2 / 60);
  });
  it("tracks a steady scroll exactly: a step under the cap lands on the scroll's level", () => {
    // 300 px a second over a 360 px line is under a twentieth of a sweep a frame.
    expect(chaseLevel(0.5, 0.5 - 300 / 60 / line, 1 / 60, BAND_SWEEP_S)).toBe(0.5 - 300 / 60 / line);
  });
  it("moves both ways, never past the scroll's level, and jumps with no cap", () => {
    expect(chaseLevel(0, 1, 1 / 60, BAND_SWEEP_S)).toBeCloseTo(1 / 30, 9);
    expect(chaseLevel(0.99, 1, 1, BAND_SWEEP_S)).toBe(1);
    expect(chaseLevel(1, 0, 1 / 60, 0)).toBe(0);
  });
});
