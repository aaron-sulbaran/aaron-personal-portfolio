// Simulated music: no audio, ever. A handful of seeded voices, each a bump
// over the log spectrum (low on the left, as in lib/waveform/bands.ts) whose
// level wanders smoothly, plus an optional beat (a kick on every beat, hats
// on the off-beats). The bins follow an attack and release envelope, the way
// the real analyser's magnitudes feed the field, so the reactive look can be
// judged in silence. Output is in the field's units: bands peak past the 0.36
// accent gate on loud passages, the level sits around 0.3 to 0.6.
//
// Every rate is a knob (SpectrumMotion). The lively values reproduce the
// first simulation to within rounding: 94 BPM, a kick decaying at 9 and hats at 16 per
// beat, bins rising with a 52ms time constant and falling with 174ms.

export const BINS = 64;

export interface SpectrumMotion {
  speed: number; // scales every time-based rate at once: tempo, wander, attack, release (and the shimmer)
  tempo: number; // BPM
  beatStrength: number; // 0..1, the kick and hats' share
  softness: number; // 1 is the snap; the kick and hat decays are divided by it, so a hit becomes a swell
  attack: number; // s, the bins' time constant rising
  release: number; // s, falling
  wander: number; // Hz, the fastest of the voices' wandering sines (the slower two keep their ratios)
}

// The voices' fastest sine averages 0.8 Hz (see voice()); wander scales from it.
const NATIVE_WANDER = 0.8;

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
  beatPhase: number; // beats elapsed; accumulated, so moving a rate never jumps the music
  wanderTime: number; // s of wander at the native rates
}

export function createSpectrum(): Spectrum {
  return { bins: new Float32Array(BINS), level: 0, beatPhase: 0, wanderTime: 0 };
}

// A hit at the start of each period, decaying at `rate` per period, shaped to
// reach exactly 0 at the next hit so a slow decay never steps at the wrap.
// At rate 9 or more this is the plain exp(-x * rate) to within 1e-4.
const hit = (x: number, rate: number) => {
  const end = Math.exp(-rate);
  return (Math.exp(-x * rate) - end) / (1 - end);
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Step the spectrum by dt seconds. `amount` is the eased music level times
// the intensity slider; 0 lets every bin fall back to silence.
export function stepSpectrum(spectrum: Spectrum, dt: number, amount: number, beat: boolean, motion: SpectrumMotion): void {
  const run = dt * motion.speed;
  spectrum.beatPhase += (run * motion.tempo) / 60;
  spectrum.wanderTime += (run * motion.wander) / NATIVE_WANDER;
  const time = spectrum.wanderTime;
  const beatPhase = spectrum.beatPhase;
  const sinceBeat = beatPhase - Math.floor(beatPhase);
  const offBeat = (sinceBeat + 0.5) % 1;
  const downbeat = Math.floor(beatPhase) % 4 === 0 ? 1.25 : 1;
  const soft = Math.max(1, motion.softness);
  const kick = beat ? hit(sinceBeat, 9 / soft) * downbeat * motion.beatStrength : 0;
  const hat = beat ? hit(offBeat, 16 / soft) * motion.beatStrength : 0;
  const rise = 1 - Math.exp(-run / Math.max(1e-3, motion.attack));
  const fall = 1 - Math.exp(-run / Math.max(1e-3, motion.release));
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
    spectrum.bins[b] = before + (target - before) * (target > before ? rise : fall);
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
