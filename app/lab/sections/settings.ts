// The sections lab's settings: one grammar for the text under the hero,
// tuned per section. Every block (kicker, heading, body, item, link list)
// follows the reader by one shared lag; the per-section choices decide how
// each one arrives. Nothing here names a word or a count, so the grammar
// survives a copy rewrite.

export type Source = "today" | "grammar";
export type Reveal = "mask" | "blur" | "words" | "fade" | "none";
export type Split = "lines" | "block";
export type EaseName = "site" | "power2" | "power3" | "expo" | "sine" | "linear";
export type Arrival = "rise" | "blur" | "hairline";
export type StickyStop = "section" | "early";
export type UpLayout = "today" | "beside";
export type KickerFace = "profa" | "inter";
export type SectionKey = "about" | "who" | "up" | "connect";

export interface SectionSettings {
  heading: Reveal; // the kicker's label and the h2 (Who I am has only the kicker)
  body: Reveal; // the lede, the paragraph or the link rows (Up to now uses its arrival instead)
  split: Split; // mask and blur: line by line, or the block as one
  sticky: boolean; // the kicker and heading hold while the body passes (desktop only)
  ruleDraw: boolean; // the kicker's rule draws itself before the label
}

export interface LabSettings {
  source: Source;
  scrub: boolean; // scrubbed and reversible, or triggered once
  lag: number; // s: how far behind the real scroll every element settles
  lagStep: number; // s: extra lag per element within a section (kicker, heading, body)
  spread: number; // 0..1: how much lines, words and rows overlap as they arrive in a block
  bandStart: number; // viewport %: a block starts when its top reaches this line
  bandEnd: number; // viewport %: and is fully in when its top reaches this one
  follow: number; // viewport %: bodies and items start this much later than headings
  ease: EaseName;
  rise: number; // px
  blur: number; // px
  dim: number; // opacity of a word not yet read (words grammar)
  stickyTop: number; // px from the viewport top where a sticky heading holds
  stickyStop: StickyStop;
  stopOffset: number; // px before the section's end where the heading lets go ("early")
  kickerFace: KickerFace;
  sections: Record<SectionKey, SectionSettings>;
  up: { layout: UpLayout; arrival: Arrival; itemLagStep: number };
  connect: { rowDraw: boolean };
  wave: { show: boolean; link: boolean };
}

export const SECTION_LABELS: Record<SectionKey, string> = { about: "About", who: "Who I am", up: "Up to now", connect: "Connect" };

export const EASE_LABELS: Record<EaseName, string> = {
  site: "Site ease",
  power2: "Power2 out",
  power3: "Power3 out",
  expo: "Expo out",
  sine: "Sine in out",
  linear: "Linear",
};

export const RANGES = {
  lag: { min: 0.2, max: 2, step: 0.05 },
  lagStep: { min: 0, max: 0.3, step: 0.01 },
  spread: { min: 0, max: 1, step: 0.05 },
  bandStart: { min: 50, max: 100, step: 1 },
  bandEnd: { min: 10, max: 90, step: 1 },
  follow: { min: 0, max: 25, step: 1 },
  rise: { min: 0, max: 48, step: 1 },
  blur: { min: 0, max: 16, step: 0.5 },
  dim: { min: 0.05, max: 0.6, step: 0.01 },
  stickyTop: { min: 24, max: 200, step: 4 },
  stopOffset: { min: 0, max: 400, step: 10 },
  itemLagStep: { min: 0, max: 0.3, step: 0.01 },
} as const;

const RECOMMENDED: LabSettings = {
  source: "grammar",
  scrub: true,
  lag: 0.8,
  lagStep: 0.12,
  spread: 0.4,
  bandStart: 90,
  bandEnd: 60,
  follow: 6,
  ease: "site",
  rise: 18,
  blur: 6,
  dim: 0.26,
  stickyTop: 112,
  stickyStop: "section",
  stopOffset: 120,
  kickerFace: "profa",
  sections: {
    about: { heading: "mask", body: "blur", split: "lines", sticky: false, ruleDraw: true },
    who: { heading: "fade", body: "words", split: "lines", sticky: true, ruleDraw: true },
    up: { heading: "mask", body: "fade", split: "lines", sticky: true, ruleDraw: true },
    connect: { heading: "mask", body: "mask", split: "lines", sticky: false, ruleDraw: true },
  },
  up: { layout: "beside", arrival: "hairline", itemLagStep: 0.06 },
  connect: { rowDraw: true },
  wave: { show: true, link: true },
};

