import { describe, expect, it } from "vitest";
import { computeBands } from "@/lib/waveform/bands";
import { LEVEL, createLeveller, levelColumns } from "@/lib/waveform/level";

const one = { columns: 1, binCount: 1, sampleRate: 0, start: Int32Array.of(0), end: Int32Array.of(1) };
const site = (byte: number) => {
  const out = new Float32Array(1);
  computeBands(Uint8Array.of(byte), one, out, 1);
  return out[0];
};

describe("the leveller", () => {
  it("restores the hits the site's shaping saturates", () => {
    const state = createLeveller(2);
    const out = new Float32Array(2);
    const levelled: number[] = [];
    const shaped: number[] = [];
    for (let f = 0; f < 60 * 20; f++) {
      const byte = (f / 60) % 0.6 < 0.1 ? 255 : 244;
      levelColumns(state, Float32Array.of(byte, 200), 1 / 60, out);
      if (f > 60 * 15) {
        levelled.push(out[0]);
        shaped.push(site(byte));
      }
    }
    expect(Math.max(...shaped) - Math.min(...shaped)).toBeLessThan(0.05);
    expect(Math.max(...levelled) - Math.min(...levelled)).toBeGreaterThan(0.3);
    expect(Math.max(...levelled)).toBeLessThanOrEqual(LEVEL.peak + 1e-6);
  });
  it("lifts a quiet passage after a loud one by at most 30 bytes, never down", () => {
    const state = createLeveller(1);
    const out = new Float32Array(1);
    for (let f = 0; f < 60 * 30; f++) {
      const t = f / 60;
      levelColumns(state, Float32Array.of(t >= 10 && t < 20 ? 150 : 60), 1 / 60, out);
      expect(state.lift).toBeGreaterThanOrEqual(0);
      expect(state.lift).toBeLessThanOrEqual(LEVEL.agcMaxLift);
      if (f === 60 * 9) expect(state.lift).toBeLessThan(1);
    }
    expect(state.lift).toBe(LEVEL.agcMaxLift);
  });
  it("leaves silence silent and a column that never moves silent", () => {
    const state = createLeveller(2);
    const out = new Float32Array(2).fill(1);
    expect(levelColumns(state, new Float32Array(2), 1 / 60, out)).toBe(0);
    expect(Array.from(out)).toEqual([0, 0]);
    for (let f = 0; f < 600; f++) levelColumns(state, Float32Array.of(100, f % 2 ? 50 : 200), 1 / 60, out);
    expect(out[0]).toBe(0);
  });
  it("leaves a silent column's range where it was, so it does not read full peak when it sounds again", () => {
    const state = createLeveller(2);
    const out = new Float32Array(2);
    const wave = (f: number) => (Math.floor(f / 30) % 2 ? 200 : 80);
    for (let f = 0; f < 60 * 10; f++) levelColumns(state, Float32Array.of(wave(f), wave(f)), 1 / 60, out);
    const range = { lo: state.lo[1], hi: state.hi[1] };
    for (let f = 0; f < 60 * 30; f++) {
      levelColumns(state, Float32Array.of(wave(f), 0), 1 / 60, out);
      expect(out[1]).toBe(0);
    }
    expect({ lo: state.lo[1], hi: state.hi[1] }).toEqual(range);
    // Back at its quiet half of the wave it reads low, not the full peak a collapsed range gives.
    levelColumns(state, Float32Array.of(80, 80), 1 / 60, out);
    expect(out[1]).toBeLessThan(LEVEL.peak * 0.5);
  });
});
