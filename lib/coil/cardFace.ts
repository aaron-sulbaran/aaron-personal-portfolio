// A card face's pixel layout at one texture size, with no three import, so
// DOM code (FlyingTile) can read it without pulling three into the initial
// bundle: textures.ts paints with it, and the flight lays its sharp photo
// over the painted one with the same inset.

export type TextureSize = readonly [number, number];

// The rim radius and the photo inset scale with the width.
export type CardDims = { w: number; h: number; radius: number; inset: number; innerRadius: number };

export function cardDims([w, h]: TextureSize): CardDims {
  const radius = Math.round(0.05 * w);
  const inset = Math.round(0.034 * w);
  return { w, h, radius, inset, innerRadius: Math.max(3, radius - inset * 0.6) };
}

// Where a photo front's picture sits inside a card painted at this size, as
// fractions of the card's width and height (radius as a fraction of the
// width), and how it is cropped (the paint's 42 percent).
export function cardPhotoInset(size: TextureSize) {
  const d = cardDims(size);
  return { x: d.inset / d.w, y: d.inset / d.h, radius: d.innerRadius / d.w, objectPosition: "50% 42%" } as const;
}