export interface Preset {
  id: string;
  label: string;
  why: string;
  values: LabSettings;
}

const withSections = (patch: Partial<Record<SectionKey, Partial<SectionSettings>>>): LabSettings["sections"] => {
  const out = { ...RECOMMENDED.sections };
  for (const key of Object.keys(patch) as SectionKey[]) out[key] = { ...out[key], ...patch[key] };
  return out;
};

export const PRESETS: Preset[] = [
  {
    id: "recommended",
    label: "Recommended: each section its own arrival",
    why: "One lag for everything, but each section arrives the way its content reads: About's title rises out of its mask and the lede sharpens in; Who I am's label holds beside the paragraph while its words brighten in turn; Up to now's heading holds while each item draws its hairline and rises; Connect's rows draw their rules and lift in order.",
    values: RECOMMENDED,
  },
  {
    id: "today",
    label: "Site today (the control)",
    why: "The real components as they ship: the once-triggered fade and rise, ReadAlong's gradient sweep and Up to now's parallax.",
    values: { ...RECOMMENDED, source: "today" },
  },
  {
    id: "uniform",
    label: "One motion everywhere (the tell)",
    why: "The anti-reference on purpose: the same scrubbed fade and rise on every block of every section, no sticky, no hairlines. Compare it with the recommendation to see what fitting each section buys.",
    values: {
      ...RECOMMENDED,
      sections: withSections({
        about: { heading: "fade", body: "fade", ruleDraw: false },
        who: { heading: "fade", body: "fade", sticky: false, ruleDraw: false },
        up: { heading: "fade", sticky: false, ruleDraw: false },
        connect: { heading: "fade", body: "fade", ruleDraw: false },
      }),
      up: { layout: "today", arrival: "rise", itemLagStep: 0 },
      connect: { rowDraw: false },
    },
  },
  {
    id: "heavy",
    label: "Heavy lag (1.6 s)",
    why: "The recommendation with the lag doubled, to find where weight turns into sluggishness.",
    values: { ...RECOMMENDED, lag: 1.6, lagStep: 0.2 },
  },
  {
    id: "light",
    label: "Light lag (0.35 s)",
    why: "The recommendation with the lag nearly gone: structure without much weight.",
    values: { ...RECOMMENDED, lag: 0.35, lagStep: 0.06 },
  },
  {
    id: "once",
    label: "Triggered once",
    why: "The same grammar played once as each block crosses the band, not tied to the scroll: the lag becomes each element's duration.",
    values: { ...RECOMMENDED, scrub: false },
  },
  {
    id: "up-today-layout",
    label: "Up to now in today's layout",
    why: "Keeps Up to now's two staggered columns under the heading (no sticky there, it would sit over the items); the items still arrive in turn.",
    values: { ...RECOMMENDED, up: { ...RECOMMENDED.up, layout: "today" }, sections: withSections({ up: { sticky: false } }) },
  },
];

export const DEFAULT_SETTINGS = RECOMMENDED;

export function mergeSettings(stored: Partial<LabSettings>): LabSettings {
  const d = DEFAULT_SETTINGS;
  const sections = { ...d.sections };
  for (const key of Object.keys(d.sections) as SectionKey[]) sections[key] = { ...d.sections[key], ...stored.sections?.[key] };
  return {
    ...d,
    ...stored,
    sections,
    up: { ...d.up, ...stored.up },
    connect: { ...d.connect, ...stored.connect },
    wave: { ...d.wave, ...stored.wave },
  };
}

// The values as flat, readable JSON: one dotted key per setting.
export function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, inner] of Object.entries(value)) flatten(inner, prefix ? `${prefix}.${key}` : key, out);
  } else {
    out[prefix] = value;
  }
  return out;
}
