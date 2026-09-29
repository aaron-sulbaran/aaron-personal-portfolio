import type { NameTarget, Rgb } from "./handoff";

// The continuity exit's math, pure: where the loader's name has to travel to
// sit on the canvas name, and the colors it wears on the way. The DOM name is
// a box one cap height tall whose bottom edge is the baseline and whose width
// is the ink's width; the canvas name is described by its ink box too, so one
// uniform scale and a translation land ink on ink.

export type NameBox = {
  left: number; // untransformed layout box, viewport px
  top: number;
  width: number;
  height: number; // the cap height: the box's bottom is the baseline
  rotationDeg: number; // the phone's rotated name starts at -90
};

export type Landing = { dx: number; dy: number; scale: number; rotationDeg: number };

// The transform (about the box's center) that puts the box's ink on the
// target's ink: the same width, baselines on one line.
export function landing(box: NameBox, target: NameTarget): Landing {
  const scale = target.width / box.width;
  const toX = target.left + target.width / 2;
  const toY = target.baseline - (box.height * scale) / 2;
  return {
    dx: toX - (box.left + box.width / 2),
    dy: toY - (box.top + box.height / 2),
    scale,
    rotationDeg: box.rotationDeg,
  };
}

// The CSS transform at progress e (0 at the loader's pose, 1 landed).
export function landingTransform(l: Landing, e: number) {
  const scale = 1 + (l.scale - 1) * e;
  const rotation = l.rotationDeg * (1 - e);
  return `translate(${(l.dx * e).toFixed(2)}px, ${(l.dy * e).toFixed(2)}px) rotate(${rotation.toFixed(3)}deg) scale(${scale.toFixed(5)})`;
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(", ")})`;

// Samples of the composite's smoothstep gradient across the mask's rect.
const STOPS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

// The letters' fill at color progress c (0 the loader's accent, 1 the canvas
// gradient), as a CSS gradient in the glyph element's own unscaled px.
// `glyphTop` is where the glyph element's top edge sits relative to the box's
// top (negative: it starts above the cap line), in the same unscaled px.
export function landingGradient(accent: Rgb, target: NameTarget, box: NameBox, glyphTop: number, c: number) {
  const scale = target.width / box.width;
  // The landed box's top in viewport px, then the mask rect in glyph px.
  const landedTop = target.baseline - box.height * scale;
  const top = (target.gradient.top - landedTop) / scale - glyphTop;
  const height = target.gradient.height / scale;
  const stops = STOPS.map((k) => {
    const color = mix(accent, mix(target.gradient.from, target.gradient.to, smooth(k)), c);
    return `${css(color)} ${(top + height * k).toFixed(2)}px`;
  });
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

// The name's opacity at color progress c: from solid to the composite's ink.
export function landingOpacity(target: NameTarget, c: number) {
  return 1 + (target.inkAlpha - 1) * c;
}

// "rgb(127, 168, 201)" (a computed color) to bytes; null if unreadable.
export function parseRgb(value: string): Rgb | null {
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
