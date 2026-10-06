import type { ContributionWindow } from "./data";
import { accentRamp, type HeightCurve, type LevelCurve } from "./skyline/maths";

// Everything the panel can set, the presets (Aaron's pick first), and the
// flat export the copy button writes.

export type Placement = "section" | "inside" | "strip" | "divider";
export type Companions = "stats" | "numbers" | "alone";
export type DataSource = "real" | "sample";
// After today: stop the grid at today, or run it to December 31 with empty slabs.
export type Future = "omit" | "slabs";
// Which real figure opens the numbers row.
export type Lead = "streak" | "total" | "days";
// What moves the chart between flat and skyline: a scroll crossing that plays
// the whole morph, the scroll position itself (scrubbed with lag), or the
// round 2 entrance (rises the first time it is seen, then only the toggle).
export type MorphMode = "play" | "scrub" | "load";

export type Settings = {
  placement: Placement;
  companions: Companions;
  window: ContributionWindow;
  lead: Lead;
  data: DataSource;
  future: Future;
  view: "2d" | "3d";
  share: number; // the lightest step's share of the accent, percent
  curve: HeightCurve;
  levels: LevelCurve;
  heightCap: number; // the quantile of active days the tallest bar stands for, 1 the busiest day
  heightScale: number;
  duration: number; // morph, ms
  card: boolean;
  question: boolean;
  morph: MorphMode;
  triggerPct: number; // the morph starts when the block's top crosses this line, percent of the viewport from its top
  scrubBand: number; // scrub only: viewport percent of scroll the morph spans after the trigger line
  scrubLag: number; // scrub only: seconds the morph trails the scroll
  reveal: boolean; // a stand-in for the block's own mask-in (the sections grammar), so the two can be judged together
};

// The sections lab's grammar the reveal stand-in borrows: band 90 to 60, lag 0.8s, power3.
export const REVEAL_BAND = { start: 90, end: 60, lag: 0.8, rise: 32 } as const;

// The view toggle's fill: the controls lab's pick for small links (the nav's rise in the quiet tint).
export const TOGGLE_FILL = {
  durationMs: 450,
  ease: "cubic-bezier(0.785, 0.135, 0.15, 0.86)",
  radiusPx: 10,
} as const;

export const MORPH_NAMES: Record<MorphMode, string> = {
  play: "Morph: plays once crossed",
  scrub: "Morph: scrubs with lag",
  load: "Morph: rises when first seen (round 2)",
};

export const MORPH_NOTES: Record<MorphMode, string> = {
  play: "Flat until the block's top crosses the trigger line; then the whole morph plays at its own duration. Back above the line, it plays back to flat.",
  scrub: "The morph follows the scroll across a band after the trigger line, trailing it by the lag. Stop halfway and it holds halfway.",
  load: "Round 2: the skyline rises the first time the chart is seen and stays; only the toggle changes it after that.",
};

export const TOGGLE_RULE =
  "A click on Flat or Skyline holds until the trigger line is next crossed; that crossing hands the view back to the scroll (down: skyline, up: flat).";

export const PLACEMENT_NAMES: Record<Placement, string> = {
  section: "Own section",
  inside: "Inside Up to now",
  strip: "Strip under Connect",
  divider: "The divider",
};

export const PLACEMENT_NOTES: Record<Placement, string> = {
  section: "A new section between Up to now and Connect, kicker and heading in the site's grammar.",
  inside: "Up to now's signature element, under the list; no heading of its own.",
  strip: "The flat map only, no 3D, under the Connect links. Companions do not apply.",
  divider: "Mine: the weekly totals stand on the hairline above Connect, so the border itself is the data. Flat, one line of text.",
};

export const COMPANION_NAMES: Record<Companions, string> = {
  stats: "Its four stats",
  numbers: "Numbers row",
  alone: "Skyline alone",
};

export const WINDOW_NAMES: Record<ContributionWindow, string> = {
  "6mo": "Last 6 months",
  "12mo": "Last 12 months",
  year: "This year",
};

export const LEAD_NAMES: Record<Lead, string> = {
  streak: "Streak",
  total: "Total",
  days: "Active days",
};

export type Preset = { id: string; name: string; note: string; settings: Settings };

// Aaron's copied JSON from round 2, verbatim in settings.
const AARON_PASTED: Settings = {
  placement: "inside",
  companions: "stats",
  window: "12mo",
  lead: "streak",
  data: "real",
  future: "omit",
  view: "3d",
  share: 30,
  curve: "power",
  levels: "linear",
  heightCap: 1,
  heightScale: 1,
  duration: 1300,
  card: false,
  question: false,
  morph: "load",
  triggerPct: 70,
  scrubBand: 30,
  scrubLag: 0.8,
  reveal: false,
};

