// The audio seam for the back-half waveform (spec section 4.2). Everything
// upstream of this file consumes an AudioFrame and never cares where the numbers
// come from, so the visualizer, the regime states, and the pill can all be built
// and shipped against a stub before Spotify is wired (spec section 11).
//
//   Phase 1 to 3: createStubAudioSource (a synthesized signal, exactly the
//                 stand-in the playground uses).
//   Phase 4:      a Spotify Web Playback SDK player plus an Audio Analysis
//                 sampler producing the same AudioFrame from the real playhead,
//                 or the hosted-file AnalyserNode fallback. Same interface;
//                 the renderer does not change.

export interface AudioFrame {
  // 0..1 overall loudness at the current playhead. Carries the intro envelope,
  // so it doubles as the ramp that makes music-on spring up from the thin line.
  level: number;
  // Per-column energy. Drives each column's magnitude (thickness) and the
  // amplitude of its displacement (the waving). Length matches the live column
  // count; reused across frames, so read it within the frame, do not retain it.
  bands: Float32Array;
  playing: boolean;
}

export interface AudioSource {
  // Fill an AudioFrame for `columns` columns at time `nowMs` (a rAF timestamp).
  sample(nowMs: number, columns: number): AudioFrame;
  setPlaying(playing: boolean): void;
  readonly playing: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const BEAT_SECONDS = 0.72;
const INTRO_SECONDS = 1.3;

// A synthesized stand-in for real audio analysis: a soft kick on a ~0.72s beat
// weighted to the low columns, a mid shimmer, and a high sparkle, all ramped by
// a ~1.3s intro envelope after playback starts so the wave reads as springing to
// life from silence. This mirrors the playground's reactive signal one to one.
// It is not music; it only lets the reactive look be tuned now. Production
// replaces it with an analysis-driven source behind the same interface.
export function createStubAudioSource(): AudioSource {
  let playing = false;
  let songStart = 0;
  let bands = new Float32Array(0);

  return {
    get playing() {
      return playing;
    },
    setPlaying(next: boolean) {
      if (next && !playing) songStart = performance.now() / 1000;
      playing = next;
    },
    sample(nowMs: number, columns: number): AudioFrame {
      if (bands.length !== columns) bands = new Float32Array(columns);
      const t = nowMs / 1000;
      const intro = playing ? clamp01((t - songStart) / INTRO_SECONDS) : 0;
      const phase = (t / BEAT_SECONDS) % 1;
      const kick = Math.exp(-phase * 5.2);
      for (let i = 0; i < columns; i++) {
        const f = columns > 0 ? i / columns : 0;
        const lowW = clamp01(1 - f * 2.2);
        const highW = clamp01((f - 0.55) * 2.4);
        const midW = clamp01(1 - Math.abs(f - 0.5) * 1.7);
        bands[i] =
          intro *
          (0.1 +
            0.5 * kick * lowW +
            0.22 * Math.abs(Math.sin(t * 1.6 + i * 0.4)) * midW +
            0.14 * Math.abs(Math.sin(t * 5.0 + i)) * highW);
      }
      return { level: intro, bands, playing };
    },
  };
}
