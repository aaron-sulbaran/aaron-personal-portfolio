import type { CSSProperties } from "react";
import { faceById, familyStack, nearestWeight } from "./faces";

// What the panel tunes and how it lands on the specimens: the settings shape,
// the presets, and the CSS variables and root attributes lab.css reads.

export const ROLES = ["controls", "meta", "kickers", "nav", "pill", "credit"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  controls: "Controls and links",
  meta: "Meta and role lines",
  kickers: "Kickers and labels",
  nav: "Nav",
  pill: "Pill text",
  credit: "Credit and footer",
};

// Interactive text (controls, links, nav, pill) and everything else (meta,
// kickers, credit) take their colors separately.
export const INTERACTIVE_ROLES: readonly Role[] = ["controls", "nav", "pill"];
export const STATIC_ROLES: readonly Role[] = ["meta", "kickers", "credit"];

export type ColorRole = "site" | "muted" | "foreground" | "accent" | "accent-soft";
export const COLOR_ROLES: readonly ColorRole[] = ["site", "muted", "foreground", "accent", "accent-soft"];

// Finer than interactive and non-interactive: a tone marks what kind of
// small text an element is, and a tone's color, when set, wins over its
// role's. "same" leaves the role's color in charge.
export const TONES = ["besideTitle", "hint", "kicker", "secondary"] as const;
export type Tone = (typeof TONES)[number];
export type ToneColor = ColorRole | "same";
export const TONE_COLORS: readonly ToneColor[] = ["same", "muted", "accent", "accent-soft", "foreground"];
export const TONE_LABELS: Record<Tone, string> = {
  besideTitle: "Meta beside a title (role lines, book meta)",
  hint: "Free-standing hints and credit (Esc hints, credit prose, pill tip)",
  kicker: "Kickers (About, Who I am)",
  secondary: "Secondary pill text (artist, Paused, Music?)",
};

// Three size steps, before the scale: what each base size collapses to.
export const STEP_PX = { sm: 12, md: 14, lg: 18 } as const;
export type Step = keyof typeof STEP_PX;
export const stepFor = (px: number): Step => (px <= 12 ? "sm" : px >= 17 ? "lg" : "md");

export type Placement = "above" | "below";
// The role line beside a title: where it sits, its gap to the title and its
// size in px before the scale.
export type RoleLine = { placement: Placement; gap: number; size: number };
export type RoleLineSpot = "case" | "modal";

export type Settings = {
  face: string;
  // Text that is regular on the site, and text that is medium on it (nav,
  // the Menu pill, the playback pill, the modal's call to action).
  weight: number;
  strongWeight: number;
  scale: number;
  tracking: number; // em
  leading: number | null; // null keeps each fragment's own line height
  stretch: number; // percent; only faces with a width axis use it
  interactiveColor: ColorRole;
  staticColor: ColorRole;
  roles: readonly Role[];
  // Icon and label pairs: the back link's arrow as the text glyph or a
  // drawn icon, the arrows' size and stroke, and every pair's vertical
  // offset and gap (null keeps each pair's own gap).
  arrow: "glyph" | "icon";
  iconSize: number;
  iconStroke: number;
  iconOffset: number;
  iconGap: number | null;
  // The band's "Play it" and "Not now" row.
  // "site" is the markup as built: the music states' layers share one grid
  // cell unaligned, so Pause and Resume sit off the heading's baseline;
  // "baseline" aligns every layer to it.
  controlAlign: "site" | "baseline" | "center";
  secondaryNudge: number; // px, negative raises "Not now"
  controlGap: number;
  headingGap: number; // px from the question to its controls
  // Optional: "Not now" in the muted token, a step quieter than "Play it".
  quietSecondary: boolean;
  roleLineCase: RoleLine;
  roleLineModal: RoleLine;
  subtitleWeight: number; // the role line's weight once it sits below
  toneColors: Record<Tone, ToneColor>;
  // A seen book row dims its meta with its title (back on hover and focus),
  // to this opacity; null leaves the meta at full ink as the site does.
  seenMetaDim: number | null;
  // Every label size collapses onto STEP_PX (times the scale).
  threeSteps: boolean;
  // Book meta beside its title: "site" keeps the site's grid (meta never
  // wraps, the title gives way); "fit" puts a row's meta under its title
  // only when the two do not fit side by side; a number does it for a whole
  // column narrower than that many px.
  metaWrap: "site" | "fit" | number;
};

