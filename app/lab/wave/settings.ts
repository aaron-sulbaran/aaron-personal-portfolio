// Every knob the wave lab exposes, its range, and the named compositions.
// Values are in the units the real code uses (px, seconds, the field's
// max-amplitude units), so a setting found here lifts straight into
// lib/waveform and components/soundtrack.

import type { GenParams, Move } from "./compose";
import type { RuleSettings } from "./spineRules";
import { AUTHORED } from "./compose";
import type { SpineId } from "./spines";
import type { SpectrumMotion } from "./spectrum";

export type Placement = "path" | "backdrop" | "horizon" | "seams" | "chapters" | "rail";
export type LoopKind = "standing" | "travel" | "pulse" | "draw" | "ripple";
export type ThemeName = "light" | "dark";
export type ThemeAlphas = { muted: number; accent: number };

export interface WaveSettings {
  placement: Placement;
  loop: LoopKind;
  music: boolean;
  intensity: number; // 0..1.5, scales the simulated spectrum
  beat: boolean;
  alpha: Record<ThemeName, ThemeAlphas>;
  amplitude: number; // px, the field's maxAmp
  maxThick: number; // fuzz rows a side, at most
  dotScale: number; // 1 is the site's dots (2.2px centre, 1.8px fuzz, 6.5px row gap)
  spacing: number; // px between columns
  speed: number; // px per second of anything that crosses (drift, swell, pen)
  period: number; // seconds per loop
  position: Record<Placement, number>; // meaning per placement, see POSITION
  stripHeight: Record<Placement, number>; // px across the wave
  edgeFade: number; // share of the length faded at each end, 0..0.45
  scrollInfluence: number; // 0 none, 1 the merged build's conveyor
  capsule: boolean;
  motion: MotionSettings;
  path: PathSettings;
  cursor: CursorSettings;
}

// How fast the music moves the wave: the simulated spectrum's rates
// (spectrum.ts) plus the Path's fuzz shimmer. `speed` scales every one of
// them at once, so it is the first knob to turn.
export interface MotionSettings extends SpectrumMotion {
  shimmerRate: number; // the shimmer's clock multiplier: "soft" breathes at clock x this, "threshold" blinks at x3 this
  shimmerDepth: number; // "soft" only: the share of a fuzz dot's size that breathes
  softRows: boolean; // Path: a fuzz row grows in and out with the level instead of popping, and the shimmer's cut is feathered
}

// The first simulation's rates: a snappy kick, bins that jump.
export const LIVELY_MOTION: MotionSettings = {
  speed: 1,
  tempo: 94,
  beatStrength: 1,
  softness: 1,
  attack: 0.052,
  release: 0.174,
  wander: 0.8,
  shimmerRate: 2,
  shimmerDepth: 0.22,
  softRows: false,
};

// The owner's note (2026-10-06): the reviewed pick's wave moved "way too quick
// and visually jolting". Calm keeps the random drift and slows every rate: a
// target of no dot's displacement changing faster than about 40px/s and no
// visible rise in under half a second. Measured (motionProbe.ts, 60s): at most
// 22px/s on a plain column (about 37 under the head's swell), the fastest
// rise of a row or more 1.5s, against 346px/s and 0.02s for the lively rates.
export const CALM_MOTION: MotionSettings = {
  speed: 1,
  tempo: 76,
  beatStrength: 0.45,
  softness: 3,
  attack: 0.45,
  release: 1,
  wander: 0.45,
  shimmerRate: 0.8,
  shimmerDepth: 0.22,
  softRows: true,
};

export const MOTION_RANGES = {
  speed: { min: 0.25, max: 2, step: 0.05 },
  tempo: { min: 40, max: 140, step: 1 },
  beatStrength: { min: 0, max: 1, step: 0.01 },
  softness: { min: 1, max: 8, step: 0.1 },
  attack: { min: 0.03, max: 2, step: 0.01 },
  release: { min: 0.05, max: 4, step: 0.01 },
  wander: { min: 0.05, max: 1.5, step: 0.01 },
  shimmerRate: { min: 0.25, max: 2, step: 0.05 },
  shimmerDepth: { min: 0, max: 0.5, step: 0.01 },
};

