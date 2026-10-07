import type { ContributionWindow } from "./data";
import type { FlatDepth } from "./skyline/draw";
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
  morphWaitsForView: boolean; // play only: a crossing the reader cannot watch holds the morph until the chart is in view and the scroll settles
  inViewShare: number; // percent of the chart's height inside the viewport that counts as in view
  settledMs: number; // how long the scroll must stay under settleSpeed to count as settled
  settleSpeed: number; // px per second
  toggleMorphs: boolean; // a click on Flat or Skyline plays the morph from the current clock (off: it snaps)
  flatDepth: FlatDepth;
  cellLift: number; // px: lift's shadow offset, bevel's edge, inset's wall
  edgeAlpha: number; // the hairline round each cell, ink alpha
  innerHighlight: number; // percent of the Coil card's flat 1px highlight (--card-hi), active cells only
  paperTone: number; // percent of ink mixed into the page for an empty day
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

export const SEEN_RULE =
  "A crossing the reader cannot watch (the chart would leave before the morph ends) keeps the block flat; the morph plays the next time the chart is in view and the scroll has settled, or as a slow return arrives at it.";

// The fast-scroll test: from the top to the footer at this speed.
export const FAST_SCROLL_PX_S = 3000;

export const DEPTH_NAMES: Record<FlatDepth, string> = {
  none: "Paper (round 3)",
  lift: "Lift",
  bevel: "Bevel",
  inset: "Inset",
};

export const DEPTH_NOTES: Record<FlatDepth, string> = {
  none: "Round 3: flat on paper, empty days in the hairline colour, a faint outline. The depth sliders do not apply.",
  lift: "Shadow only: each cell casts a hard shadow down and to the right in the page's ink, the Coil's inner highlight on top. Raised, but the shadow has no counterpart in the skyline, so it fades out as the faces arrive.",
  bevel: "Highlight plus shade: the skyline's own side faces at height zero. The bottom edge carries the left face's shade, the right edge the right face's, the top-left the Coil's 1px inner highlight; as the morph starts, those edges become the faces.",
  inset: "Sunk into the paper: the top and left walls in shade, the highlight on the far lip. The light agrees with the skyline, the geometry does not: wells first, then towers.",
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

// The round 4 keys at their round 3 behaviour: no wait, no depth. The toggle
// already ran the engine's clock in round 3, so it morphs here too.
const ROUND3_EXTRAS = {
  morphWaitsForView: false,
  inViewShare: 60,
  settledMs: 120,
  settleSpeed: 300,
  toggleMorphs: true,
  flatDepth: "none",
  cellLift: 1.5,
  edgeAlpha: 0.08,
  innerHighlight: 100,
  paperTone: 3,
} as const satisfies Partial<Settings>;

// Round 4: the morph waits to be seen; the flat view carries the skyline's
// faces at height zero.
const ROUND4_EXTRAS = {
  ...ROUND3_EXTRAS,
  morphWaitsForView: true,
  flatDepth: "bevel",
} as const satisfies Partial<Settings>;

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
  ...ROUND3_EXTRAS,
};

// Aaron's round 3 pick as it shipped: the last 6 months, the full morph once
// the block's top crosses 60 percent, the reveal stand-in on.
const ROUND3_PICK: Settings = { ...AARON_PASTED, window: "6mo", morph: "play", triggerPct: 60, reveal: true };

export const PRESETS: readonly Preset[] = [
  {
    id: "aaron-6mo",
    name: "Aaron's pick, 6 months, scroll morph",
    note: "Round 4: flat until the block's top crosses 60 percent of the viewport, then the full 1300ms morph, but only once it can be watched: a fast pass keeps it flat, and it plays when the chart is 60 percent in view and the scroll has settled (under 300 px/s for 120ms). The flat view is the bevel: the skyline's faces at height zero. A click on Flat or Skyline plays the same morph from wherever the clock is.",
    settings: { ...ROUND3_PICK, ...ROUND4_EXTRAS },
  },
  {
    id: "aaron-r3",
    name: "Aaron's pick, round 3",
    note: "Round 3 as it was, for comparison: the morph plays at the crossing however fast the page is moving, and the flat view is plain paper.",
    settings: ROUND3_PICK,
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
      ...ROUND3_EXTRAS,
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
      ...ROUND3_EXTRAS,
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
      ...ROUND3_EXTRAS,
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
    morphWaitsForView:
      s.morph !== "play"
        ? "n/a, play mode only"
        : s.morphWaitsForView
          ? "on: " + SEEN_RULE
          : "off: the morph plays at the crossing however fast the page moves",
    inViewShare: s.morph === "play" && s.morphWaitsForView ? s.inViewShare + "% of the chart's height inside the viewport" : "n/a",
    settledMs:
      s.morph === "play" && s.morphWaitsForView
        ? s.settledMs + "ms under " + s.settleSpeed + " px/s (or slow enough that the chart stays in view for the whole morph)"
        : "n/a",
    settleSpeed: s.morph === "play" && s.morphWaitsForView ? s.settleSpeed + " px/s" : "n/a",
    toggleMorphs: s.toggleMorphs
      ? "on: a click or Enter/Space plays the " + s.duration + "ms morph from the current clock, either way; a click mid-morph reverses from where it is"
      : "off: a click snaps to the other view",
    flatDepth: DEPTH_NAMES[s.flatDepth],
    cellLift: s.flatDepth === "none" ? "n/a" : s.cellLift + "px" + (s.flatDepth === "lift" ? " shadow offset" : s.flatDepth === "bevel" ? " edge" : " wall") + ", half on empty days",
    edgeAlpha: s.flatDepth === "none" ? "n/a (round 3 outline 0.07)" : s.edgeAlpha,
    innerHighlight: s.flatDepth === "none" ? "n/a" : s.innerHighlight + "% of --card-hi, 1px, active days only",
    paperTone: s.flatDepth === "none" ? "n/a, empty days in --color-border" : s.paperTone + "% ink in the page",
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