// The role line as the site has it (an eyebrow above), and as I would ship
// it below the title (a subtitle: larger, its own gap).
export const ROLE_LINE_SITE: Record<RoleLineSpot, RoleLine> = {
  case: { placement: "above", gap: 8, size: 14 },
  modal: { placement: "above", gap: 4, size: 14 },
};
export const ROLE_LINE_BELOW: Record<RoleLineSpot, RoleLine> = {
  case: { placement: "below", gap: 14, size: 18 },
  modal: { placement: "below", gap: 4, size: 15 },
};

const SITE_LAYOUT = {
  arrow: "glyph",
  iconSize: 16,
  iconStroke: 2,
  iconOffset: 0,
  iconGap: null,
  controlAlign: "site",
  secondaryNudge: 0,
  controlGap: 24,
  headingGap: 28,
  quietSecondary: false,
  roleLineCase: ROLE_LINE_SITE.case,
  roleLineModal: ROLE_LINE_SITE.modal,
  subtitleWeight: 400,
  toneColors: { besideTitle: "same", hint: "same", kicker: "same", secondary: "same" },
  seenMetaDim: null,
  threeSteps: false,
  metaWrap: "site",
} satisfies Partial<Settings>;

// Profa sits about 0.07em higher in its line box than Inter (its ascent is
// 0.818em against a 0.636em cap height), so an icon centred on the line box
// reads low beside it by about a pixel at label sizes; the arrow is drawn,
// since no loaded face has U+2190 (Inter's latin subset skips it, so the
// glyph comes from the system font, thin and platform dependent). At 14px
// its head matches Profa's cap height at label size, and -1px puts the shaft
// on the hyphen's axis.
const PROFA_LAYOUT = {
  ...SITE_LAYOUT,
  arrow: "icon",
  iconSize: 14,
  iconOffset: -1,
  controlAlign: "baseline",
} satisfies Partial<Settings>;

const ALL_ROLES: readonly Role[] = ROLES;

export const SITE_TODAY: Settings = {
  face: "inter",
  weight: 400,
  strongWeight: 500,
  scale: 1,
  tracking: 0,
  leading: null,
  stretch: 100,
  interactiveColor: "site",
  staticColor: "site",
  roles: [],
  ...SITE_LAYOUT,
};

export type Preset = { id: string; name: string; note: string; settings: Settings };

const AARON_FINAL: Settings = {
  face: "profa",
  weight: 700,
  strongWeight: 700,
  scale: 1.06,
  tracking: 0.01,
  leading: null,
  stretch: 100,
  interactiveColor: "accent",
  staticColor: "accent",
  roles: ALL_ROLES,
  ...PROFA_LAYOUT,
  iconStroke: 2.5,
  controlGap: 16,
  headingGap: 36,
  roleLineCase: { placement: "above", gap: 8, size: 14 },
  roleLineModal: { placement: "below", gap: 3, size: 15 },
  subtitleWeight: 700,
};

// The design review's changes on top of Aaron's final, each one a setting:
// color tells clickable from not again (hints, credit, kickers and the
// pill's secondary text go muted, "Not now" too), the role line sits below
// the title in both places, a seen row dims its meta, three size steps, and
// book meta wraps under a cramped title.
const AARON_REVIEWED: Settings = {
  ...AARON_FINAL,
  toneColors: { besideTitle: "same", hint: "muted", kicker: "muted", secondary: "muted" },
  quietSecondary: true,
  roleLineCase: { placement: "below", gap: 14, size: 18 },
  roleLineModal: { placement: "below", gap: 6, size: 15 },
  seenMetaDim: 0.75,
  threeSteps: true,
  metaWrap: "fit",
};

