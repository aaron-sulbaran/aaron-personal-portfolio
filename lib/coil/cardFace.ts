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

export type Fit = { w: number; h: number };
export interface LogoFit { logoWidth: number; wordmarkWidth: number; wordmarkFrom: number }

// A logo's drawn box on a card `cardWidth` wide: a mark's longer side at
// logoWidth, a wordmark across wordmarkWidth.
export function logoBox(aspect: number, cardWidth: number, f: LogoFit): Fit {
  if (!(aspect > 0)) return { w: 0, h: 0 };
  if (aspect >= f.wordmarkFrom) {
    const w = cardWidth * f.wordmarkWidth;
    return { w, h: w / aspect };
  }
  const size = cardWidth * f.logoWidth;
  return aspect >= 1 ? { w: size, h: size / aspect } : { w: size * aspect, h: size };
}

export function containBox(aspect: number, side: number): Fit {
  if (!(aspect > 0)) return { w: 0, h: 0 };
  return aspect >= 1 ? { w: side, h: side / aspect } : { w: side * aspect, h: side };
}

// A light plate under a plain tile's logo in the dark theme when the logo has no
// dark file and is not its own ground (the IEEE square).
export function needsGround(logo: { srcDark: string | null; opaque?: boolean }, tile: "plain" | "anvil", dark: boolean): boolean {
  return dark && tile === "plain" && logo.srcDark === null && !logo.opaque;
}

// The jobs card: count discs on the card's own diagonal, bottom left (the oldest)
// to top right (the newest), diameters from `from` to `to` card widths, `gap`
// apart, the group centred. In card widths from the card's top left; the card is
// 1 wide and 1 / aspect tall.
export type Circle = { x: number; y: number; r: number };
export function circlesLayout(count: number, aspect: number, o: { from: number; to: number; gap: number }): Circle[] {
  if (count <= 0) return [];
  const height = 1 / aspect;
  const length = Math.hypot(1, height);
  const ux = 1 / length;
  const uy = -height / length;
  const radii = Array.from({ length: count }, (_, k) => (count === 1 ? o.to : o.from + ((o.to - o.from) * k) / (count - 1)) / 2);
  const centers = [{ x: 0, y: 0 }];
  for (let k = 1; k < count; k++) {
    const step = radii[k - 1] + radii[k] + o.gap;
    centers.push({ x: centers[k - 1].x + ux * step, y: centers[k - 1].y + uy * step });
  }
  const left = Math.min(...centers.map((c, k) => c.x - radii[k]));
  const right = Math.max(...centers.map((c, k) => c.x + radii[k]));
  const top = Math.min(...centers.map((c, k) => c.y - radii[k]));
  const bottom = Math.max(...centers.map((c, k) => c.y + radii[k]));
  const dx = 0.5 - (left + right) / 2;
  const dy = height / 2 - (top + bottom) / 2;
  return centers.map((c, k) => ({ x: c.x + dx, y: c.y + dy, r: radii[k] }));
}

// The AS mark's ink box in its own coordinates (lib/mark/geometry's paths, half
// a unit of room), so the mark can be drawn alone and centred.
// Twin: VIEW_BOXES.tight in components/menu/BrandMark.tsx; change both together.
export const MARK_INK_BOX = { x: 51.69, y: 22.62, width: 144.92, height: 210.76 } as const;
