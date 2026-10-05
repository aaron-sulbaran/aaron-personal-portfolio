import type { CSSProperties } from "react";

// What the panel tunes, the presets, and what "Copy values" puts on the
// clipboard. Every value here is a real CSS value or a name the export maps
// to one, so the JSON reads as a spec for the rollout.

export type Variant = "circle" | "icon" | "wipe" | "rise" | "pointer";
export type Colorway = "glass-accent" | "accent-paper" | "quiet" | "ink";
export type Origin = "start" | "end" | "top" | "bottom" | "center";
export type EaseKey = "reference" | "site" | "expo" | "quart" | "standard";
export type ControlKey = "menu" | "nav" | "capsule" | "band" | "hero" | "cta" | "connect";
export type HeroSurface = "pill" | "solid" | "bare";
export type NoteAnim = "arcs" | "levels" | "move" | "none";
export type Face = "profa" | "inter";

export const VARIANT_LABELS: Record<Variant, string> = {
  circle: "Reference: the circle expands",
  icon: "Grows from the icon",
  wipe: "Directional wipe",
  rise: "The underline rises",
  pointer: "From the pointer",
};

export const VARIANT_SHORT: Record<Variant, string> = {
  circle: "circle",
  icon: "icon",
  wipe: "wipe",
  rise: "rise",
  pointer: "pointer",
};

export const COLORWAY_LABELS: Record<Colorway, string> = {
  "glass-accent": "Glass fills to accent",
  "accent-paper": "Accent fills to paper",
  quiet: "Quiet tint",
  ink: "Ink",
};

