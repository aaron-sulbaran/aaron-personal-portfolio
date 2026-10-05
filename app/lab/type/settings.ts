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

export type ColorRole = "site" | "muted" | "foreground" | "accent";
export const COLOR_ROLES: readonly ColorRole[] = ["site", "muted", "foreground", "accent"];

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
  color: ColorRole;
  roles: readonly Role[];
};

export const SITE_TODAY: Settings = {
  face: "inter",
  weight: 400,
  strongWeight: 500,
  scale: 1,
  tracking: 0,
  leading: null,
  stretch: 100,
  color: "site",
  roles: [],
};

export type Preset = { id: string; name: string; note: string; settings: Settings };

export const PRESETS: readonly Preset[] = [
  {
    id: "profa-text",
    name: "Profa text",
    note: "Recommended. The display family all the way down, Regular throughout: Bold reads as a second headline at 12 to 14px, so medium text stays Regular until a Medium cut lands.",
    settings: {
      face: "profa",
      weight: 400,
      strongWeight: 400,
      scale: 1.06,
      tracking: 0.01,
      leading: null,
      stretch: 100,
      color: "site",
      roles: ["controls", "meta", "kickers", "nav", "pill", "credit"],
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
      color: "site",
      roles: ["meta", "kickers", "credit"],
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
      color: "site",
      roles: ["controls", "meta", "kickers", "nav", "pill", "credit"],
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
      color: "site",
      roles: ["controls", "meta", "kickers", "nav", "pill", "credit"],
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
    stretch: face.stretch ? Math.min(face.stretch.max, Math.max(face.stretch.min, settings.stretch)) : 100,
  };
}

export function labVars(settings: Settings): CSSProperties {
  const face = faceById(settings.face);
  return {
    "--lab-family": familyStack(face),
    "--lab-weight": settings.weight,
    "--lab-weight-strong": settings.strongWeight,
    "--lab-scale": settings.scale,
    "--lab-tracking": `${settings.tracking}em`,
    "--lab-leading": settings.leading ?? "normal",
    "--lab-stretch": face.stretch ? `${settings.stretch}%` : "normal",
    "--lab-features": face.features,
    "--lab-color": settings.color === "site" ? "inherit" : `var(--color-${settings.color})`,
  } as CSSProperties;
}

export function labAttributes(settings: Settings) {
  return {
    "data-roles": settings.roles.join(" "),
    "data-color": settings.color,
    "data-leading": settings.leading === null ? "site" : "set",
  };
}

const BASE_SIZES_PX = [11, 12, 13, 14, 16, 18] as const;

// What the clipboard gets: the settings plus the values a token would hold.
export function exportValues(settings: Settings, label: string) {
  const face = faceById(settings.face);
  const round = (n: number) => Math.round(n * 100) / 100;
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
    color: settings.color === "site" ? "as on the site" : `var(--color-${settings.color})`,
    roles: settings.roles,
  };
}
