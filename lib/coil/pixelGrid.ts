// The pixel grid a fill's canvas draws on, so its letters land on the same
// device pixels as the page's own text (pure; components/coil/fill).
//
// Chrome puts a canvas's picture on whole CSS px: its layer's corner is its
// offset from the box that paints it, rounded, added to that box's corner,
// rounded (measured on its layer tree, 2026-10-30), and its size is rounded
// the same way. A box already on whole px comes out where it is however those
// roundings fall, so the fill sets its canvas on whole px inside its host
// (wholePxBox) and maps its drawing buffer onto exactly that box. Its letters'
// mask is laid on the same grid: the mask's pixels are the buffer's, its
// corner on one, so each texel is one screen pixel and nothing is resampled;
// the glyphs inside it are painted by the same text rasterizer as the page's,
// on the baseline and at the pen the page paints them on (lib/coil/lineAnchor.ts).

export type DrawnBox = {
  // The canvas's box as drawn, viewport CSS px.
  left: number;
  top: number;
  width: number;
  height: number;
  // The screen's device px per CSS px.
  dpr: number;
};

type Edges = { left: number; top: number; right: number; bottom: number };

// The canvas's box: its host's box (viewport px) with each edge rounded to a
// whole CSS px in the page's own coordinates (the canvas scrolls with the
// page), and where that is from the host's corner (the canvas's left and top
// inside its host).
export function wholePxBox(host: Edges, scroll: { x: number; y: number }) {
  const x0 = Math.round(host.left + scroll.x);
  const x1 = Math.round(host.right + scroll.x);
  const y0 = Math.round(host.top + scroll.y);
  const y1 = Math.round(host.bottom + scroll.y);
  const left = x0 - scroll.x;
  const top = y0 - scroll.y;
  return { left, top, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0), inHost: { left: left - host.left, top: top - host.top } };
}

// A mask's rect (CSS px from the canvas's drawn corner) grown to whole mask
// pixels: its corner and size at `scale` px per CSS px are whole numbers, so
// when `scale` is the drawing buffer's own, each texel is one buffer pixel.
export function maskGrid(box: { x: number; y: number; w: number; h: number }, scale: number) {
  const x0 = Math.floor(box.x * scale);
  const y0 = Math.floor(box.y * scale);
  const x1 = Math.ceil((box.x + box.w) * scale);
  const y1 = Math.ceil((box.y + box.h) * scale);
  const px = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  return { px, rect: { x: px.x / scale, y: px.y / scale, w: px.w / scale, h: px.h / scale } };
}
