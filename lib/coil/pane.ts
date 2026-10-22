import type { Viewport } from "./geometry";

// Where the helix lives inside a canvas that fills a wider section. The cards
// section is one canvas edge to edge (the shader field fills it), with a
// column of titles at each side and the pane between them; the helix is laid
// out for the pane and stays centered on the canvas, so both gutters are the
// wider of the two the pane leaves. No pane (a phone, where the canvas is the
// Coil's own region) is the whole canvas.
export type EdgeSpan = { left: number; right: number };

// The narrowest pane the helix is laid out for, as a share of the canvas's height.
const MIN_PANE_OF_HEIGHT = 0.5;

export function paneViewport(host: Viewport & EdgeSpan, pane: EdgeSpan | null): Viewport {
  if (!pane || pane.right - pane.left <= 0) return { width: host.width, height: host.height };
  const gutter = Math.max(0, pane.left - host.left, host.right - pane.right);
  const width = Math.min(host.width, Math.max(host.height * MIN_PANE_OF_HEIGHT, host.width - 2 * gutter));
  return { width, height: host.height };
}

// The gutter either side of the pane, in canvas px.
export function paneGutter(canvasWidth: number, pane: Viewport): number {
  return Math.max(0, (canvasWidth - pane.width) / 2);
}