// How the pointer touches the dots (Path only). Fine pointers only, never
// under reduced motion.
export type CursorMode = "blend" | "push" | "carve" | "pluck" | "swell" | "brighten" | "lean" | "none";

export interface CursorSettings {
  mode: CursorMode;
  radius: number; // px around the pointer
  strength: number; // 0..2, 1 is the band's feel for carve
  recovery: number; // s for the effect to settle back
  saturate: number; // px/s at which the push reaches full strength
  mix: { push: number; carve: number; swell: number }; // "blend" only, 0..1 each
  scatter: ScatterSettings;
}

// A layer over any mode (scatter.ts): a fast pointer throws the dots it
// passes as projectiles; each flies with drag, then springs home.
export interface ScatterSettings {
  on: boolean;
  threshold: number; // px/s of pointer speed before anything is thrown
  launch: number; // a thrown dot's speed as a share of the pointer's
  spread: number; // 0..1, how far each dot strays from the stroke's direction and speed
  drag: number; // per second: how fast a flying dot loses speed
  returnS: number; // s for a dot to settle home once it has slowed
}

export const CURSOR_MODES: { id: CursorMode; label: string; note: string }[] = [
  { id: "blend", label: "Blend", note: "Push, carve and swell mixed: speed throws the dots, the space under the pointer clears so words stay clean, and a ring just outside lifts with your motion, like water around a hand. A resting pointer only clears." },
  { id: "carve", label: "Carve", note: "The band's original: the dots under the pointer thin out and part around it, then ease back. Over text it clears the dots from what you are reading." },
  { id: "push", label: "Push", note: "Speed-proportional, the hero name's language: a slow pointer barely moves the dots, a fast pass throws them aside, and they spring back." },
  { id: "pluck", label: "Pluck", note: "Crossing the line sends a damped ripple along it both ways, like a plucked string; still again in about a second." },
  { id: "swell", label: "Swell", note: "The wave's amplitude lifts toward the pointer and relaxes when it leaves." },
  { id: "brighten", label: "Brighten", note: "Dots within reach turn the accent colour, dot by dot, and fade back." },
  { id: "lean", label: "Lean", note: "Mine: the dots lean gently toward the pointer, as if listening, and settle back. The opposite of carve." },
  { id: "none", label: "None", note: "The wave ignores the pointer." },
];

export const CURSOR_RANGES = {
  radius: { min: 30, max: 260, step: 1 },
  strength: { min: 0, max: 2, step: 0.05 },
  recovery: { min: 0.15, max: 3, step: 0.05 },
  saturate: { min: 300, max: 4000, step: 10 },
  mix: { min: 0, max: 1, step: 0.01 },
  threshold: { min: 100, max: 3000, step: 10 },
  launch: { min: 0.05, max: 1.5, step: 0.01 },
  spread: { min: 0, max: 1, step: 0.01 },
  drag: { min: 0.5, max: 10, step: 0.1 },
  returnS: { min: 0.2, max: 3, step: 0.05 },
};

export const SCATTER_OFF: ScatterSettings = { on: false, threshold: 500, launch: 0.25, spread: 0.5, drag: 3.5, returnS: 0.8 };
export const SCATTER_ON: ScatterSettings = { ...SCATTER_OFF, on: true };

export type HeadMode = "viewport" | "progress";
export type HeadStyle = "taper" | "spark" | "swell" | "none";
export type TailMode = "all" | "train";
export type DrawEase = "linear" | "eased";

