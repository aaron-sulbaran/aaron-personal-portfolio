// The ring the click sends out from "Deal me in" across page 1's foot (slice 5):
// where it starts and how big it grows, pure over two boxes. `box` is the
// pulse's own layer (it covers the strip, clipped to it), `button` the button;
// both in viewport px. The ring is centered on the button's middle and grows
// until it has cleared the farthest corner of the box, so it always crosses the
// whole strip whatever the width.

export type RectLike = { left: number; top: number; width: number; height: number };

export type PulseGeometry = {
  x: number; // the button's middle across, from the box's left
  y: number; // and down, from its top
  size: number; // the ring's diameter at its full spread
};

export function pulseGeometry(button: RectLike, box: RectLike): PulseGeometry {
  const x = button.left + button.width / 2 - box.left;
  const y = button.top + button.height / 2 - box.top;
  const reach = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
  return { x, y, size: Math.max(2, Math.round(reach * 2)) };
}
