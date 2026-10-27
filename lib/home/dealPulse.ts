// The ring the click sends out from "Deal me in" across page 1's foot (slice 5):
// where it starts and how big it grows, pure over two boxes. `box` is the
// pulse's own layer (it covers the strip), `button` the button; both in
// viewport px. The ring is one ellipse centered on the button's middle. It
// grows until its width has cleared the strip's farther side, so it always
// crosses the whole strip whatever the width, and its height stops where the
// strip does above the button (and short of a circle on a phone), so the ring
// is whole at every size: nothing of it is ever cut by the layer's edge.

export type RectLike = { left: number; top: number; width: number; height: number };

export type PulseGeometry = {
  x: number; // the button's middle across, from the box's left
  y: number; // and down, from its top
  size: number; // the ring's width at its full spread
  height: number; // and its height
};

// The tallest the ring gets, as a share of its width: never rounder than this.
const MAX_HEIGHT_OVER_WIDTH = 0.9;

export function pulseGeometry(button: RectLike, box: RectLike): PulseGeometry {
  const x = button.left + button.width / 2 - box.left;
  const y = button.top + button.height / 2 - box.top;
  const size = Math.max(2, Math.round(Math.max(x, box.width - x) * 2));
  const height = Math.max(2, Math.round(Math.min(y, (size / 2) * MAX_HEIGHT_OVER_WIDTH) * 2));
  return { x, y, size, height };
}