// The Path placement's own knobs. The spine itself is page-relative (spines.ts);
// "Copy values" writes its points out beside these.
export interface PathSettings {
  spine: SpineId;
  headMode: HeadMode; // viewport: the head sits at headAt of the viewport; progress: the reference's mapping
  headAt: number; // 0.3..1 of the viewport height
  preDrawn: number; // share of the spine drawn before any scroll, 0..1 (the reference starts at 0.5)
  smoothing: number; // lambda per second on the head, 0 for raw
  headStyle: HeadStyle;
  tail: TailMode;
  trainLength: number; // px of arc behind the head, tail "train" only
  wavelength: number; // px of arc per turn of the shape
  shapeTravel: number; // 0..1, the shape's phase advances with the head
  musicLayer: number; // 0..1, the simulated spectrum's share while music is on
  lineOnly: boolean; // one dotted line along the spine, no amplitude
  debug: boolean; // draw the spine and its control points
  custom: Move[]; // the editable spine ("custom"), stretch by stretch
  seed: number; // the generator's seed ("generated")
  gen: GenParams;
  newEachVisit: boolean; // reseed the generated line on every load
  // The design review's readability changes, each switchable:
  thinInWords: boolean; // inside a text block, a column with no fuzz draws nothing (no lone dots in word gaps)
  accentOutsideWords: boolean; // accent dots only outside text blocks; inside they stay muted
  swellOutsideWords: boolean; // the head's swell relaxes to nothing while the head is inside a text block
  shimmer: "threshold" | "soft"; // music's fuzz shimmer: dots blink on a threshold, or breathe in size
  headFromBand: boolean; // at load the head waits at the line's entry by the band; the first scroll pulls it out
  phoneAmplitude: number; // px, the amplitude below 600px wide (phones only); 0 keeps the amplitude
  drawSpeed: number; // px of arc per second: the most the head travels toward its scroll target; 0 for no cap
  drawEase: DrawEase; // "eased": the catch-up accelerates in instead of starting at full speed
  bandRun: boolean; // the line starts as a level run across the band, idle until the visitor decides
  rules: RuleSettings;
}

export const PLACEMENTS: { id: Placement; label: string; note: string }[] = [
  { id: "path", label: "Path", note: "In flow, one line wandering down the page from the band to the footer, drawn by your scroll." },
  { id: "backdrop", label: "Backdrop", note: "Fixed behind the content, content scrolls over it." },
  { id: "horizon", label: "Horizon", note: "The fixed bottom strip as built, never ducked." },
  { id: "seams", label: "Seams", note: "In flow, one small wave in each gap between sections." },
  { id: "chapters", label: "Chapters", note: "In flow, one wave behind each section, scrolling away with it." },
  { id: "rail", label: "Rail", note: "Vertical, fixed in a side gutter, the viewport's height." },
];

export const LOOPS: { id: LoopKind; label: string; note: string; usesSpeed: boolean }[] = [
  { id: "standing", label: "Standing", note: "The shape breathes in place; nothing crosses.", usesSpeed: false },
  { id: "travel", label: "Travelling", note: "Constant drift; one wavelength per period.", usesSpeed: true },
  { id: "pulse", label: "Pulse", note: "A swell crosses once per period, calm between.", usesSpeed: true },
  { id: "draw", label: "Draw and dissolve", note: "Draws on, holds, dissolves, rests.", usesSpeed: true },
  { id: "ripple", label: "Ripple", note: "Rings travel outward from the middle, like a speaker cone.", usesSpeed: true },
];

// The position slider means something different per placement.
export const POSITION: Record<Placement, { label: string; min: number; max: number; step: number; unit: string }> = {
  path: { label: "Unused by Path", min: 0, max: 1, step: 0.01, unit: "" },
  backdrop: { label: "Vertical position", min: 0.1, max: 0.9, step: 0.01, unit: "of viewport" },
  horizon: { label: "Baseline above bottom", min: 24, max: 240, step: 1, unit: "px" },
  seams: { label: "Offset from seam", min: -120, max: 120, step: 1, unit: "px" },
  chapters: { label: "Depth in section", min: 0, max: 1, step: 0.01, unit: "of section" },
  rail: { label: "Centre from right edge", min: 16, max: 600, step: 1, unit: "px" },
};

