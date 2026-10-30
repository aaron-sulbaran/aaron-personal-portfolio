// The loader's name becomes page 1's name: the lockup is laid out as the
// heading is, at its size and in its place, and a uniform scale and a shift
// (transform only, origin top left) give it its big look, which the shrink
// takes to none. So the travel ends on the heading's own layout, which is also
// where the name canvas draws the name (it reads the heading's lines,
// components/coil/nameCanvas/start.ts). The DOM is the truth at run time (the
// loader measures both rects).

export type Rect = { left: number; top: number; width: number; height: number };
export type Flip = { x: number; y: number; scale: number };
export type Viewport = { width: number; height: number };

// Profa Black's "Aaron", per em: the advance (the lockup's width) and the ink
// width the loader fits to the screen. Measured on the running face; the
// loader re-measures nothing, since both lockups are laid out by the same CSS.
export const NAME_ADVANCE_EM = 2.81636;
export const NAME_INK_EM = 2.76636;

// The shift and scale that put `from`'s top left on `to`'s with `to`'s width.
// Both lockups are one markup at two sizes, so the height follows the width.
export function flipTransform(from: Rect, to: Rect): Flip {
  const scale = from.width > 0 ? to.width / from.width : 1;
  return { x: to.left - from.left, y: to.top - from.top, scale };
}

// Where a rect lands under a flip (origin top left): the check the tests and
// the e2e hold the loader's last frame to.
export function applyFlip(from: Rect, flip: Flip): Rect {
  return { left: from.left + flip.x, top: from.top + flip.y, width: from.width * flip.scale, height: from.height * flip.scale };
}

export function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// How far the lockup's middle travels in the shrink, px.
export function travelPx(from: Rect, to: Rect): number {
  const a = centerOf(from);
  const b = centerOf(to);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// The loader's lockup: the name fills the screen's width less a gutter on each
// side, but never stands taller than `maxHeightShare` of the screen's height.
export const LOADER_LOCKUP = { gutterPx: 16, maxHeightShare: 0.52 } as const;

export function loaderNameSizePx(viewport: Viewport): number {
  const byWidth = (viewport.width - 2 * LOADER_LOCKUP.gutterPx) / NAME_INK_EM;
  return Math.max(1, Math.min(byWidth, viewport.height * LOADER_LOCKUP.maxHeightShare));
}

// The loader's lockup box (a name's size in, the whole lockup's size out),
// centered on the screen.
export function loaderLockupRect(viewport: Viewport, lockupEm: { width: number; height: number }): Rect {
  const size = loaderNameSizePx(viewport);
  const width = lockupEm.width * size;
  const height = lockupEm.height * size;
  return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2, width, height };
}
