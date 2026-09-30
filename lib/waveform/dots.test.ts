import { describe, expect, it } from "vitest";
import { FLOOR, createField } from "@/lib/waveform/field";
import { CENTER_RADIUS, buildDots, carveTargets, reachOf, type DotLayout } from "@/lib/waveform/dots";

const layout: DotLayout = { columns: 30, startX: 10, spacing: 13, baseline: 120, maxAmp: 70 };
const NO_CURSOR = { x: 0, y: 0, on: false };

const ys = (dots: number[]) => dots.filter((_, k) => k % 3 === 1);
const xs = (dots: number[]) => dots.filter((_, k) => k % 3 === 0);

describe("buildDots", () => {
  it("draws a resting field as one muted dot per column on the midline", () => {
    const field = createField(30, "still");
    field.mag.fill(FLOOR);
    const muted: number[] = [];
    const accent: number[] = [];
    buildDots(field, layout, 4, new Float32Array(30).fill(1), NO_CURSOR, muted, accent);
    expect(muted.length).toBe(30 * 3);
    expect(accent.length).toBe(0);
    for (const y of ys(muted)) expect(y).toBe(120);
  });

  it("keeps every dot within the column's weighted reach, cursor included", () => {
    const field = createField(30);
    field.mag.fill(1);
    field.disp.forEach((_, i) => (field.disp[i] = i % 2 ? 0.62 : -0.62));
    const weights = new Float32Array(30).map((_, i) => (i % 5) / 4);
    for (let i = 0; i < 30; i++) {
      field.mag[i] = FLOOR + (1 - FLOOR) * weights[i];
      field.disp[i] *= weights[i];
    }
    const muted: number[] = [];
    const accent: number[] = [];
    const cursor = { x: 10 + 13 * 7, y: 150, on: true };
    buildDots(field, layout, 4, weights, cursor, muted, accent);
    const all = [...muted, ...accent];
    const reach = reachOf(layout.maxAmp);
    // The repel can slide a dot up to two columns sideways, so bound it by the
    // strongest weight within two columns of where it landed.
    for (let k = 0; k < all.length; k += 3) {
      const column = Math.round((all[k] - layout.startX) / layout.spacing);
      let w = 0;
      for (let c = column - 2; c <= column + 2; c++) if (c >= 0 && c < 30) w = Math.max(w, weights[c]);
      expect(Math.abs(all[k + 1] - layout.baseline)).toBeLessThanOrEqual(w * reach + CENTER_RADIUS + 1e-6);
    }
    // Zero-weight columns hold perfectly still on the midline, cursor or not.
    for (let k = 0; k < all.length; k += 3) {
      const column = (all[k] - layout.startX) / layout.spacing;
      if (Number.isInteger(column) && weights[column] === 0) expect(all[k + 1]).toBe(120);
    }
  });

  it("paints the peaks in the accent only when a column is loud", () => {
    const field = createField(30);
    field.mag.fill(0.2);
    field.mag[4] = 0.6;
    const muted: number[] = [];
    const accent: number[] = [];
    buildDots(field, layout, 4, new Float32Array(30).fill(1), NO_CURSOR, muted, accent);
    expect(accent.length).toBeGreaterThan(0);
    for (const x of xs(accent)) expect(x).toBe(10 + 13 * 4);
  });
});

describe("carveTargets", () => {
  it("hollows the columns under a cursor near the band and nothing else", () => {
    const out = new Float32Array(30);
    carveTargets(layout, { x: 10 + 13 * 10, y: 120, on: true }, out);
    expect(out[10]).toBeCloseTo(1, 6);
    expect(out[11]).toBeGreaterThan(0);
    expect(out[11]).toBeLessThan(1);
    expect(out[25]).toBe(0);
    carveTargets(layout, { x: 10 + 13 * 10, y: 900, on: true }, out);
    expect(Array.from(out)).toEqual(new Array(30).fill(0));
  });
});