export const PRESETS: readonly Preset[] = [
  {
    id: "aaron-final",
    name: "Aaron's final",
    note: "Aaron's pick as decided: role line above on the case page, below in the modal. The band's question stands apart from its two answers (36px), and the answers pair up (16px).",
    settings: AARON_FINAL,
  },
  {
    id: "aaron-reviewed",
    name: "Aaron's final, reviewed",
    note: "His final plus the review: muted hints, credit, kickers and secondary pill text; quieter Not now; role line below in both; seen meta dims; three size steps; book meta wraps in a narrow column.",
    settings: AARON_REVIEWED,
  },
  {
    id: "aaron-pick",
    name: "Aaron's pick",
    note: "Profa Bold in the accent for every role, with the drawn arrow and icons lifted to Profa's centre.",
    settings: {
      face: "profa",
      weight: 700,
      strongWeight: 700,
      scale: 1.06,
      tracking: 0.01,
      leading: null,
      stretch: 100,
      interactiveColor: "accent",
      staticColor: "accent",
      roles: ALL_ROLES,
      ...PROFA_LAYOUT,
      iconStroke: 2.5,
      subtitleWeight: 700,
    },
  },
  {
    id: "profa-text",
    name: "Profa text",
    note: "The display family all the way down, Regular throughout: Bold reads as a second headline at 12 to 14px, so medium text stays Regular until a Medium cut lands.",
    settings: {
      face: "profa",
      weight: 400,
      strongWeight: 400,
      scale: 1.06,
      tracking: 0.01,
      leading: null,
      stretch: 100,
      interactiveColor: "site",
      staticColor: "site",
      roles: ALL_ROLES,
      ...PROFA_LAYOUT,
      iconStroke: 1.75,
    },
  },
  {
    id: "dm-mono-meta",
    name: "Mono annotations",
    note: "DM Mono on the quiet layer only (meta, kickers, credit); controls and nav stay Inter.",
    settings: {
      face: "dm-mono",
      weight: 400,
      strongWeight: 500,
      scale: 0.93,
      tracking: 0,
      leading: null,
      stretch: 100,
      interactiveColor: "site",
      staticColor: "site",
      roles: ["meta", "kickers", "credit"],
      ...SITE_LAYOUT,
    },
  },
  {
    id: "mona-wide",
    name: "Mona Sans, wide",
    note: "A grotesk pushed to 112 percent width so labels carry Profa's stance at text size.",
    settings: {
      face: "mona-sans",
      weight: 400,
      strongWeight: 600,
      scale: 0.98,
      tracking: 0.005,
      leading: null,
      stretch: 112,
      interactiveColor: "site",
      staticColor: "site",
      roles: ALL_ROLES,
      ...SITE_LAYOUT,
    },
  },
  {
    id: "bricolage",
    name: "Bricolage",
    note: "The characterful sans: optical sizing does the work at 12 to 14px.",
    settings: {
      face: "bricolage",
      weight: 400,
      strongWeight: 600,
      scale: 1.02,
      tracking: 0,
      leading: null,
      stretch: 100,
      interactiveColor: "site",
      staticColor: "site",
      roles: ALL_ROLES,
      ...SITE_LAYOUT,
    },
  },
];

// A face switch keeps the chosen weights where the new face has them and
// snaps to the nearest cut it does have.
export function withFace(settings: Settings, faceId: string): Settings {
  const face = faceById(faceId);
  return {
    ...settings,
    face: face.id,
    weight: nearestWeight(face, settings.weight),
    strongWeight: nearestWeight(face, settings.strongWeight),
    subtitleWeight: nearestWeight(face, settings.subtitleWeight),
    stretch: face.stretch ? Math.min(face.stretch.max, Math.max(face.stretch.min, settings.stretch)) : 100,
  };
}

// Moving a role line takes the spacing and size that placement wants.
export function withPlacement(spot: RoleLineSpot, placement: Placement): RoleLine {
  return placement === "below" ? ROLE_LINE_BELOW[spot] : ROLE_LINE_SITE[spot];
}

const colorValue = (color: ColorRole) =>
  color === "site" ? "inherit" : color === "accent-soft" ? "var(--lab-accent-soft)" : `var(--color-${color})`;

export function labVars(settings: Settings): CSSProperties {
  const face = faceById(settings.face);
  return {
    "--lab-family": familyStack(face),
    "--lab-weight": settings.weight,
    "--lab-weight-strong": settings.strongWeight,
    "--lab-weight-subtitle": settings.subtitleWeight,
    "--lab-scale": settings.scale,
    "--lab-tracking": `${settings.tracking}em`,
    "--lab-leading": settings.leading ?? "normal",
    "--lab-stretch": face.stretch ? `${settings.stretch}%` : "normal",
    "--lab-features": face.features,
    "--lab-color-interactive": colorValue(settings.interactiveColor),
    "--lab-color-static": colorValue(settings.staticColor),
    "--lab-icon-size": `${settings.iconSize}px`,
    "--lab-icon-stroke": settings.iconStroke,
    "--lab-icon-offset": `${settings.iconOffset}px`,
    ...(settings.iconGap === null ? {} : { "--lab-icon-gap": `${settings.iconGap}px` }),
    "--lab-control-gap": `${settings.controlGap}px`,
    "--lab-heading-gap": `${settings.headingGap}px`,
    "--lab-seen-meta-opacity": settings.seenMetaDim ?? 1,
    ...Object.fromEntries(
      TONES.filter((tone) => settings.toneColors[tone] !== "same").map((tone) => [
        `--lab-tone-${tone}`,
        colorValue(settings.toneColors[tone] as ColorRole),
      ]),
    ),
    "--lab-secondary-nudge": `${settings.secondaryNudge}px`,
  } as CSSProperties;
}

