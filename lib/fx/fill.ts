// The hover fill's pure half (components/fx/Fill.tsx, globals.css "The fill").
// Aaron's pick (lab log, 2026-10-06): the reference's clock, icon pills fill
// from their icon, links rise from their line, calls to action grow a circle.

export type FillVariant = "circle" | "icon" | "rise";
export type FillColorway = "glass-accent" | "quiet";
export type ArrowDir = "right" | "up-right";
export type Rect = { left: number; top: number; width: number; height: number };
export type Point = { x: number; y: number };
export type FillMarks = { icon: Rect | null; seed: Rect | null; pad: { left: number; right: number } };
export type ControlKey = "menu" | "nav" | "capsule" | "band" | "hero" | "cta" | "connect";
export type ControlFill = { variant: FillVariant; colorway: FillColorway };

export const FILL = { durationMs: 450, ease: "cubic-bezier(0.785, 0.135, 0.15, 0.86)", rectRadiusPx: 10 } as const;

// For a root that sets its own inline transition: append this, or the fill jumps.
export const FILL_TRANSITION = "--fx-p var(--fx-ms) var(--fx-ease)";

export const FILL_PICK: Record<ControlKey, ControlFill> = {
  menu: { variant: "icon", colorway: "glass-accent" },
  capsule: { variant: "icon", colorway: "glass-accent" },
  nav: { variant: "rise", colorway: "quiet" },
  connect: { variant: "rise", colorway: "quiet" },
  band: { variant: "rise", colorway: "glass-accent" },
  hero: { variant: "circle", colorway: "glass-accent" },
  cta: { variant: "circle", colorway: "glass-accent" },
};

// The calls to action: a 44px pill with a hairline ring, the circle seeded in its arrow.
export const CTA_CLASS =
  "inline-flex h-11 items-center gap-3 rounded-full pl-5 pr-1.5 font-label text-label-lg leading-6 text-accent [box-shadow:inset_0_0_0_1px_var(--color-border)]";
export const CTA_OVER_CLASS = "flex items-center gap-3 pl-5 pr-1.5 leading-6";

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

export function farCorner(x: number, y: number, w: number, h: number): number {
  return Math.ceil(Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))) + 1;
}

export function iconOrigin(root: Rect, icon: Rect | null): Point {
  if (!icon) return { x: 0, y: root.height / 2 };
  return { x: icon.left + icon.width / 2 - root.left, y: icon.top + icon.height / 2 - root.top };
}

export function seedInsets(root: Rect, seed: Rect) {
  return {
    top: seed.top - root.top,
    right: root.left + root.width - (seed.left + seed.width),
    bottom: root.top + root.height - (seed.top + seed.height),
    left: seed.left - root.left,
    radius: Math.min(seed.width, seed.height) / 2,
  };
}

// The rise's rest line spans the content: its side insets are the root's padding.
export function fillVars(variant: FillVariant, root: Rect, marks: FillMarks): Record<string, string> {
  if (variant === "icon") {
    const o = iconOrigin(root, marks.icon);
    return { "--fx-ox": px(o.x), "--fx-oy": px(o.y), "--fx-r1": px(farCorner(o.x, o.y, root.width, root.height)) };
  }
  if (variant === "circle" && marks.seed) {
    const s = seedInsets(root, marks.seed);
    return { "--fx-st": px(s.top), "--fx-sr": px(s.right), "--fx-sb": px(s.bottom), "--fx-sl": px(s.left), "--fx-s0": px(s.radius) };
  }
  if (variant === "rise") return { "--fx-line-l": px(marks.pad.left), "--fx-line-r": px(marks.pad.right) };
  return {};
}

export function arrowShift(dir: ArrowDir): { x: string; y: string } {
  return dir === "right" ? { x: "110%", y: "0%" } : { x: "80%", y: "-80%" };
}
