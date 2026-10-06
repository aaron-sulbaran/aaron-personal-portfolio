import type { ContributionWindow } from "./data";
import { accentRamp, type HeightCurve } from "./skyline/maths";

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
    note: "Inside Up to now, flat first with Skyline one click away, three real figures plus two placeholders above it, square-root heights so the small days still read.",
    settings: {
      placement: "inside",
      companions: "numbers",
      window: "12mo",
      lead: "streak",
      data: "real",
      future: "omit",
      view: "2d",
      share: 32,
      curve: "sqrt",
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
      curve: "sqrt",
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
    afterToday: s.window === "12mo" ? "n/a, the rolling year ends today" : s.future === "omit" ? "grid stops at today" : "empty slabs to December 31",
    defaultView: s.view === "3d" ? "skyline (3D)" : "flat (2D)",
    lightestStepShare: s.share + "%",
    ramp: accentRamp(s.share).join(" | "),
    heightCurve: s.curve,
    heightScale: s.heightScale,
    morphMs: s.duration,
    card: s.card,
    visitorQuestion: s.question,
    theme,
  };
};
