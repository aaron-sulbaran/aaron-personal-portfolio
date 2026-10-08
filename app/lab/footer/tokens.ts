// The field's colors from the --shader-* tokens and the paper, read once per
// theme through getComputedStyle (never var() at frame time). Pure over a
// token reader so it is tested without a DOM. The Coil's own reader lives in
// lib/coil/theme.ts, which imports three; this lab reads hex and rgb() only.

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

export type FieldTokens = {
  readonly dark: boolean;
  readonly paper: Rgb;
  readonly top: Rgb;
  readonly bottom: Rgb;
  readonly glow: Rgb;
  readonly second: Rgb;
};

export function fieldTokens(read: (name: string) => string, dark: boolean): FieldTokens {
  const paper = parseToken(read("--color-background")) ?? ([0.98, 0.98, 0.97] as const);
  const color = (name: string) => parseToken(read(name)) ?? paper;
  return { dark, paper, top: color("--shader-top"), bottom: color("--shader-bottom"), glow: color("--shader-glow"), second: color("--shader-second") };
}

export function readDocumentTokens(dark: boolean): FieldTokens {
  const style = getComputedStyle(document.documentElement);
  return fieldTokens((name) => style.getPropertyValue(name), dark);
}
