import { describe, expect, it } from "vitest";
import { LANE_BEND, lanePath, lanePoints, laneSamples, lengthAtY, maxLean } from "./road";

const anchors = [120, 600, 980, 1500];

describe("the lane", () => {
  const points = lanePoints(anchors, 24);

  it("starts at the top, passes every anchor on the line, and bends once between two", () => {
    expect(points[0]).toEqual({ x: 24, y: 0 });
    expect(points.length).toBe(1 + anchors.length + (anchors.length - 1));
    for (const y of anchors) expect(points).toContainEqual({ x: 24, y });
    const bends = points.filter((p) => p.x !== 24);
    expect(bends.map((p) => p.x)).toEqual([24 + LANE_BEND, 24 - LANE_BEND, 24 + LANE_BEND]);
    expect(bends.map((p) => p.y)).toEqual([360, 790, 1240]);
  });

  it("only heads down the page, and only gently", () => {
    for (let i = 1; i < points.length; i += 1) expect(points[i].y).toBeGreaterThanOrEqual(points[i - 1].y);
    expect(maxLean(points)).toBeLessThan(6);
  });

  it("never runs back up past an anchor out of order", () => {
    const pts = lanePoints([300, 200], 10);
    for (let i = 1; i < pts.length; i += 1) expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y);
  });

  it("draws one cubic per stretch", () => {
    const d = lanePath(points);
    expect(d.startsWith("M24 0")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(points.length - 1);
    expect(lanePath([])).toBe("");
  });

  it("maps a height to a share of its length that only rises", () => {
    const samples = laneSamples(points);
    expect(lengthAtY(samples, -5)).toBe(0);
    expect(lengthAtY(samples, 1500)).toBe(1);
    let last = 0;
    for (let y = 0; y <= 1500; y += 50) {
      const share = lengthAtY(samples, y);
      expect(share).toBeGreaterThanOrEqual(last);
      last = share;
    }
  });
});
