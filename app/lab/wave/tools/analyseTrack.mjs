// One-off, never imported by site code: turns public/audio/track-01.mp3 into
// the envelope the wave lab replays in silence (app/lab/wave/envelope/).
//
//   node app/lab/wave/tools/analyseTrack.mjs        (from the repo root)
//
// Muted headless Chromium only DECODES the file (OfflineAudioContext's
// decodeAudioData: no rendering, no destination, nothing audible). The
// analysis is the site's, step for step, written out here because the lab
// must not play the file through a real AnalyserNode:
//   - lib/audio.ts: FFT_SIZE 2048, smoothingTimeConstant 0.78, the
//     element's volume 0.7 (Chromium applies it before the graph), the
//     analyser read once per animation frame (60 per second), so the
//     smoothing is stepped at 60fps exactly as on the site;
//   - the AnalyserNode algorithm from the Web Audio spec: mono downmix, a
//     Blackman window, |X[k]| / N, the smoothing, 20 log10, bytes over the
//     default -100 to -30 dB;
//   - lib/waveform/bands.ts: computeBandEdges for 64 columns (the lab's
//     spectrum width) at the context rate; each stored value is a column's
//     mean byte, so replaying it through computeBands with one bin per column
//     reproduces the site's band energy.
// Frames are kept at 30 per second over the first 90 seconds.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { computeBandEdges } from "../../../../lib/waveform/bands.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../..");
const SOURCE = resolve(root, "public/audio/track-01.mp3");
const OUT = resolve(here, "../envelope/track-01.json");

const SAMPLE_RATE = 48000; // a Mac's AudioContext rate, so the bin mapping matches the site there
const FFT_SIZE = 2048;
const SMOOTHING = 0.78;
const VOLUME = 0.7;
const MIN_DB = -100;
const MAX_DB = -30;
const ANALYSE_FPS = 60;
const KEEP_EVERY = 2; // 60 / 2 = 30 frames per second stored
const SECONDS = 90;
const COLUMNS = 64;

const edges = computeBandEdges(COLUMNS, FFT_SIZE / 2, SAMPLE_RATE);
const mp3 = readFileSync(SOURCE).toString("base64");

const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><title>analyse</title>");
  const frames = await page.evaluate(
    async ({ mp3, rate, fftSize, smoothing, volume, minDb, maxDb, fps, keepEvery, seconds, start, end }) => {
      const bytes = Uint8Array.from(atob(mp3), (c) => c.charCodeAt(0));
      // Decode only: an OfflineAudioContext is never started, so nothing renders.
      const ctx = new OfflineAudioContext(2, rate, rate);
      const buffer = await ctx.decodeAudioData(bytes.buffer);
      const total = Math.min(buffer.length, Math.round(seconds * rate));
      const left = buffer.getChannelData(0);
      const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
      const mono = new Float32Array(total);
      for (let i = 0; i < total; i++) mono[i] = 0.5 * (left[i] + right[i]) * volume;

      const N = fftSize;
      const blackman = new Float32Array(N);
      for (let n = 0; n < N; n++) blackman[n] = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / N) + 0.08 * Math.cos((4 * Math.PI * n) / N);
      const levels = Math.log2(N);
      const rev = new Uint32Array(N);
      for (let i = 0; i < N; i++) {
        let r = 0;
        for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
        rev[i] = r;
      }
      const re = new Float64Array(N);
      const im = new Float64Array(N);
      const smoothed = new Float64Array(N / 2);
      const freq = new Uint8Array(N / 2);
      const fft = () => {
        for (let size = 2; size <= N; size *= 2) {
          const half = size / 2;
          const step = (-2 * Math.PI) / size;
          for (let i = 0; i < N; i += size) {
            for (let k = 0; k < half; k++) {
              const wr = Math.cos(step * k);
              const wi = Math.sin(step * k);
              const a = i + k;
              const b = a + half;
              const tr = re[b] * wr - im[b] * wi;
              const ti = re[b] * wi + im[b] * wr;
              re[b] = re[a] - tr;
              im[b] = im[a] - ti;
              re[a] += tr;
              im[a] += ti;
            }
          }
        }
      };
      const out = [];
      const count = Math.floor((total / rate) * fps);
      for (let f = 0; f < count; f++) {
        const endSample = Math.round(((f + 1) / fps) * rate);
        for (let n = 0; n < N; n++) {
          const i = endSample - N + n;
          const v = i >= 0 && i < total ? mono[i] : 0;
          re[rev[n]] = v * blackman[n];
          im[rev[n]] = 0;
        }
        fft();
        for (let k = 0; k < N / 2; k++) {
          const magnitude = Math.hypot(re[k], im[k]) / N;
          smoothed[k] = smoothing * smoothed[k] + (1 - smoothing) * magnitude;
          const db = smoothed[k] > 0 ? 20 * Math.log10(smoothed[k]) : -Infinity;
          freq[k] = Math.max(0, Math.min(255, Math.floor((255 / (maxDb - minDb)) * (db - minDb))));
        }
        if ((f + 1) % keepEvery) continue;
        const row = new Array(start.length);
        for (let c = 0; c < start.length; c++) {
          let acc = 0;
          for (let b = start[c]; b < end[c]; b++) acc += freq[b];
          row[c] = Math.round(acc / (end[c] - start[c]));
        }
        out.push(row);
      }
      return out;
    },
    {
      mp3,
      rate: SAMPLE_RATE,
      fftSize: FFT_SIZE,
      smoothing: SMOOTHING,
      volume: VOLUME,
      minDb: MIN_DB,
      maxDb: MAX_DB,
      fps: ANALYSE_FPS,
      keepEvery: KEEP_EVERY,
      seconds: SECONDS,
      start: Array.from(edges.start),
      end: Array.from(edges.end),
    },
  );

  const flat = Uint8Array.from(frames.flat());
  const envelope = {
    source: "public/audio/track-01.mp3",
    credit: "\"Small Steps\" by Lee Rosevere (https://freemusicarchive.org/music/lee-rosevere/), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). This file is an analysis of it: per-column spectrum levels, no audio.",
    analysis: { fftSize: FFT_SIZE, smoothing: SMOOTHING, volume: VOLUME, minDecibels: MIN_DB, maxDecibels: MAX_DB, sampleRate: SAMPLE_RATE, analyserFps: ANALYSE_FPS, bandMinHz: 40, bandMaxHz: 8000 },
    fps: ANALYSE_FPS / KEEP_EVERY,
    columns: COLUMNS,
    frames: frames.length,
    bins: Buffer.from(flat).toString("base64"),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(envelope);
  writeFileSync(OUT, json + "\n");
  console.log(`${frames.length} frames x ${COLUMNS} columns, ${(json.length / 1024).toFixed(0)} KB -> ${OUT}`);
} finally {
  await browser.close();
}