export const RANGES = {
  intensity: { min: 0, max: 1.5, step: 0.01 },
  alpha: { min: 0, max: 1, step: 0.01 },
  amplitude: { min: 10, max: 220, step: 1 },
  maxThick: { min: 0, max: 14, step: 1 },
  dotScale: { min: 0.5, max: 2, step: 0.05 },
  spacing: { min: 7, max: 32, step: 1 },
  speed: { min: 4, max: 400, step: 1 },
  period: { min: 2, max: 30, step: 0.5 },
  stripHeight: { min: 60, max: 600, step: 2 },
  edgeFade: { min: 0, max: 0.45, step: 0.01 },
  scrollInfluence: { min: 0, max: 1, step: 0.01 },
};

const basePositions: Record<Placement, number> = {
  path: 0,
  backdrop: 0.74,
  horizon: 72,
  seams: 0,
  chapters: 0.55,
  rail: 72,
};

const baseHeights: Record<Placement, number> = {
  path: 0,
  backdrop: 320,
  horizon: 176,
  seams: 160,
  chapters: 300,
  rail: 120,
};

// Round 3's rules: the reviewer's additions off.
export const ROUND3_RULES: RuleSettings = {
  maxEmptyVh: 1.5,
  headingClearPx: 0,
  linksClear: false,
  hairlineGapPx: 0,
  hairlineRunPx: 160,
  edgeGapPx: 0,
  edgeRunPx: 160,
  maxTurnDeg: 0,
  flatAnySlope: 0,
  flatAnyPx: 400,
  entryNearBandPx: 0,
  exitAtEdge: false,
  minTurnDeg: 0,
  minDirChanges: 0,
  alwaysVisible: false,
  endReached: false,
};

// The design review's rules (2026-10-05).
export const REVIEWED_RULES: RuleSettings = {
  maxEmptyVh: 0.6,
  headingClearPx: 24,
  linksClear: true,
  hairlineGapPx: 40,
  hairlineRunPx: 160,
  edgeGapPx: 32,
  edgeRunPx: 160,
  maxTurnDeg: 150,
  flatAnySlope: 0.2,
  flatAnyPx: 400,
  entryNearBandPx: 120,
  exitAtEdge: true,
  minTurnDeg: 60,
  minDirChanges: 2,
  alwaysVisible: false,
  endReached: false,
};

// Aaron's own rules (round 5): every proximity rule off, as he had them, plus
// his one hard bound (some of the wave on screen at every scroll position,
// which stands in for the empty-scroll limit) and the end reached at the bottom.
export const AARON_RULES: RuleSettings = { ...ROUND3_RULES, alwaysVisible: true, endReached: true };

const base: WaveSettings = {
  placement: "backdrop",
  loop: "standing",
  music: false,
  intensity: 0.8,
  beat: true,
  alpha: { light: { muted: 0.24, accent: 0.42 }, dark: { muted: 0.34, accent: 0.5 } },
  amplitude: 120,
  maxThick: 6,
  dotScale: 1,
  spacing: 13,
  speed: 40,
  period: 12,
  position: basePositions,
  stripHeight: baseHeights,
  edgeFade: 0.24,
  scrollInfluence: 0,
  capsule: true,
  motion: CALM_MOTION,
  path: {
    spine: "knot",
    headMode: "viewport",
    headAt: 0.62,
    preDrawn: 0.04,
    smoothing: 7,
    headStyle: "taper",
    tail: "all",
    trainLength: 1800,
    wavelength: 240,
    shapeTravel: 0,
    musicLayer: 0.35,
    lineOnly: false,
    debug: false,
    custom: AUTHORED[0].moves,
    seed: 7,
    gen: { through: 0.5, uneven: 0.6, offscreen: 0.5 },
    newEachVisit: false,
    thinInWords: false,
    accentOutsideWords: false,
    swellOutsideWords: false,
    shimmer: "threshold",
    headFromBand: false,
    phoneAmplitude: 0,
    drawSpeed: 1200,
    drawEase: "eased",
    bandRun: true,
    rules: ROUND3_RULES,
  },
  cursor: { mode: "push", radius: 92, strength: 1, recovery: 0.8, saturate: 1600, mix: { push: 1, carve: 0.6, swell: 0.5 }, scatter: SCATTER_OFF },
};

