import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { AMPLITUDE, CLEAR_MARGIN, SAMPLE_STEP, SPACING } from "./constants";
import { layColumns, mapTiles, runColumns } from "./columns";
import { sampleSpine } from "./geometry";
import { layLine } from "./line";
import type { Anchors } from "./spine";

const { samples } = layLine({ ...(pages["1440x900"].anchors as Anchors), line: 135 }, 900);

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
  it("gives each column its room: the distance to the nearest text or link, less the margin, and none where nothing is near", () => {
    const alone = layColumns(samples, SPACING, AMPLITUDE, []);
    expect(Math.min(...alone.room)).toBe(Infinity);
    // The run is level at y 135 from x -24: column j sits at x = 13j - 17.5. Text under 100px of it, a link 55px above column 20.
    const onRun = { left: 0, right: 100, top: 130, bottom: 140 };
    const above = { left: 200, right: 300, top: 60, bottom: 80 };
    const cols = layColumns(samples, SPACING, AMPLITUDE, [onRun], [above]);
    expect(cols.room[5]).toBe(0);
    expect(cols.x[20]).toBeGreaterThan(200);
    expect(cols.x[20]).toBeLessThan(300);
    expect(cols.room[20]).toBeCloseTo(cols.y[20] - 80 - CLEAR_MARGIN, 3);
    expect(cols.room[60], "far from both").toBeGreaterThan(300);
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
