// WCAG contrast from hex tokens, so the duck's alpha ceiling is checked
// against the palette rather than tuned by eye. A ducked dot is the muted or
// accent token blended over the background at DUCK_ALPHA; muted body text
// must still read at 4.5 to 1 over it.

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function blendOver(bg: Rgb, fg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((k) => bg[k] + (fg[k] - bg[k]) * alpha) as Rgb;
}

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
