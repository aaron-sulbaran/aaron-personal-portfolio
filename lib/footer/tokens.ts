// The footer field's colors from the --shader-* and --name-* tokens and the
// paper, read once per theme through getComputedStyle (never var() at frame
// time). Pure over a token reader, so it is tested without a DOM. The Coil's
// own reader (lib/coil/theme.ts) imports three, which never leaves the
// CoilScene chunk, so the footer keeps this three-free one. A production
// build minifies the tokens (lowercase hex, 8-digit hex); the dev server
// hands them back as authored. Both parse.

export type Rgb = readonly [number, number, number];

export function parseToken(raw: string): Rgb | null {
  const value = raw.trim().toLowerCase();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16) / 255) as unknown as Rgb;
    if (hex.length === 6 || hex.length === 8) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as Rgb;
    return null;
  }
  const fn = value.match(/^rgba?\(([^)]*)\)$/);
  if (!fn) return null;
  const parts = fn[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
  if (parts.length < 3) return null;
  const channels = parts.map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p) / 255));
  return channels.every(Number.isFinite) ? (channels as unknown as Rgb) : null;
}

export type TokenReader = (name: string) => string;

export type FieldTokens = {
  readonly dark: boolean;
  readonly paper: Rgb;
  readonly top: Rgb;
  readonly bottom: Rgb;
  readonly glow: Rgb;
  readonly second: Rgb;
};

const LIGHT_PAPER: Rgb = [0.98, 0.98, 0.97];

export function fieldTokens(read: TokenReader, dark: boolean): FieldTokens {
  const paper = parseToken(read("--color-background")) ?? LIGHT_PAPER;
  const color = (name: string) => parseToken(read(name)) ?? paper;
  return { dark, paper, top: color("--shader-top"), bottom: color("--shader-bottom"), glow: color("--shader-glow"), second: color("--shader-second") };
}

// The hero name's tokens: its ink (a number) and the lit surface's stops.
export type NameTokens = {
  readonly ink: number;
  readonly c1: Rgb;
  readonly c2: Rgb;
  readonly c3: Rgb;
  readonly shadow: Rgb;
  readonly sheen: Rgb;
  readonly mean: Rgb;
};

export function nameTokens(read: TokenReader, paper: Rgb): NameTokens {
  const color = (name: string) => parseToken(read(name)) ?? paper;
  const ink = parseFloat(read("--name-ink").trim());
  return {
    ink: Number.isFinite(ink) ? ink : 0.12,
    c1: color("--name-surface-1"),
    c2: color("--name-surface-2"),
    c3: color("--name-surface-3"),
    shadow: color("--name-surface-shadow"),
    sheen: color("--name-surface-sheen"),
    mean: color("--name-surface-mean"),
  };
}

// The document's tokens now (client only: call once per theme).
export function readDocumentTokens(): { field: FieldTokens; name: NameTokens } {
  const style = getComputedStyle(document.documentElement);
  const read: TokenReader = (name) => style.getPropertyValue(name);
  const field = fieldTokens(read, document.documentElement.dataset.theme === "dark");
  return { field, name: nameTokens(read, field.paper) };
}