export const EASES: Record<EaseKey, { name: string; css: string }> = {
  reference: { name: "Reference (in-out circ)", css: "cubic-bezier(0.785, 0.135, 0.15, 0.86)" },
  site: { name: "Site ease (out)", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
  expo: { name: "In-out expo", css: "cubic-bezier(0.87, 0, 0.13, 1)" },
  quart: { name: "Out quart", css: "cubic-bezier(0.25, 1, 0.5, 1)" },
  standard: { name: "Standard", css: "cubic-bezier(0.4, 0, 0.2, 1)" },
};

export const CONTROL_LABELS: Record<ControlKey, string> = {
  menu: "Menu pill and chips",
  nav: "Nav links",
  capsule: "Playback capsule",
  band: "Band controls",
  hero: "Work and photos",
  cta: "Work modal call to action",
  connect: "Connect link",
};

// Which fills make sense on which control: icon fills need an icon, the rise
// needs a line to rise from, the circle needs room for its seed.
export const ALLOWED: Record<ControlKey, readonly Variant[]> = {
  menu: ["icon", "circle", "wipe", "pointer"],
  nav: ["rise", "wipe", "pointer"],
  capsule: ["icon", "circle", "wipe", "pointer"],
  band: ["rise", "wipe", "pointer"],
  hero: ["circle", "wipe", "rise", "pointer"],
  cta: ["circle", "wipe", "pointer"],
  connect: ["rise", "circle", "wipe", "pointer"],
};

export type ControlFill = { variant: Variant; colorway: Colorway };

export type Settings = {
  face: Face;
  durationMs: number;
  ease: EaseKey;
  origin: Origin;
  radiusPx: number;
  arrowSwap: boolean;
  controls: Record<ControlKey, ControlFill>;
  toggleLagPct: number; // the trailing edge's delay, as a share of the duration
  heroSurface: HeroSurface;
  toggleGlyphs: boolean;
  note: string;
  noteAnim: NoteAnim;
  noteSpeed: number;
};

export type Preset = { id: string; name: string; note: string; settings: Settings };

const RECOMMENDED: Settings = {
  face: "profa",
  durationMs: 450,
  ease: "reference",
  origin: "start",
  radiusPx: 10,
  arrowSwap: true,
  controls: {
    menu: { variant: "icon", colorway: "glass-accent" },
    nav: { variant: "rise", colorway: "glass-accent" },
    capsule: { variant: "icon", colorway: "glass-accent" },
    band: { variant: "rise", colorway: "glass-accent" },
    hero: { variant: "circle", colorway: "glass-accent" },
    cta: { variant: "circle", colorway: "glass-accent" },
    connect: { variant: "rise", colorway: "quiet" },
  },
  toggleLagPct: 22,
  heroSurface: "pill",
  toggleGlyphs: false,
  note: "solid-eighth",
  noteAnim: "arcs",
  noteSpeed: 1,
};

export const PRESETS: readonly Preset[] = [
  {
    id: "house",
    name: "House fill",
    note: "Recommended. The reference's clock (450ms, in-out circ) everywhere; each control fills from the thing it already has: icon pills from their icon, text links from their own underline, the two calls to action from the reference's circle. Connect stays quiet so the page's last word is the address, not the effect.",
    settings: RECOMMENDED,
  },
  {
    id: "reference",
    name: "Pure reference",
    note: "The 21st.dev button as written: the circle with the arrow expands on every control that can hold one, the wipe from the start elsewhere.",
    settings: {
      ...RECOMMENDED,
      controls: {
        menu: { variant: "circle", colorway: "glass-accent" },
        nav: { variant: "wipe", colorway: "glass-accent" },
        capsule: { variant: "circle", colorway: "glass-accent" },
        band: { variant: "wipe", colorway: "glass-accent" },
        hero: { variant: "circle", colorway: "glass-accent" },
        cta: { variant: "circle", colorway: "glass-accent" },
        connect: { variant: "circle", colorway: "glass-accent" },
      },
      note: "line-eighth",
      noteAnim: "arcs",
    },
  },
  {
    id: "quiet",
    name: "Quiet ink",
    note: "Less color: a tint for the chrome, ink for the calls to action, on the site's own ease, faster. For when the hero's field is already doing the talking.",
    settings: {
      ...RECOMMENDED,
      durationMs: 360,
      ease: "site",
      controls: {
        menu: { variant: "icon", colorway: "quiet" },
        nav: { variant: "rise", colorway: "quiet" },
        capsule: { variant: "icon", colorway: "quiet" },
        band: { variant: "rise", colorway: "quiet" },
        hero: { variant: "wipe", colorway: "quiet" },
        cta: { variant: "circle", colorway: "ink" },
        connect: { variant: "rise", colorway: "quiet" },
      },
      toggleLagPct: 12,
      note: "solid-quarter",
      noteAnim: "levels",
    },
  },
  {
    id: "playful",
    name: "Follows the hand",
    note: "Everything fills from where the pointer enters (keyboard focus fills from the centre), on in-out expo. The most motion; try it on a real trackpad before judging.",
    settings: {
      ...RECOMMENDED,
      durationMs: 560,
      ease: "expo",
      controls: {
        menu: { variant: "pointer", colorway: "glass-accent" },
        nav: { variant: "pointer", colorway: "glass-accent" },
        capsule: { variant: "pointer", colorway: "glass-accent" },
        band: { variant: "pointer", colorway: "glass-accent" },
        hero: { variant: "pointer", colorway: "glass-accent" },
        cta: { variant: "pointer", colorway: "glass-accent" },
        connect: { variant: "pointer", colorway: "quiet" },
      },
      toggleLagPct: 34,
      note: "mark-note",
      noteAnim: "move",
    },
  },
];

export const INITIAL = PRESETS[0].settings;

export function sameSettings(a: Settings, b: Settings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The label style Aaron chose in the type lab, and today's Inter to flip to.
export const LABEL = {
  profa: { family: "var(--lab-profa), var(--font-sans), system-ui, sans-serif", weight: 700, scale: 1.06, tracking: "0.01em" },
  inter: { family: "var(--font-sans), system-ui, sans-serif", weight: 500, scale: 1, tracking: "0em" },
} as const;

export function labVars(s: Settings, scrub: number | null): CSSProperties {
  const face = LABEL[s.face];
  return {
    "--fx-ms": `${s.durationMs}ms`,
    "--fx-ease": EASES[s.ease].css,
    "--fx-rect-radius": `${s.radiusPx}px`,
    "--fx-scrub": scrub ?? 0,
    "--tg-lag": `${Math.round((s.durationMs * s.toggleLagPct) / 100)}ms`,
    "--note-speed": s.noteSpeed,
    "--lab-family": face.family,
    "--lab-weight": face.weight,
    "--lab-scale": face.scale,
    "--lab-tracking": face.tracking,
  } as CSSProperties;
}

export function exportValues(s: Settings, label: string, theme: string, noteName: string) {
  const face = LABEL[s.face];
  const flat: Record<string, string | number | boolean> = {
    label,
    theme,
    labelFace: s.face === "profa" ? "Profa 700" : "Inter 500 (today)",
    labelFontFamily: face.family,
    labelFontWeight: face.weight,
    labelSizeScale: face.scale,
    labelLetterSpacing: face.tracking,
    labelColor: "var(--color-accent)",
    fillDuration: `${s.durationMs}ms`,
    fillEasing: EASES[s.ease].css,
    fillEasingName: EASES[s.ease].name,
    fillOrigin: s.origin,
    fillCornerRadius: `${s.radiusPx}px`,
    arrowSwap: s.arrowSwap,
    reducedMotion: "instant color change, no transition",
  };
  (Object.keys(s.controls) as ControlKey[]).forEach((key) => {
    flat[`${key}Fill`] = VARIANT_SHORT[s.controls[key].variant];
    flat[`${key}Colorway`] = COLORWAY_LABELS[s.controls[key].colorway];
  });
  flat.heroSurface = s.heroSurface === "pill" ? "Menu pill glass, 8px blur" : s.heroSurface === "solid" ? "paper, no blur" : "bare text";
  flat.toggleTrailingDelay = `${Math.round((s.durationMs * s.toggleLagPct) / 100)}ms`;
  flat.toggleGlyphs = s.toggleGlyphs;
  flat.note = noteName;
  flat.noteAnimation = s.noteAnim;
  flat.noteTransition = `${Math.round(200 / s.noteSpeed)}ms`;
  flat.noteSpeed = s.noteSpeed;
  return flat;
}
