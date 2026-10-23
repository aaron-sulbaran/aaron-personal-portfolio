import type { NameTarget, Rgb } from "@/lib/coil/nameTarget";

// What the loader's lockup wears as it lands on the canvas name: the name's
// colour is the composite's own gradient at the letters' ink (the loader's solid
// name, before the lit surface grows over it, is that gradient at inkAlpha over
// the field), so a DOM name in the middle of the gradient at that opacity sits
// over the field in the pixels the canvas then draws. The greeting sits above
// the gradient's band, where the composite holds its top colour, solid.

const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(", ")})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export type LandingColors = { name: string; greeting: string; nameOpacity: number };

export function landingColors(target: Pick<NameTarget, "gradient" | "inkAlpha">): LandingColors {
  const { from, to } = target.gradient;
  return { name: css(mix(from, to, 0.5)), greeting: css(from), nameOpacity: Math.min(1, Math.max(0, target.inkAlpha)) };
}
