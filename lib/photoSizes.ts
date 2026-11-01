import { GALLERY } from "@/lib/gallery/constants";

// A photo drawn with object-fit: cover in a box is scaled to the box's longer
// relative side, so a source wider than the box is drawn wider than the box.
// The request has to cover that drawn width or the image is soft.
const SLOT_ASPECT = 3 / 4;

export function coverScale(sourceAspect: number, boxAspect = SLOT_ASPECT): number {
  return Math.max(1, sourceAspect / boxAspect);
}

// ---- The photo pop's size: the one place its numbers live (read by
// components/inline/TipBubble, which writes them onto the label as custom
// properties, and by app/globals.css, "photo pops", which draws with them).
// Aaron, 2026-10-31: every pop the same size, but never so small a photo
// cannot be viewed. Every single-photo pop is drawn at ONE height, so its
// width follows the photo: a portrait is a narrow card and a landscape (the
// skydiving photo) a wider one at the same height. The photo export caps the
// long edge at 800px (scripts/export-photos.mjs).
const POP_HEIGHT = { desktop: 360, phone: 320 } as const; // CSS px (md and up, below md); today's pop was 373 tall, the Fuji pop's size
const POP_WIDE_ASPECT = 1.55; // wider than this (3:2 with a little slack) and the photo is shown whole, its height following its width (a meme, a logo): cropping it would cut its words
export const POP_PHOTO = {
  height: POP_HEIGHT,
  wideAspect: POP_WIDE_ASPECT,
  maxWidth: Math.round(POP_HEIGHT.desktop * POP_WIDE_ASPECT), // CSS px; the widest photo a pop draws on desktop, so no photo up to the wide limit is ever cropped there
  edge: 40, // CSS px kept clear of the viewport on a phone: the label's 12px margin and 8px padding, each side
} as const;

// The label's custom properties for the stylesheet. Written on the label itself, so the sizes are written once, here.
export const POP_SIZE_VARS: Record<string, string> = {
  "--pop-h-desktop": `${POP_PHOTO.height.desktop}px`,
  "--pop-h-phone": `${POP_PHOTO.height.phone}px`,
  "--pop-w-max": `${POP_PHOTO.maxWidth}px`,
  "--pop-edge": `${POP_PHOTO.edge}px`,
};

// A pop's photo as the stylesheet draws it on desktop: one fixed height and the
// width of the photo's own shape ("cover"), or, for a very wide photo, its own
// shape at the widest width ("whole"). Phones use the same rule at the phone
// height with the width clamped to the viewport. width and height are the file's.
export function popPhotoBox(width: number, height: number): { fit: "cover" | "whole"; width: number; height: number } {
  const aspect = width / height;
  if (aspect > POP_PHOTO.wideAspect) {
    const drawn = Math.min(Math.round(POP_PHOTO.height.desktop * aspect), POP_PHOTO.maxWidth);
    return { fit: "whole", width: drawn, height: Math.round(drawn / aspect) };
  }
  return { fit: "cover", width: Math.round(POP_PHOTO.height.desktop * aspect), height: POP_PHOTO.height.desktop };
}


// The card picture in the gallery's first row, and the flight's sharp copy laid
// over it (components/FlyingTile): a 3:4 file in a 3:4 box, so no cover scale.
export const CARD_PICTURE_SIZES = `${GALLERY.verticalWidth}px`;

// A desktop gallery photo drawn with object-fit: cover in its box; the request
// covers the drawn width when the photo is wider than the box.
export function galleryRowSizes(sourceAspect: number, box: { width: number; height: number }): string {
  const drawn = box.width * coverScale(sourceAspect, box.width / box.height);
  return `${Math.ceil(Number(drawn.toFixed(3)))}px`;
}

// A pager photo, fitted whole inside the panel's inner width.
export const PAGER_PHOTO_SIZES = `calc(100vw - ${GALLERY.pager.insetPx}px)`;

// The request width for a photo cover-cropped into the cycling pop's square frame
// (one pop height a side): the frame's side, widened by the crop when the photo is landscape.
export const popSquareSizes = (sourceAspect: number): string => `${Math.ceil(POP_PHOTO.height.desktop * coverScale(sourceAspect, 1))}px`;