export const PATH_RANGES = {
  headAt: { min: 0.3, max: 1, step: 0.01 },
  preDrawn: { min: 0, max: 1, step: 0.01 },
  smoothing: { min: 0, max: 20, step: 0.5 },
  trainLength: { min: 200, max: 5000, step: 10 },
  wavelength: { min: 80, max: 700, step: 5 },
  shapeTravel: { min: 0, max: 1, step: 0.01 },
  musicLayer: { min: 0, max: 1, step: 0.01 },
  drawSpeed: { min: 0, max: 4000, step: 50 },
};

type Preset = { id: string; label: string; why: string; values: WaveSettings; parked?: boolean };

type PresetPatch = Omit<Partial<WaveSettings>, "path" | "cursor" | "motion"> & {
  path?: Partial<PathSettings>;
  cursor?: Partial<Omit<CursorSettings, "scatter">> & { scatter?: Partial<ScatterSettings> };
  motion?: Partial<MotionSettings>;
};

const preset = (id: string, label: string, why: string, patch: PresetPatch, parked = false): Preset => ({
  id,
  label,
  why,
  parked,
  values: {
    ...base,
    ...patch,
    position: { ...basePositions, ...patch.position },
    stripHeight: { ...baseHeights, ...patch.stripHeight },
    alpha: { light: { ...base.alpha.light, ...patch.alpha?.light }, dark: { ...base.alpha.dark, ...patch.alpha?.dark } },
    motion: { ...base.motion, ...patch.motion },
    path: { ...base.path, ...patch.path },
    cursor: { ...base.cursor, ...patch.cursor, scatter: { ...base.cursor.scatter, ...patch.cursor?.scatter } },
  },
});

// Aaron's pick, reviewed: everything but the music motion, shared by its calm and lively versions.
const REVIEWED: PresetPatch = {
  placement: "path",
  music: true,
  intensity: 0.8,
  beat: true,
  amplitude: 80,
  maxThick: 5,
  dotScale: 1,
  spacing: 13,
  edgeFade: 0.24,
  capsule: true,
  alpha: { light: { muted: 0.35, accent: 0.5 }, dark: { muted: 0.28, accent: 0.5 } },
  path: {
    spine: "signature-reviewed",
    headMode: "viewport",
    headAt: 0.7,
    preDrawn: 0,
    smoothing: 7,
    headStyle: "swell",
    tail: "train",
    trainLength: 1600,
    wavelength: 240,
    shapeTravel: 0,
    musicLayer: 0.35,
    thinInWords: true,
    accentOutsideWords: true,
    swellOutsideWords: true,
    shimmer: "soft",
    headFromBand: true,
    phoneAmplitude: 48,
    rules: REVIEWED_RULES,
  },
};

// Aaron's pick 2 (round 5), from his copied values: a generated line he
// accepted with every proximity rule off, drawn by page progress, carve under
// the pointer with the scatter layer on top. Only the music motion differs
// from his copy (calm, as he asked of every preset), plus the new fields.
const PICK2: PresetPatch = {
  placement: "path",
  music: true,
  intensity: 0.9,
  beat: true,
  amplitude: 80,
  maxThick: 5,
  dotScale: 1,
  spacing: 14,
  edgeFade: 0.24,
  capsule: true,
  alpha: { light: { muted: 0.35, accent: 0.5 }, dark: { muted: 0.4, accent: 0.69 } },
  path: {
    spine: "generated",
    seed: 487570111,
    gen: { through: 0.5, uneven: 0.6, offscreen: 0.5 },
    newEachVisit: false,
    headMode: "progress",
    headAt: 0.7,
    preDrawn: 0,
    smoothing: 7,
    headStyle: "swell",
    tail: "train",
    trainLength: 1600,
    wavelength: 240,
    shapeTravel: 0,
    musicLayer: 0.35,
    thinInWords: false,
    accentOutsideWords: true,
    swellOutsideWords: false,
    shimmer: "threshold",
    headFromBand: false,
    phoneAmplitude: 0,
    debug: true,
    drawSpeed: 1200,
    drawEase: "eased",
    bandRun: true,
    rules: AARON_RULES,
  },
  cursor: { mode: "carve", radius: 96, strength: 1, recovery: 0.9, saturate: 1600, mix: { push: 1, carve: 0.6, swell: 0.5 }, scatter: SCATTER_ON },
};

