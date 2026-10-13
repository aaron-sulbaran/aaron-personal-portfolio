import { describe, expect, it } from "vitest";
import { lengthAtY, roadPath, roadPoints, roadSamples, ROAD_SWING } from "./road";

const points = roadPoints([200, 500, 900], 100);

describe("roadPoints", () => {
  it("starts centred, swings side to side through each checkpoint, and ends centred on the last", () => {
    expect(points).toEqual([
      { x: 50, y: 0 },
      { x: 100 * ROAD_SWING.left, y: 200 },
      { x: 100 * ROAD_SWING.right, y: 500 },
      { x: 50, y: 900 },
    ]);
  });

  it("never heads back up the page", () => {
    const out = roadPoints([300, 200], 100);
    expect(out[2].y).toBeGreaterThanOrEqual(out[1].y);
  });
});

describe("roadPath", () => {
  it("is one move and a cubic per stretch", () => {
    const d = roadPath(points);
    expect(d.startsWith("M50 0 C")).toBe(true);
    expect(d.match(/C/g)?.length).toBe(3);
    expect(d.endsWith("50 900")).toBe(true);
    expect(roadPath([])).toBe("");
  });
});

describe("lengthAtY", () => {
  const samples = roadSamples(points);
  it("samples a road that only heads down", () => {
    for (let i = 1; i < samples.ys.length; i += 1) expect(samples.ys[i]).toBeGreaterThanOrEqual(samples.ys[i - 1]);
    expect(samples.total).toBeGreaterThan(900);
  });

  it("runs from 0 at the top to 1 at the end, and rises in between", () => {
    expect(lengthAtY(samples, -10)).toBe(0);
    expect(lengthAtY(samples, 0)).toBe(0);
    expect(lengthAtY(samples, 900)).toBe(1);
    expect(lengthAtY(samples, 2000)).toBe(1);
    let last = 0;
    for (let y = 50; y < 900; y += 50) {
      const share = lengthAtY(samples, y);
      expect(share).toBeGreaterThan(last);
      last = share;
    }
  });

  it("is 0 on an empty road", () => {
    expect(lengthAtY(roadSamples([]), 10)).toBe(0);
  });
});
