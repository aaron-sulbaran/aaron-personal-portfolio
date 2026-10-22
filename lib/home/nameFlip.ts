// The loader's name becomes page 1's heading: a uniform scale and a shift
// (transform only, origin top left) that carry the loader's lockup onto the
// heading it shrinks into, plus the pure model of where each namePosition
// puts that heading. The DOM is the truth at run time (the loader measures
// both rects); this model is what the tests hold the CSS to, and what says how
// far each position makes the lockup travel.

export type Rect = { left: number; top: number; width: number; height: number };
export type Flip = { x: number; y: number; scale: number };
export type Viewport = { width: number; height: number };

export const NAME_POSITIONS = ["center", "top", "topLeft"] as const;
export type NamePosition = (typeof NAME_POSITIONS)[number];

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

// Where each position puts the heading, in the stage's own box (x from its
// left edge, y from its top). The stage is the section's top block: `grid`
// is the content column (its left edge and width, the same one the
// paragraphs use) and `topInsetPx` the room the logo and the Menu pill take
// above a heading placed at the top.
export type HeadingLayout = {
  stage: { width: number; height: number };
  heading: { width: number; height: number };
  grid: { left: number; width: number };
  topInsetPx: number;
};

export function headingRect(position: NamePosition, { stage, heading, grid, topInsetPx }: HeadingLayout): Rect {
  const centeredLeft = (stage.width - heading.width) / 2;
  switch (position) {
    case "center":
      return { left: centeredLeft, top: (stage.height - heading.height) / 2, width: heading.width, height: heading.height };
    case "top":
      return { left: centeredLeft, top: topInsetPx, width: heading.width, height: heading.height };
    case "topLeft":
      return { left: grid.left, top: topInsetPx, width: heading.width, height: heading.height };
  }
}
