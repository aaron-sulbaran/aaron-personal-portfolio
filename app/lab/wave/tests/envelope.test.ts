import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeBands } from "@/lib/waveform/bands";
import { AUTO_PEAK, decodeEnvelope, levelEnvelope, loadEnvelope, sampleEnvelope, type EnvelopeFile } from "../envelope";

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

// Two columns over four frames at 2 fps (a 2 s loop): column 0 ramps, column 1 never moves.
const tiny: EnvelopeFile = { fps: 2, columns: 2, frames: 4, bins: b64([0, 40, 100, 40, 200, 40, 100, 40]) };

describe("the envelope loader", () => {
  it("decodes frames, columns and the loop", () => {
    const env = decodeEnvelope(tiny);
    expect(env.frames).toBe(4);
    expect(env.columns).toBe(2);
    expect(env.duration).toBe(2);
    expect(Array.from(env.bins)).toEqual([0, 40, 100, 40, 200, 40, 100, 40]);
  });

  it("refuses a file whose bytes do not match its frames and columns", () => {
    expect(() => decodeEnvelope({ ...tiny, frames: 5 })).toThrow();
  });

  it("interpolates between frames and loops", () => {
    const env = decodeEnvelope(tiny);
    const out = new Float32Array(2);
    const site = (t: number) => {
      sampleEnvelope(env, t, "site", out);
      return out[0];
    };
    const bytes = (b: number) => {
      const o = new Float32Array(1);
      computeBands(Uint8Array.of(b), { columns: 1, binCount: 1, sampleRate: 0, start: Int32Array.of(0), end: Int32Array.of(1) }, o, 1);
      return o[0];
    };
    expect(site(0)).toBeCloseTo(bytes(0));
    expect(site(0.25)).toBeCloseTo(bytes(50)); // halfway from frame 0 (0) to frame 1 (100)
    expect(site(1)).toBeCloseTo(bytes(200));
    expect(site(2)).toBeCloseTo(site(0)); // the loop
    expect(site(1.75)).toBeCloseTo(bytes(50)); // frame 3 (100) back toward frame 0 (0)
  });

  it("site shaping is the site's computeBands on the stored means", () => {
    const env = decodeEnvelope(tiny);
    const out = new Float32Array(2);
    const level = sampleEnvelope(env, 0.5, "site", out);
    const expected = new Float32Array(2);
    const expectedLevel = computeBands(Uint8Array.of(100, 40), { columns: 2, binCount: 2, sampleRate: 0, start: Int32Array.of(0, 1), end: Int32Array.of(1, 2) }, expected, 1);
    expect(Array.from(out)).toEqual(Array.from(expected));
    expect(level).toBeCloseTo(expectedLevel);
  });

  it("auto shaping stays in range and leaves a column that never moves silent", () => {
    const env = decodeEnvelope(tiny);
    const out = new Float32Array(2);
    for (let t = 0; t < 2; t += 0.1) {
      sampleEnvelope(env, t, "auto", out);
      expect(out[0]).toBeGreaterThanOrEqual(0);
      expect(out[0]).toBeLessThanOrEqual(AUTO_PEAK + 1e-6);
      expect(out[1]).toBe(0);
    }
  });

  it("the automatic gain lifts quiet passages by at most 30, never a silent column, never down", () => {
    // 40 frames at 10 fps: a quiet first half (60) and a loud second half (150), plus a silent column.
    const frames = 40;
    const bins = new Uint8Array(frames * 2);
    for (let f = 0; f < frames; f++) {
      bins[f * 2] = f < 20 ? 60 : 150;
      bins[f * 2 + 1] = 0;
    }
    const levelled = levelEnvelope(bins, 2, frames, 10);
    for (let f = 0; f < frames; f++) {
      expect(levelled[f * 2 + 1]).toBe(0);
      expect(levelled[f * 2]).toBeGreaterThanOrEqual(bins[f * 2]);
      expect(levelled[f * 2] - bins[f * 2]).toBeLessThanOrEqual(30);
    }
    expect(levelled[0]).toBe(90); // the quiet start, lifted the full 30
    expect(levelled[(frames - 1) * 2]).toBe(150); // the loud end, untouched
  });

  it("loads the real track's envelope: 90 s at 30 fps over 64 columns, under 300 KB", async () => {
    const env = await loadEnvelope();
    expect(env.fps).toBe(30);
    expect(env.columns).toBe(64);
    expect(env.frames).toBe(2700);
    expect(env.duration).toBe(90);
    const file = fileURLToPath(new URL("../envelope/track-01.json", import.meta.url));
    expect(statSync(file).size).toBeLessThan(300 * 1024);
    // The music is in it: the middle columns move, by more than a row's worth of bytes.
    expect(env.hi[24] - env.lo[24]).toBeGreaterThan(40);
  });
});