export const PRESETS: Preset[] = [
  preset(
    "aaron",
    "Aaron's pick",
    "Through the words as a 1600px train with a swelling head, music on. The base for the irregular lines: switch the spine to Signature line, Margin note, Late bloom or a generated one.",
    {
      placement: "path",
      music: true,
      intensity: 0.8,
      beat: true,
      amplitude: 80,
      maxThick: 5,
      dotScale: 1,
      spacing: 13,
      edgeFade: 0.24,
      capsule: true,
      alpha: { light: { muted: 0.35, accent: 0.5 }, dark: { muted: 0.34, accent: 0.5 } },
      path: {
        spine: "through",
        headMode: "viewport",
        headAt: 0.7,
        preDrawn: 0,
        smoothing: 7,
        headStyle: "swell",
        tail: "train",
        trainLength: 1600,
        wavelength: 240,
        shapeTravel: 0,
        musicLayer: 0.35,
      },
    },
  ),
  preset(
    "pick2",
    "Aaron's pick 2",
    "His round 5 pick: a generated line (seed 487570111) with every proximity rule off, always partly on screen, reaching the end at the bottom; the head follows page progress at a capped draw speed; it starts as a level run across the band and waits for Play it or Not now; carve under the pointer, and a fast pass scatters the dots, which spring home; dark alphas 0.40 and 0.69.",
    PICK2,
  ),
  preset(
    "reviewed",
    "Aaron's pick, reviewed",
    "His pick with the design review applied: Signature line, reviewed; no lone dots in word gaps; accent only outside text; the head's swell relaxes inside text; music shimmer breathes instead of blinking; muted dots 0.28 in dark; the reviewer's spine rules on. Calm music motion, as every preset but the lively one.",
    REVIEWED,
  ),
  preset(
    "reviewed-lively",
    "Aaron's pick, reviewed, lively",
    "The reviewed pick with the first simulation's music motion: a snapping 94 BPM kick, levels that jump within a twentieth of a second, the shimmer at its old rate. Everything else matches the calm one.",
    { ...REVIEWED, motion: LIVELY_MOTION },
  ),
  preset(
    "water",
    "Aaron's pick, hand in water",
    "His pick with the combined pointer: a push in proportion to speed, a small clearing under the pointer and a ring that lifts with your motion, all settled within about a second. A resting pointer only clears.",
    {
      placement: "path",
      music: true,
      amplitude: 80,
      maxThick: 5,
      alpha: { light: { muted: 0.35, accent: 0.5 }, dark: { muted: 0.34, accent: 0.5 } },
      path: { spine: "signature", headAt: 0.7, preDrawn: 0, smoothing: 7, headStyle: "swell", tail: "train", trainLength: 1600, musicLayer: 0.35 },
      cursor: { mode: "blend", radius: 96, strength: 1, recovery: 0.9, saturate: 1600, mix: { push: 1, carve: 0.6, swell: 0.5 } },
    },
  ),
  preset(
    "reader",
    "Aaron's pick, quiet reader",
    "The same line with the pointer tuned for reading: a wider, firmer clearing, a softer push that needs a real flick to saturate, almost no swell.",
    {
      placement: "path",
      music: true,
      amplitude: 80,
      maxThick: 5,
      alpha: { light: { muted: 0.35, accent: 0.5 }, dark: { muted: 0.34, accent: 0.5 } },
      path: { spine: "signature", headAt: 0.7, preDrawn: 0, smoothing: 7, headStyle: "swell", tail: "train", trainLength: 1600, musicLayer: 0.35 },
      cursor: { mode: "blend", radius: 120, strength: 1, recovery: 0.7, saturate: 2400, mix: { push: 0.55, carve: 1, swell: 0.15 } },
    },
  ),
  preset(
    "switchback",
    "Switchback",
    "A calmer line drawn by your scroll. It crosses each gap on a gentle slope and turns past the screen's edge, so it enters from one side and leaves by the other, never sitting still under a paragraph.",
    {
      placement: "path",
      amplitude: 64,
      maxThick: 4,
      alpha: { light: { muted: 0.34, accent: 0.6 }, dark: { muted: 0.4, accent: 0.62 } },
      path: { spine: "switchback", headMode: "progress", headAt: 0.7, preDrawn: 0.02, tail: "all" },
    },
  ),
  preset(
    "train",
    "Through the words, a train",
    "A finite train of wave rides long diagonals behind the text: it enters, follows you, and leaves, so only a stretch of it is ever on screen.",
    {
      placement: "path",
      amplitude: 80,
      maxThick: 5,
      alpha: { light: { muted: 0.22, accent: 0.42 }, dark: { muted: 0.34, accent: 0.5 } },
      path: { spine: "through", headMode: "viewport", headAt: 0.7, preDrawn: 0, tail: "train", trainLength: 1600, headStyle: "swell" },
    },
  ),
  preset(
    "thresholds",
    "Thresholds",
    "A small travelling wave in each gap between sections, scrolling away with the page. It never sits under words, and the next one peeking at the bottom of the screen is the invitation to keep going.",
    {
      placement: "seams",
      loop: "travel",
      period: 9,
      speed: 28,
      amplitude: 70,
      maxThick: 4,
      edgeFade: 0.3,
      alpha: { light: { muted: 0.34, accent: 0.6 }, dark: { muted: 0.38, accent: 0.62 } },
    },
  ),
  preset(
    "tide",
    "Tide",
    "Fixed backdrop in the lower third, breathing in place. Text rises through it as you read; nothing crosses sideways, so nothing tugs the eye off the line.",
    { intensity: 0.55, maxThick: 5 },
  ),
  preset(
    "signature",
    "Signature",
    "The backdrop draws itself on, holds, and dissolves. It never simply persists; it is gone for a beat every cycle.",
    { loop: "draw", period: 16, speed: 260, intensity: 0.55, alpha: { light: { muted: 0.24, accent: 0.46 }, dark: { muted: 0.34, accent: 0.5 } } },
  ),
  preset(
    "horizon",
    "Horizon, held",
    "The strip as built, minus the duck and the conveyor: one constant alpha, a calm standing breath, the capsule on its line.",
    { placement: "horizon", amplitude: 44, maxThick: 6, edgeFade: 0.1, alpha: { light: { muted: 0.3, accent: 0.55 }, dark: { muted: 0.36, accent: 0.6 } } },
  ),
  preset(
    "chapters",
    "Chapters",
    "One quiet wave behind each section that swells every few seconds and scrolls away with it, so each section carries its own.",
    {
      placement: "chapters",
      loop: "pulse",
      period: 7,
      speed: 180,
      amplitude: 90,
      edgeFade: 0.3,
      intensity: 0.55,
      alpha: { light: { muted: 0.2, accent: 0.4 }, dark: { muted: 0.3, accent: 0.46 } },
    },
  ),
  preset(
    "knot",
    "Unspool",
    "The reference's idea in our dots: the wave starts as a knot beside the music question and unspools down the page as you scroll, in sweeps that leave both edges and return. It only moves while you scroll, so it is still whenever you read.",
    {
      placement: "path",
      amplitude: 70,
      maxThick: 4,
      alpha: { light: { muted: 0.26, accent: 0.46 }, dark: { muted: 0.38, accent: 0.54 } },
      path: { spine: "knot", headMode: "viewport", headAt: 0.62, preDrawn: 0.08, tail: "all" },
    },
    true,
  ),
];

// The lab opens on the reviewed pick (calm); "Aaron's pick" stays the first button.
export const DEFAULT_PRESET_ID = "pick2";
export const DEFAULT_SETTINGS: WaveSettings = PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!.values;
