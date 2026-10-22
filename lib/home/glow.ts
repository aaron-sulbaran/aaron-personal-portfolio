import { COIL } from "@/lib/coil/constants";

// The glow behind the intro's heading, as geometry (pure). The glow is a
// layer of the hero's own field with a radial alpha mask. Hard rules from
// AGENTS.md Layer 1: a shader field never sits behind body text, so the
// mask's falloff must end above the paragraph; it may spread into the empty
// space beside the heading. Everything is in CSS px in the copy container's
// own box (x from its left edge, y from its top), except where noted.

export type GlowInput = {
  // The container's left edge in the viewport, and the viewport's width: the
  // glow's layer is full bleed, the mask keeps well inside it.
  containerLeft: number;
  viewportWidth: number;
  // The heading: its top and height in the container, and its ink (the left
  // edge of its text, and its widest line's width).
  headingTop: number;
  headingHeight: number;
  textLeft: number;
  textWidth: number;
  // The paragraph's top (nothing of the glow reaches below it) and the layer's
  // top (the intro's top edge, a negative number in the container's box).
  paragraphTop: number;
  layerTop: number;
  knobs: { size: number; offsetX: number; offsetY: number; strength: number };
};

export type GlowGeometry = {
  // The layer, in the container's box.
  box: { x: number; y: number; w: number; h: number };
  // The mask, in the layer's own box: its center, its two radii (where it
  // reaches zero) and its strength at the center.
  mask: { cx: number; cy: number; rx: number; ry: number; k: number };
};

const MIN_RADIUS = 1;

export function glowGeometry(input: GlowInput): GlowGeometry {
  const { glow } = COIL.deal;
  const { knobs } = input;
  const box = { x: -input.containerLeft, y: input.layerTop, w: input.viewportWidth, h: Math.max(MIN_RADIUS, input.paragraphTop - input.layerTop) };
  // Where the glow is centered: a bit left of the text's middle (the name's
  // mass), moved by the offset knobs in shares of the ink's width and height.
  const cx = input.containerLeft + input.textLeft + input.textWidth * (0.4 + knobs.offsetX);
  const headingMid = input.headingTop + input.headingHeight / 2 + knobs.offsetY * input.headingHeight;
  const cy = Math.min(box.h, Math.max(0, headingMid - box.y));
  const rx = Math.max(MIN_RADIUS, Math.min(input.textWidth * glow.rxOfText * knobs.size, cx, box.w - cx));
  // The vertical radius is held to the box's bottom edge, which is the paragraph's top.
  const ry = Math.max(MIN_RADIUS, Math.min(input.headingHeight * glow.ryOfHeading * knobs.size, cy, box.h - cy));
  return { box, mask: { cx, cy, rx, ry, k: Math.min(1, Math.max(0, knobs.strength)) } };
}

// The shader's falloff, 1 - smoothstep(0, 1, distance / radius), at its
// quarter points: the poster fallback's CSS mask reads the same curve.
const STOPS: readonly [number, number][] = [
  [0, 1],
  [25, 0.896],
  [50, 0.5],
  [75, 0.104],
];

export function glowMaskCss({ mask }: GlowGeometry): string {
  const at = (share: number) => (share * mask.k).toFixed(3);
  const stops = STOPS.map(([percent, share]) => `rgba(0,0,0,${at(share)}) ${percent}%`).join(", ");
  return `radial-gradient(ellipse ${mask.rx.toFixed(1)}px ${mask.ry.toFixed(1)}px at ${mask.cx.toFixed(1)}px ${mask.cy.toFixed(1)}px, ${stops}, rgba(0,0,0,0) 100%)`;
}
