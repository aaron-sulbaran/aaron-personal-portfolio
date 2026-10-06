import type { ContributionWindow } from "./data";
import { accentRamp, type HeightCurve, type LevelCurve } from "./skyline/maths";

// Everything the panel can set, the three presets (the recommendation first),
// and the flat export the copy button writes.

export type Placement = "section" | "inside" | "strip" | "divider";
export type Companions = "stats" | "numbers" | "alone";
export type DataSource = "real" | "sample";
// After today: stop the grid at today, or run it to December 31 with empty slabs.
export type Future = "omit" | "slabs";
// Which real figure opens the numbers row.
export type Lead = "streak" | "total" | "days";

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
};

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

export const PRESETS: readonly Preset[] = [
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
    defaultView: s.view === "3d" ? "skyline (3D)" : "flat (2D)",
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
