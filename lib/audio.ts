// The audio seam for the back-half waveform (spec section 4.2). Everything
// upstream of this file consumes an AudioFrame and never cares where the numbers
// come from, so the visualizer, the regime states, and the pill can all be built
// and shipped against a stub before real audio is wired (spec section 11).
//
//   Phase 1 to 3: createStubAudioSource (a synthesized signal, exactly the
//                 stand-in the playground uses).
//   Phase 4:      shipped as the hosted-file AnalyserNode path, not the Spotify
//                 Web Playback SDK originally scoped. Spotify deprecated the
//                 Audio Analysis API for new apps on 2024-11-27, and the
//                 2026-02-06 five-user development-mode cap made the SDK path
//                 non-viable for a public site. The stub above remains in this
//                 file as the no-audio dev stand-in; getSoundtrackPlayer below
//                 is the real player, same AudioFrame interface, so the
//                 renderer does not change.

import { siteContent } from "./content";

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

export interface PlayerSnapshot {
  trackIndex: number;
  playing: boolean;
  duration: number;
}

export interface SoundtrackPlayer extends AudioSource {
  play(): void;
  pause(): void;
  selectTrack(index: number, autoplay: boolean): void;
  seek(seconds: number): void;
  setVolume(v: number): void;
  getPosition(): number;
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: () => void): () => void;
}

const FFT_SIZE = 2048;
const ANALYSER_SMOOTHING = 0.78;
const BAND_MIN_HZ = 40;
const BAND_MAX_HZ = 8000;
// Shape byte-frequency energy (0..1) into the dynamic range the renderer was
// tuned against on the stub: idle ceiling ~0.25, reactive peaks past the 0.36
// accent gate. Tune these two live in Task 7, nothing else.
const BAND_EXPONENT = 1.35;
const BAND_GAIN = 1.9;
const AUDIBLE_FADE_SECONDS = 0.6;

let playerSingleton: SoundtrackPlayer | null = null;

