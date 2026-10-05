// Every knob the wave lab exposes, its range, and the named compositions.
// Values are in the units the real code uses (px, seconds, the field's
// max-amplitude units), so a setting found here lifts straight into
// lib/waveform and components/soundtrack.

export type Placement = "backdrop" | "horizon" | "seams" | "chapters" | "rail";
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
}

export const PLACEMENTS: { id: Placement; label: string; note: string }[] = [
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
  backdrop: 0.74,
  horizon: 72,
  seams: 0,
  chapters: 0.55,
  rail: 72,
};

const baseHeights: Record<Placement, number> = {
  backdrop: 320,
  horizon: 176,
  seams: 160,
  chapters: 300,
  rail: 120,
};

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
};

type Preset = { id: string; label: string; why: string; values: WaveSettings };

const preset = (id: string, label: string, why: string, patch: Partial<WaveSettings>): Preset => ({
  id,
  label,
  why,
  values: {
    ...base,
    ...patch,
    position: { ...basePositions, ...patch.position },
    stripHeight: { ...baseHeights, ...patch.stripHeight },
    alpha: { light: { ...base.alpha.light, ...patch.alpha?.light }, dark: { ...base.alpha.dark, ...patch.alpha?.dark } },
  },
});

export const PRESETS: Preset[] = [
  preset(
    "thresholds",
    "Thresholds (recommended)",
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
];

export const DEFAULT_SETTINGS: WaveSettings = PRESETS[0].values;
