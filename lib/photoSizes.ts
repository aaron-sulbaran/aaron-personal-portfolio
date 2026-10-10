import { GALLERY } from "@/lib/gallery/constants";

// A photo drawn with object-fit: cover in a box is scaled to the box's longer
// relative side, so a source wider than the box is drawn wider than the box.
// The request has to cover that drawn width or the image is soft.
const SLOT_ASPECT = 3 / 4;

export function coverScale(sourceAspect: number, boxAspect = SLOT_ASPECT): number {
  return Math.max(1, sourceAspect / boxAspect);
}

// A photo pop (components/inline/TipBubble) shows its photo about 280px wide
// (docs/content/tooltips.md); its export caps the long edge at 800px.
export const POP_PHOTO_WIDTH = 280;
export const POP_PHOTO_SIZES = `${POP_PHOTO_WIDTH}px`;

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
