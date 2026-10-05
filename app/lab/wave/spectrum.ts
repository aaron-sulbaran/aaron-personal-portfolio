import { easeToward } from "@/lib/waveform/field";

// Simulated music: no audio, ever. A handful of seeded voices, each a bump
// over the log spectrum (low on the left, as in lib/waveform/bands.ts) whose
// level wanders smoothly, plus an optional beat (a kick on every beat, hats
// on the off-beats). The bins ease up fast and fall slower, the way the real
// analyser's magnitudes feed the field, so the reactive look can be judged in
// silence. Output is in the field's units: bands peak past the 0.36 accent
// gate on loud passages, the level sits around 0.3 to 0.6.

export const BINS = 64;
const BPM = 94;

interface Voice {
  centre: number; // 0..1 along the log spectrum
  width: number;
  gain: number;
  rates: [number, number, number]; // Hz of the three wandering sines
  phases: [number, number, number];
}

// A tiny seeded generator so every load plays the same "track".
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const random = seeded(20261005);
const voice = (centre: number, width: number, gain: number): Voice => ({
  centre,
  width,
  gain,
  rates: [0.07 + random() * 0.08, 0.19 + random() * 0.2, 0.5 + random() * 0.6],
  phases: [random() * 6.28, random() * 6.28, random() * 6.28],
});

const VOICES: Voice[] = [
  voice(0.14, 0.1, 0.42), // bass
  voice(0.32, 0.14, 0.34), // keys
  voice(0.5, 0.1, 0.38), // lead
  voice(0.64, 0.16, 0.26), // pad
  voice(0.8, 0.12, 0.18), // air
];

export interface Spectrum {
  bins: Float32Array;
  level: number;
}

export function createSpectrum(): Spectrum {
  return { bins: new Float32Array(BINS), level: 0 };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Step the spectrum at `time` seconds. `amount` is the eased music level times
// the intensity slider; 0 lets every bin fall back to silence.
export function stepSpectrum(spectrum: Spectrum, time: number, dt: number, amount: number, beat: boolean): void {
  const beatPhase = (time * BPM) / 60;
  const sinceBeat = beatPhase - Math.floor(beatPhase);
  const offBeat = (sinceBeat + 0.5) % 1;
  const downbeat = Math.floor(beatPhase) % 4 === 0 ? 1.25 : 1;
  const kick = beat ? Math.exp(-sinceBeat * 9) * downbeat : 0;
  const hat = beat ? Math.exp(-offBeat * 16) : 0;
  // A phrase swell every 8 bars so loud and quiet passages trade.
  const phrase = 0.7 + 0.3 * Math.sin((beatPhase / 32) * Math.PI * 2);

  let sum = 0;
  for (let b = 0; b < BINS; b++) {
    const f = (b + 0.5) / BINS;
    let energy = 0.05 * (1 - f); // a pink floor, tilted down
    for (let v = 0; v < VOICES.length; v++) {
      const vo = VOICES[v];
      const bump = Math.exp(-(((f - vo.centre) / vo.width) ** 2));
      if (bump < 1e-3) continue;
      const wander =
        0.55 +
        0.25 * Math.sin(time * vo.rates[0] * 6.28 + vo.phases[0]) +
        0.14 * Math.sin(time * vo.rates[1] * 6.28 + vo.phases[1]) +
        0.06 * Math.sin(time * vo.rates[2] * 6.28 + vo.phases[2] + f * 9);
      energy += vo.gain * bump * wander * phrase;
    }
    energy += 0.55 * kick * Math.exp(-(((f - 0.06) / 0.07) ** 2));
    energy += 0.22 * hat * Math.exp(-(((f - 0.88) / 0.07) ** 2));
    const target = clamp01(Math.pow(clamp01(energy), 1.35) * 1.9) * amount;
    const before = spectrum.bins[b];
    spectrum.bins[b] = easeToward(before, target, target > before ? 0.35 : 0.12, dt);
    sum += spectrum.bins[b];
  }
  spectrum.level = clamp01((sum / BINS) * 2.2);
}

// The band under position u (0..1 along the wave), linearly interpolated.
export function bandAt(spectrum: Spectrum, u: number): number {
  const x = clamp01(u) * (BINS - 1);
  const i = Math.floor(x);
  const j = Math.min(BINS - 1, i + 1);
  return spectrum.bins[i] + (spectrum.bins[j] - spectrum.bins[i]) * (x - i);
}
