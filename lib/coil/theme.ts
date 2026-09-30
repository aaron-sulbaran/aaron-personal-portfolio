import { ColorManagement, type Color } from "three";
import { FIELD } from "./field.glsl";

// Tokens to uniforms and paints. The scene reads the Coil tokens in
// app/globals.css through getComputedStyle, once per theme, and never through
// var() or color-mix(). A production build minifies the tokens (lowercase hex,
// 8-digit hex for rgba, ".3" for 0.3); the dev server hands them back as
// authored (rgba(...)). The reader takes all of those. Colors land in
// uniforms as raw 0..1 channels with color management off, so a hex token maps
// 1:1 to the pixel (linear output, no sRGB round trip).

export type Rgba = { readonly r: number; readonly g: number; readonly b: number; readonly a: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// "#rgb", "#rrggbb", "#rrggbbaa", "rgb(...)" or "rgba(...)", else null.
export function parseColor(raw: string): Rgba | null {
  const value = raw.trim().toLowerCase();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    if (hex.length === 3) {
      const [r, g, b] = hex.split("").map((h) => parseInt(h + h, 16) / 255);
      return { r, g, b, a: 1 };
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
    return { r: channel(0), g: channel(2), b: channel(4), a: hex.length === 8 ? channel(6) : 1 };
  }
  const fn = value.match(/^rgba?\(([^)]*)\)$/);
  if (!fn) return null;
  const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = (part: string) => (part.endsWith("%") ? parseFloat(part) / 100 : parseFloat(part) / 255);
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  const [r, g, b] = parts.slice(0, 3).map(channel);
  if ([r, g, b, alpha].some((x) => !Number.isFinite(x))) return null;
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(alpha) };
}

export function parseScalar(raw: string, fallback: number): number {
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

// A canvas fill: rgba() with byte channels, never var() or color-mix().
export function toCanvasColor(c: Rgba): string {
  const byte = (x: number) => Math.round(clamp01(x) * 255);
  return `rgba(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)}, ${+c.a.toFixed(4)})`;
}

export function toBytes(c: Rgba): [number, number, number] {
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

export type CoilTheme = {
  readonly dark: boolean;
  readonly paper: Rgba;
  readonly ink: Rgba;
  readonly field: {
    readonly top: Rgba;
    readonly bottom: Rgba;
    readonly glow: Rgba;
    readonly second: Rgba;
    readonly secondStrength: number;
  };
  readonly card: {
    readonly pane: Rgba;
    readonly workPane: Rgba;
    readonly hair: Rgba;
    readonly hi: Rgba;
    readonly duoDark: Rgba;
    readonly duoLight: Rgba;
    readonly workBack: Rgba; // plain work backs: duo light in light, its own pane in dark
    readonly recede: number;
    readonly sheen: number;
  };
  readonly name: { readonly ink: number; readonly top: Rgba; readonly bottom: Rgba };
};

type TokenReader = (name: string) => string;

// Pure over a token reader, so it is tested without a DOM. A missing or
// unreadable token falls back to paper (colors) or the light default
// (scalars), never throws: a half-styled frame beats a dead scene.
export function themeFromTokens(read: TokenReader, dark: boolean): CoilTheme {
  const paper = parseColor(read("--color-background")) ?? { r: 0.98, g: 0.98, b: 0.97, a: 1 };
  const color = (name: string, fallback: Rgba = paper) => parseColor(read(name)) ?? fallback;
  const duoLight = color("--card-duo-light");
  return {
    dark,
    paper,
    ink: color("--color-foreground", { r: 0.04, g: 0.04, b: 0.04, a: 1 }),
    field: {
      top: color("--shader-top"),
      bottom: color("--shader-bottom"),
      glow: color("--shader-glow"),
      second: color("--shader-second"),
      secondStrength: dark ? FIELD.second.dark : FIELD.second.light,
    },
    card: {
      pane: color("--card-pane"),
      workPane: color("--card-work-pane"),
      hair: color("--card-hair"),
      hi: color("--card-hi"),
      duoDark: color("--card-duo-dark"),
      duoLight,
      workBack: dark ? color("--card-work-back-dark", duoLight) : duoLight,
      recede: parseScalar(read("--card-recede"), 0.3),
      sheen: parseScalar(read("--card-sheen"), 0.1),
    },
    name: {
      ink: parseScalar(read("--name-ink"), 0.12),
      top: color("--name-grad-top"),
      bottom: color("--name-grad-bottom"),
    },
  };
}

export function isDarkTheme(root: HTMLElement = document.documentElement) {
  return root.getAttribute("data-theme") === "dark";
}

export function readCoilTheme(root: HTMLElement = document.documentElement): CoilTheme {
  const style = getComputedStyle(root);
  return themeFromTokens((name) => style.getPropertyValue(name), isDarkTheme(root));
}

// Hex in, hex out: tokens map 1:1 to pixels. Called once, before any Color.
export function disableColorManagement() {
  ColorManagement.enabled = false;
}

export function applyColor(target: Color, c: Rgba) {
  target.setRGB(c.r, c.g, c.b);
}

// Re-reads the tokens whenever the theme flips (the data-theme attribute on
// <html>). Returns the cleanup.
export function watchTheme(onChange: (theme: CoilTheme) => void, root: HTMLElement = document.documentElement) {
  let last = root.getAttribute("data-theme");
  const observer = new MutationObserver(() => {
    const next = root.getAttribute("data-theme");
    if (next === last) return;
    last = next;
    onChange(readCoilTheme(root));
  });
  observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

// A theme change repaints every card, but never all in one frame: at most
// `perFrame` items per drain, and no new item once `budgetMs` has been spent
// (the first always paints), so a toggle never stalls the loop. Re-enqueuing
// an item already waiting keeps one entry (the latest theme wins at paint time).
export type RepaintQueue<T> = {
  enqueue: (items: readonly T[]) => void;
  drain: (paint: (item: T) => void, budgetMs?: number, now?: () => number) => number;
  readonly size: number;
  clear: () => void;
};

export function createRepaintQueue<T>(perFrame = 4): RepaintQueue<T> {
  const waiting: T[] = [];
  return {
    enqueue(items) {
      items.forEach((item) => {
        if (!waiting.includes(item)) waiting.push(item);
      });
    },
    drain(paint, budgetMs = Infinity, now = () => performance.now()) {
      const start = now();
      let painted = 0;
      while (waiting.length > 0 && painted < perFrame && (painted === 0 || now() - start < budgetMs)) {
        paint(waiting.shift() as T);
        painted += 1;
      }
      return painted;
    },
    get size() {
      return waiting.length;
    },
    clear() {
      waiting.length = 0;
    },
  };
}
