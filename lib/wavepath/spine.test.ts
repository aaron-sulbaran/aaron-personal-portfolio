import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { arcAtY, sampleSpine } from "./geometry";
import { bandLineY, runLength } from "./head";
import { RUN_START, SAMPLE_STEP } from "./constants";
import { SIGNATURE_ON, resolveSpine, type Anchors } from "./spine";

// The fixture is measured from the real page (measureAnchors at 1440x900,
// 1024x768 and 390x844).
const a1440 = pages["1440x900"].anchors as Anchors;

describe("the line", () => {
  it("is the always-on Signature line", () => {
    expect(SIGNATURE_ON).toEqual([
      { at: "band", y: 0.35, x: 1.06, box: true }, { at: "band", y: 0.75, x: 1.06, box: true },
      { at: "gap0", y: 0.3, x: 0.25 },
      { at: "who", y: 0.05, x: 0.015 }, { at: "who", y: 0.85, x: 0.015 },
      { at: "numbers", y: 0.1, x: 0.3 }, { at: "numbers", y: 1, x: 0.8 },
      { at: "connect", y: 0.2, x: 0.955 }, { at: "connect", y: 0.8, x: 0.955 },
      { at: "footer", y: 0.4, x: 1.12, box: true }, { at: "footer", y: 0.8, x: 1.12, box: true },
    ]);
  });
  it("starts as a level run on the band's measured line, from 24px past the left edge", () => {
    const points = resolveSpine({ points: SIGNATURE_ON }, { ...a1440, line: 135 }, { bandRun: true, viewport: 900 });
    expect(points[0]).toEqual({ x: RUN_START, y: 135 });
    const samples = sampleSpine(points, SAMPLE_STEP);
    const run = runLength(samples, 1440);
    expect(Math.abs(run - (1440 - 1 - RUN_START))).toBeLessThanOrEqual(SAMPLE_STEP);
    for (let i = 0; i * SAMPLE_STEP < run; i++) expect(Math.abs(samples.y[i] - 135)).toBeLessThan(0.5);
  });
  it("reads the measured band line, else the lab's formula", () => {
    expect(bandLineY({ ...a1440, line: 200 }, 900)).toBe(200);
    expect(bandLineY(a1440, 900)).toBe(a1440.words.band.top - 20 + 270 / 2);
  });
  it("arc length never goes back as the page goes down", () => {
    const samples = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, a1440, { bandRun: true, viewport: 900 }), SAMPLE_STEP);
    let last = 0;
    for (let y = 0; y < a1440.box.footer.bottom; y += 37) {
      const s = arcAtY(samples, y);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});
