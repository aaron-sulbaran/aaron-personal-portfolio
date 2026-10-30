import type { NameTarget, Rgb } from "@/lib/coil/nameTarget";

// What the loader's lockup wears as it lands on the canvas name: the name in
// the middle of the composite's gradient at the letters' ink (inkAlpha) over
// the page, the greeting in the gradient's top colour, whole. The canvas name's
// first frame draws exactly that (lib/coil/nameCanvas.glsl.ts, its solid), so
// the handoff changes no pixel; the lit surface grows in over it after.

const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(", ")})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export type LandingColors = { name: string; greeting: string; nameOpacity: number };

export function landingColors(target: Pick<NameTarget, "gradient" | "inkAlpha">): LandingColors {
  const { from, to } = target.gradient;
  return { name: css(mix(from, to, 0.5)), greeting: css(from), nameOpacity: Math.min(1, Math.max(0, target.inkAlpha)) };
}
