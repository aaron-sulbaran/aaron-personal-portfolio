import { describe, expect, it } from "vitest";
import { bandEdgesFor, columnMeans, computeBandEdges, computeBands } from "@/lib/waveform/bands";

const BINS = 1024; // fftSize 2048
const RATE = 48000; // nyquist 24kHz, so one bin is 23.4375Hz
const binOf = (hz: number) => (hz / (RATE / 2)) * BINS;

describe("band edges", () => {
  it("climb monotonically from 40Hz to 8kHz", () => {
    for (const columns of [26, 110, 147]) {
      const edges = computeBandEdges(columns, BINS, RATE);
      expect(edges.start.length).toBe(columns);
      expect(edges.start[0]).toBe(Math.floor(binOf(40)));
      expect(edges.end[columns - 1]).toBeLessThanOrEqual(Math.ceil(binOf(8000)));
      for (let i = 0; i < columns; i++) {
        expect(edges.end[i]).toBeGreaterThan(edges.start[i]);
        expect(edges.end[i]).toBeLessThanOrEqual(BINS);
        if (i > 0) {
          expect(edges.start[i]).toBeGreaterThanOrEqual(edges.start[i - 1]);
          expect(edges.end[i]).toBeGreaterThanOrEqual(edges.end[i - 1]);
        }
      }
    }
  });

  it("are cached for an unchanged layout and rebuilt for a new one", () => {
    const a = bandEdgesFor(110, BINS, RATE);
    expect(bandEdgesFor(110, BINS, RATE)).toBe(a);
    expect(bandEdgesFor(26, BINS, RATE)).not.toBe(a);
  });
});

describe("computeBands", () => {
  it("reads silence as zero energy", () => {
    const edges = computeBandEdges(40, BINS, RATE);
    const out = new Float32Array(40);
    const level = computeBands(new Uint8Array(BINS), edges, out, 1);
    expect(level).toBe(0);
    expect(Array.from(out)).toEqual(new Array(40).fill(0));
  });

  it("clamps a full spectrum to one, scaled by the intro ramp", () => {
    const edges = computeBandEdges(40, BINS, RATE);
    const out = new Float32Array(40);
    const level = computeBands(new Uint8Array(BINS).fill(255), edges, out, 0.5);
    expect(level).toBeCloseTo(0.5, 6);
    for (const v of out) expect(v).toBeCloseTo(0.5, 6);
  });

  it("lights only the columns whose range holds the loud bin", () => {
    const edges = computeBandEdges(40, BINS, RATE);
    const freq = new Uint8Array(BINS);
    const loud = Math.floor(binOf(1000));
    freq[loud] = 255;
    const out = new Float32Array(40);
    computeBands(freq, edges, out, 1);
    for (let i = 0; i < 40; i++) {
      const holds = edges.start[i] <= loud && loud < edges.end[i];
      if (holds) expect(out[i]).toBeGreaterThan(0);
      else expect(out[i]).toBe(0);
    }
  });

  it("columnMeans averages each column's bytes", () => {
    const edges = { columns: 2, binCount: 4, sampleRate: 0, start: Int32Array.of(0, 2), end: Int32Array.of(2, 4) };
    const out = new Float32Array(2);
    columnMeans(Uint8Array.of(10, 30, 255, 255), edges, out);
    expect(Array.from(out)).toEqual([20, 255]);
  });
});
