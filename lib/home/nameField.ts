// The field behind page 1's name, as geometry (pure). It is the footer's raw
// WebGL field with a radial alpha mask, drawn over the stage (the block that
// holds the heading, full bleed). Hard rule from AGENTS.md Layer 1: a shader
// field never sits behind body text, so the mask's falloff reaches zero at or
// above the stage's bottom edge, which is where the first paragraph begins.
// Everything is in CSS px in the stage's own box (x from its left edge, y from
// its top).

export type NameFieldInput = {
  stage: { width: number; height: number };
  // The heading's box in the stage.
  heading: { left: number; top: number; width: number; height: number };
  // The lab's knobs: size scales both radii, the offsets move the middle in
  // shares of the heading's width and height, strength is the mask's peak.
  knobs: { size: number; offsetX: number; offsetY: number; strength: number };
  // How wide and tall the mask is, as shares of the heading's width and height.
  shares: { rxOfWidth: number; ryOfHeight: number };
};

export type NameFieldMask = { cx: number; cy: number; rx: number; ry: number; k: number };

const MIN_RADIUS = 1;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function nameFieldMask({ stage, heading, knobs, shares }: NameFieldInput): NameFieldMask {
  const cx = clamp(heading.left + heading.width / 2 + knobs.offsetX * heading.width, 0, stage.width);
  const cy = clamp(heading.top + heading.height / 2 + knobs.offsetY * heading.height, 0, stage.height);
  const rx = Math.max(MIN_RADIUS, Math.min(heading.width * shares.rxOfWidth * knobs.size, cx, stage.width - cx));
  // Held to the stage's bottom edge: the paragraph below it is never under the field.
  const ry = Math.max(MIN_RADIUS, Math.min(heading.height * shares.ryOfHeight * knobs.size, cy, stage.height - cy));
  return { cx, cy, rx, ry, k: clamp(knobs.strength, 0, 1) };
}

// The shader's falloff, 1 - smoothstep(0, 1, distance / radius), at its quarter
// points: the poster fallback's CSS mask reads the same curve.
const STOPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [25, 0.896],
  [50, 0.5],
  [75, 0.104],
];

export function maskCss(mask: NameFieldMask): string {
  const at = (share: number) => (share * mask.k).toFixed(3);
  const stops = STOPS.map(([percent, share]) => `rgba(0,0,0,${at(share)}) ${percent}%`).join(", ");
  return `radial-gradient(ellipse ${mask.rx.toFixed(1)}px ${mask.ry.toFixed(1)}px at ${mask.cx.toFixed(1)}px ${mask.cy.toFixed(1)}px, ${stops}, rgba(0,0,0,0) 100%)`;
}

// The slice of the hero's field the stage shows (the shader's uFrame): the
// field is laid out for a pane as wide as the stage and as tall as the
// viewport; the stage's bottom edge samples the field at `frameAt` (0 the
// field's bottom, where the soft blue mass rises, 1 its top, where the burnt
// orange lobe sits), and the stage's top edge sits the stage's share of the
// viewport higher.
export function fieldFrame(stage: { width: number; height: number }, viewportH: number, frameAt: number) {
  const height = Math.max(1, viewportH);
  return { aspect: stage.width / height, frameY: stage.height / height, frameY0: clamp(frameAt, 0, 1) };
}
