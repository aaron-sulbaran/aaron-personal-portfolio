import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { AMPLITUDE, SAMPLE_STEP, SPACING } from "./constants";
import { layColumns, mapTiles, runColumns } from "./columns";
import { sampleSpine } from "./geometry";
import { SIGNATURE_ON, resolveSpine, type Anchors } from "./spine";

const samples = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, { ...(pages["1440x900"].anchors as Anchors), line: 135 }, { bandRun: true, viewport: 900 }), SAMPLE_STEP);

describe("columns", () => {
  it("the band's run and the path share one grid: column j sits at the same arc and x", () => {
    const path = layColumns(samples, SPACING, AMPLITUDE, []);
    const band = runColumns(1440, 135, SPACING);
    for (let j = 0; j < band.count; j++) {
      expect(band.s[j]).toBe(path.s[j]);
      expect(Math.abs(band.x[j] - path.x[j])).toBeLessThanOrEqual(2);
      expect(Math.abs(path.y[j] - 135)).toBeLessThan(0.5);
    }
  });
  it("tapers a tight bend and leaves a straight alone", () => {
    const hairpin = sampleSpine([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 40 }, { x: 0, y: 40 }], SAMPLE_STEP);
    const cols = layColumns(hairpin, SPACING, AMPLITUDE, []);
    expect(Math.min(...cols.taper)).toBeLessThan(1);
    expect(cols.taper[0]).toBe(1);
  });
  it("flags the columns on a text block's ink", () => {
    const cols = layColumns(samples, SPACING, AMPLITUDE, [{ left: 0, right: 400, top: 130, bottom: 140 }]);
    expect(cols.inWords[5]).toBe(1);
    expect(cols.inWords[60]).toBe(0);
  });
  it("lists each column in every tile its reach touches", () => {
    const cols = layColumns(samples, SPACING, AMPLITUDE, []);
    const map = mapTiles(cols, 768, 6, 100);
    for (let j = 0; j < cols.count; j += 17) {
      for (let t = Math.max(0, Math.floor((cols.y[j] - 100) / 768)); t <= Math.min(5, Math.floor((cols.y[j] + 100) / 768)); t++) {
        expect(Array.from(map.list.subarray(map.first[t], map.first[t] + map.count[t]))).toContain(j);
      }
    }
  });
});
