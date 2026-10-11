import { describe, expect, it } from "vitest";
import { columnWeights, type WeightLayout } from "@/lib/waveform/weights";

// 40 columns, 10px apart, starting at x = 5: column i sits at x = 5 + 10i.
const layout = (overrides: Partial<WeightLayout> = {}): WeightLayout => ({
  columns: 40,
  startX: 5,
  spacing: 10,
  baseline: 150,
  reach: 100,
  feather: 30,
  edgeTaper: 0,
  rects: [],
  ...overrides,
});

describe("column weights", () => {
  it("leaves every column at full strength with nothing to avoid", () => {
    expect(Array.from(columnWeights(layout()))).toEqual(new Array(40).fill(1));
  });

  it("silences the columns under a box that reaches the midline", () => {
    const w = columnWeights(layout({ rects: [{ left: 100, right: 200, top: 40, bottom: 150 }] }));
    for (let i = 10; i <= 19; i++) expect(w[i]).toBe(0); // x 105..195
    expect(w[0]).toBe(1);
    expect(w[39]).toBe(1);
  });

  it("feathers the edges of the box so the wave eases in and out", () => {
    const w = columnWeights(layout({ rects: [{ left: 100, right: 200, top: 40, bottom: 150 }] }));
    // Right edge: x 205, 215, 225 lie inside the 30px feather.
    expect(w[20]).toBeGreaterThan(0);
    expect(w[20]).toBeLessThan(w[21]);
    expect(w[21]).toBeLessThan(w[22]);
    expect(w[22]).toBeLessThan(1);
    expect(w[23]).toBe(1); // x 235, past the feather
    // Left edge mirrors it.
    expect(w[9]).toBeGreaterThan(0);
    expect(w[9]).toBeGreaterThan(w[10]);
    expect(w[9]).toBeLessThan(1);
  });

  it("ignores a box that sits clear of the wave's reach", () => {
    const w = columnWeights(layout({ rects: [{ left: 100, right: 200, top: 0, bottom: 40 }] }));
    // Clearance 110px against a 100px reach.
    expect(Array.from(w)).toEqual(new Array(40).fill(1));
  });

  it("scales the columns under a box by the clearance it leaves", () => {
    const w = columnWeights(layout({ rects: [{ left: 100, right: 200, top: 0, bottom: 110 }] }));
    expect(w[15]).toBeCloseTo(0.4, 6); // 40px clear of a 100px reach
  });

  it("measures a box under the midline from its top edge", () => {
    const w = columnWeights(layout({ rects: [{ left: 100, right: 200, top: 225, bottom: 260 }] }));
    expect(w[15]).toBeCloseTo(0.75, 6);
  });

  it("takes the strongest attenuation where boxes overlap", () => {
    const w = columnWeights(
      layout({
        rects: [
          { left: 100, right: 200, top: 0, bottom: 110 },
          { left: 150, right: 250, top: 0, bottom: 130 },
        ],
      }),
    );
    expect(w[16]).toBeCloseTo(0.2, 6); // x 165 sits under both; the lower box wins
    expect(w[11]).toBeCloseTo(0.4, 6); // x 115 sits under the first only
  });

  it("tapers the wave toward the page edges", () => {
    const w = columnWeights(layout({ edgeTaper: 60 }));
    expect(w[0]).toBeLessThan(w[3]);
    expect(w[39]).toBeLessThan(w[36]);
    expect(w[20]).toBe(1);
    expect(w[0]).toBeGreaterThan(0);
  });
});