export function labAttributes(settings: Settings) {
  return {
    "data-roles": settings.roles.join(" "),
    "data-color-interactive": settings.interactiveColor,
    "data-color-static": settings.staticColor,
    "data-leading": settings.leading === null ? "site" : "set",
    "data-quiet-secondary": settings.quietSecondary ? "on" : "off",
    "data-tones": TONES.filter((tone) => settings.toneColors[tone] !== "same").join(" "),
    "data-seen-meta": settings.seenMetaDim === null ? "site" : "dim",
    "data-three-steps": settings.threeSteps ? "on" : "off",
  };
}

const BASE_SIZES_PX = [11, 12, 13, 14, 16, 18] as const;

const colorExport = (color: ColorRole) =>
  color === "site"
    ? "as on the site"
    : color === "accent-soft"
      ? "color-mix(in srgb, var(--color-accent) 72%, var(--color-background)) (80% in dark)"
      : `var(--color-${color})`;

// What the clipboard gets: the settings plus the values a token would hold.
// The round 1 fields keep their names and shapes; `color` is the shared value
// when both colors agree, and "split" when they do not.
export function exportValues(settings: Settings, label: string) {
  const face = faceById(settings.face);
  const round = (n: number) => Math.round(n * 100) / 100;
  const roleLine = (line: RoleLine) => ({
    placement: line.placement,
    gapPx: line.gap,
    sizePx: line.size,
    sizePxScaled: round((settings.threeSteps ? STEP_PX[stepFor(line.size)] : line.size) * settings.scale),
    fontWeight: line.placement === "below" ? settings.subtitleWeight : settings.weight,
  });
  return {
    label,
    face: face.name,
    fontFamily: familyStack(face),
    fontWeight: { regular: settings.weight, medium: settings.strongWeight },
    sizeScale: settings.scale,
    sizesPx: Object.fromEntries(BASE_SIZES_PX.map((px) => [`${px}px`, round(px * settings.scale)])),
    letterSpacing: `${settings.tracking}em`,
    lineHeight: settings.leading ?? "as on the site",
    fontStretch: face.stretch ? `${settings.stretch}%` : null,
    fontFeatureSettings: face.features,
    color: settings.interactiveColor === settings.staticColor ? colorExport(settings.interactiveColor) : "split",
    roles: settings.roles,
    colorInteractive: colorExport(settings.interactiveColor),
    colorNonInteractive: colorExport(settings.staticColor),
    icons: {
      backArrow: settings.arrow,
      backArrowSizePx: settings.iconSize,
      arrowStroke: settings.iconStroke,
      verticalOffsetPx: settings.iconOffset,
      gapPx: settings.iconGap ?? "as on the site",
    },
    controlRow: {
      align: settings.controlAlign,
      secondaryNudgePx: settings.secondaryNudge,
      gapPx: settings.controlGap,
      headingGapPx: settings.headingGap,
      quietSecondary: settings.quietSecondary,
    },
    roleLine: { casePage: roleLine(settings.roleLineCase), modal: roleLine(settings.roleLineModal) },
    toneColors: Object.fromEntries(
      TONES.map((tone) => [tone, settings.toneColors[tone] === "same" ? "same as its role" : colorExport(settings.toneColors[tone] as ColorRole)]),
    ),
    seenRowMetaOpacity: settings.seenMetaDim ?? "as on the site (full)",
    sizeSteps: settings.threeSteps
      ? Object.fromEntries(Object.entries(STEP_PX).map(([step, px]) => [step, round(px * settings.scale)]))
      : "as each element's own size",
    bookMetaWrap:
      settings.metaWrap === "site"
        ? "as on the site"
        : settings.metaWrap === "fit"
          ? "per row, under the title when the two do not fit side by side"
          : `whole column, under the title below ${settings.metaWrap}px`,
  };
}