// One player for the whole client: the pill drives transport, the waveform
// samples frames, both against the same audio element. The Web Audio graph is
// built on the FIRST play() so visitors who never opt in fetch no audio and
// create no AudioContext (autoplay policy also requires the gesture).
export function getSoundtrackPlayer(): SoundtrackPlayer {
  if (playerSingleton) return playerSingleton;

  const tracks = siteContent.soundtrack.tracks;
  let el: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let fade: GainNode | null = null;
  let freq = new Uint8Array(0);
  let bands = new Float32Array(0);
  let trackIndex = 0;
  let playing = false;
  // Monotonic play token: a stale el.play() rejection (from a pause() or src
  // swap that aborted an earlier request) must not clobber a newer request that
  // has since taken over. Only the latest play()'s catch may clear `playing`.
  let playGen = 0;
  let playStartSec = 0;
  let volume = 0.7;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  const rampFadeIn = () => {
    if (!fade || !audioCtx) return;
    fade.gain.cancelScheduledValues(audioCtx.currentTime);
    fade.gain.setValueAtTime(0, audioCtx.currentTime);
    fade.gain.linearRampToValueAtTime(1, audioCtx.currentTime + AUDIBLE_FADE_SECONDS);
  };

  const ensureGraph = () => {
    if (el) return;
    el = new Audio(tracks[trackIndex].src);
    el.preload = "auto";
    el.volume = volume;
    el.addEventListener("ended", () => selectTrack(trackIndex + 1, true));
    el.addEventListener("durationchange", emit);
    // Make the media element authoritative for `playing`. Native pause/play can
    // originate outside our code (OS media keys, lockscreen, headphone unplug,
    // a midstream decode error), so mirror the element's real state instead of
    // trusting only our optimistic flip. The soundtrack reconciler reads these
    // emits to keep the pill glyph and waveform honest in both directions.
    el.addEventListener("play", () => { playing = true; emit(); });
    el.addEventListener("playing", () => { playing = true; emit(); });
    el.addEventListener("pause", () => { playing = false; emit(); });
    el.addEventListener("error", () => { playing = false; emit(); });
    audioCtx = new AudioContext();
    audioCtx.addEventListener("statechange", emit);
    const src = audioCtx.createMediaElementSource(el);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    freq = new Uint8Array(analyser.frequencyBinCount);
    fade = audioCtx.createGain();
    src.connect(analyser);
    analyser.connect(fade);
    fade.connect(audioCtx.destination);
  };

  const play = async () => {
    ensureGraph();
    if (!el || !audioCtx) return;
    const gen = ++playGen;
    // Optimistic: flip `playing` before the async work settles, so any emit
    // that fires in the pending window (durationchange on first load,
    // selectTrack on the ended -> next-track path) never reads a false
    // "stopped" and never trips the state reconciler in lib/soundtrack.
    playing = true;
    playStartSec = performance.now() / 1000;
    emit();
    // A suspended context (browser policy, iOS interruption) would leave the
    // element playing into a silent graph, so wait for the resume before we
    // trust playback. Failure here is caught below alongside el.play().
    try {
      await audioCtx.resume();
      rampFadeIn();
      await el.play();
    } catch {
      // Rejection (autoplay policy, decode error, missing file, or a pause()/
      // src swap racing the pending play): stay honest, but only if THIS is
      // still the current request. A stale rejection from a superseded play()
      // must not clobber a newer one that already took over. The reconciler in
      // lib/soundtrack then keeps the pill glyph and waveform from claiming
      // music that is not audible.
      if (gen === playGen) {
        playing = false;
        emit();
      }
    }
  };

  const pause = () => {
    playing = false;
    el?.pause();
    emit();
  };

  const selectTrack = (index: number, autoplay: boolean) => {
    trackIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    if (el) {
      el.src = tracks[trackIndex].src;
      el.currentTime = 0;
      if (autoplay) play();
    }
    emit();
  };

  playerSingleton = {
    get playing() {
      return playing;
    },
    play,
    pause,
    selectTrack,
    seek(seconds: number) {
      if (el) el.currentTime = seconds;
    },
    setVolume(v: number) {
      volume = v < 0 ? 0 : v > 1 ? 1 : v;
      if (el) el.volume = volume;
    },
    getPosition() {
      return el ? el.currentTime : 0;
    },
    getSnapshot(): PlayerSnapshot {
      return { trackIndex, playing, duration: el && Number.isFinite(el.duration) ? el.duration : 0 };
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPlaying(next: boolean) {
      // Interface compat with the stub. Real playback needs a user gesture, so
      // the pill and menu call play()/pause() directly; nothing should route
      // through here in production code.
      if (next) play();
      else pause();
    },
    sample(nowMs: number, columns: number): AudioFrame {
      if (bands.length !== columns) bands = new Float32Array(columns);
      if (!analyser || !audioCtx || !playing) {
        bands.fill(0);
        return { level: 0, bands, playing };
      }
      analyser.getByteFrequencyData(freq);
      const nyquist = audioCtx.sampleRate / 2;
      // Visual counterpart of the stub's intro envelope: the wave springs up
      // from the thin line over ~1.3s after play (spec 3.3).
      const intro = clamp01((performance.now() / 1000 - playStartSec) / 1.3);
      let sum = 0;
      for (let i = 0; i < columns; i++) {
        const f0 = BAND_MIN_HZ * Math.pow(BAND_MAX_HZ / BAND_MIN_HZ, i / columns);
        const f1 = BAND_MIN_HZ * Math.pow(BAND_MAX_HZ / BAND_MIN_HZ, (i + 1) / columns);
        const b0 = Math.min(freq.length - 1, Math.floor((f0 / nyquist) * freq.length));
        const b1 = Math.min(freq.length, Math.max(b0 + 1, Math.ceil((f1 / nyquist) * freq.length)));
        let acc = 0;
        for (let b = b0; b < b1; b++) acc += freq[b];
        const v = acc / ((b1 - b0) * 255);
        bands[i] = clamp01(Math.pow(v, BAND_EXPONENT) * BAND_GAIN) * intro;
        sum += bands[i];
      }
      const level = clamp01((sum / columns) * 2.2) * intro;
      return { level, bands, playing };
    },
  };
  return playerSingleton;
}
