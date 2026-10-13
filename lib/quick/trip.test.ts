import { describe, expect, it } from "vitest";
import { barPosition, stopAt } from "./trip";

describe("the trip bar", () => {
  const stops = [0.05, 0.2, 0.6, 0.95];

  it("parks at the first stop until the reader reaches it, and at the last after", () => {
    expect(barPosition(0, stops)).toBe(0);
    expect(barPosition(0.05, stops)).toBe(0);
    expect(barPosition(0.99, stops)).toBe(1);
    expect(barPosition(Number.NaN, stops)).toBe(0);
  });

  it("reaches each stop on the bar as the reader reaches its year", () => {
    stops.forEach((at, i) => expect(barPosition(at, stops)).toBeCloseTo(stopAt(i, stops.length)));
  });

  it("covers an even step between two stops, however tall the year", () => {
    expect(barPosition(0.4, stops)).toBeCloseTo((1 + 0.5) / 3);
    expect(barPosition(0.125, stops)).toBeCloseTo(0.5 / 3);
  });

  it("only rises as the reader goes down", () => {
    let last = 0;
    for (let d = 0; d <= 1; d += 0.01) {
      const p = barPosition(d, stops);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it("handles one stop or none", () => {
    expect(barPosition(0.3, [])).toBe(0.3);
    expect(barPosition(0.3, [0.5])).toBe(0);
    expect(barPosition(0.6, [0.5])).toBe(1);
    expect(stopAt(0, 1)).toBe(0);
  });
});