export const PRESETS: readonly Preset[] = [
  {
    id: "aaron-6mo",
    name: "Aaron's pick, 6 months, scroll morph",
    note: "His round 2 pick on the last 6 months: flat until the block's top crosses 60 percent of the viewport (where the reveal's band ends, so the whole flat grid is on screen first), then the full 1300ms morph to the skyline; back to flat when the reader scrolls back above it. The toggle overrides until the next crossing.",
    settings: { ...AARON_PASTED, window: "6mo", morph: "play", triggerPct: 60, reveal: true },
  },
  {
    id: "aaron-pasted",
    name: "Aaron's pick as pasted",
    note: "His round 2 JSON exactly: the last 12 months, rising into the skyline the first time it is seen.",
    settings: AARON_PASTED,
  },
  {
    id: "recommended",
    name: "Recommended",
    note: "Inside Up to now, the last 12 months, flat first with Skyline one click away, the current streak leading three real figures and two placeholders. Colour steps on the square root of a busy day, so August to October climb through all four; bars on the original curve with the tallest at the 95th percentile, so the one outsized day cannot shrink the rest.",
    settings: {
      placement: "inside",
      companions: "numbers",
      window: "12mo",
      lead: "streak",
      data: "real",
      future: "omit",
      view: "2d",
      share: 32,
      curve: "power",
      levels: "sqrt",
      heightCap: 0.95,
      heightScale: 1,
      duration: 1300,
      card: false,
      question: false,
      morph: "load",
      triggerPct: 70,
      scrubBand: 30,
      scrubLag: 0.8,
      reveal: false,
    },
  },
  {
    id: "full",
    name: "Full skyline",
    note: "The component as its author meant it: its own section, rising into 3D when seen, with its four stats in the corners. The loudest option.",
    settings: {
      placement: "section",
      companions: "stats",
      window: "12mo",
      lead: "streak",
      data: "real",
      future: "omit",
      view: "3d",
      share: 32,
      curve: "power",
      levels: "linear",
      heightCap: 1,
      heightScale: 1,
      duration: 1300,
      card: false,
      question: false,
      morph: "load",
      triggerPct: 70,
      scrubBand: 30,
      scrubLag: 0.8,
      reveal: false,
    },
  },
  {
    id: "quiet",
    name: "Quietest",
    note: "The divider: weekly bars on the hairline above Connect and one line of text. No chart to read, just a pulse.",
    settings: {
      placement: "divider",
      companions: "alone",
      window: "12mo",
      lead: "streak",
      data: "real",
      future: "omit",
      view: "2d",
      share: 32,
      curve: "power",
      levels: "sqrt",
      heightCap: 0.95,
      heightScale: 1,
      duration: 1300,
      card: false,
      question: false,
      morph: "load",
      triggerPct: 70,
      scrubBand: 30,
      scrubLag: 0.8,
      reveal: false,
    },
  },
];

export const DEFAULT_SETTINGS = PRESETS[0].settings;

export const sameSettings = (a: Settings, b: Settings) => JSON.stringify(a) === JSON.stringify(b);

export const exportValues = (s: Settings, theme: string) => {
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  return {
    preset: preset ? preset.name : "custom",
    placement: PLACEMENT_NAMES[s.placement],
    companions: s.placement === "strip" || s.placement === "divider" ? "n/a for this placement" : COMPANION_NAMES[s.companions],
    window: WINDOW_NAMES[s.window],
    numbersLead: s.placement === "strip" || s.placement === "divider" || s.companions !== "numbers" ? "n/a, no numbers row" : LEAD_NAMES[s.lead],
    data: s.data === "real" ? "real" : "sample year (comparison only)",
    afterToday: s.window !== "year" ? "n/a, the rolling window ends today" : s.future === "omit" ? "grid stops at today" : "empty slabs to December 31",
    defaultView:
      s.morph === "load" ? (s.view === "3d" ? "skyline (3D)" : "flat (2D)") : "flat until the trigger line, then skyline (scroll decides)",
    morphMode: MORPH_NAMES[s.morph],
    triggerLine: s.morph === "load" ? "n/a, rises when first seen" : "block top at " + s.triggerPct + "% of the viewport",
    scrubBand: s.morph === "scrub" ? "block top from " + s.triggerPct + "% to " + Math.max(5, s.triggerPct - s.scrubBand) + "% of the viewport" : "n/a",
    scrubLag: s.morph === "scrub" ? s.scrubLag + "s" : "n/a",
    scrubEase: s.morph === "scrub" ? "none (the morph eases itself: in-out cubic camera, out cubic bars)" : "n/a",
    reducedMotion:
      s.morph === "load" ? "skyline at once, no morph" : "no morph: skyline at once when the trigger line is crossed, flat at once above it",
    toggle:
      "Flat and Skyline, rise fill in the quiet tint, " +
      TOGGLE_FILL.durationMs +
      "ms " +
      TOGGLE_FILL.ease +
      ", from the start edge, " +
      TOGGLE_FILL.radiusPx +
      "px radius; the shown view in the accent, the other muted; Enter and Space",
    toggleOverride: s.morph === "load" ? "n/a, the toggle alone decides after the entrance" : TOGGLE_RULE,
    revealStandIn: s.reveal
      ? "on: rise " + REVEAL_BAND.rise + "px and fade, block top " + REVEAL_BAND.start + "% to " + REVEAL_BAND.end + "%, scrub " + REVEAL_BAND.lag + "s, power3.out"
      : "off",
    lightestStepShare: s.share + "%",
    ramp: accentRamp(s.share).join(" | "),
    heightCurve: s.curve,
    colourSteps: s.levels === "sqrt" ? "square root of a busy day's share" : "quarters of a busy day (original)",
    tallestBar: s.heightCap === 1 ? "the busiest day" : Math.round(s.heightCap * 100) + "th percentile day",
    heightScale: s.heightScale,
    morphMs: s.duration,
    card: s.card,
    visitorQuestion: s.question,
    streak: "current streak of contributions only, since its first day; the longest is not shown",
    theme,
  };
};
