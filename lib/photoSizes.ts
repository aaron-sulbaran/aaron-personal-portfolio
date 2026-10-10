import { photoBySrc } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";

// The modal's photo slot (and the flight's sharp copy parked in it) is a 3:4
// box that draws its photo with object-fit: cover. A source wider than 3:4 is
// scaled to the box's height, so its drawn width is the box height times the
// source aspect, wider than the box. The request has to cover that drawn
// width or the landed image is soft.
const SLOT_ASPECT = 3 / 4;
// The slot's rendered width: under md the panel stacks and the slot spans it
// (the page's px-4 and the panel's p-5 on each side); from md it is 46
// percent of a panel that tops out at max-w-4xl with p-8, about 384px.
const SLOT_WIDTH_NARROW = "(100vw - 72px)";
const SLOT_WIDTH_WIDE = 384;

export function coverScale(sourceAspect: number, boxAspect = SLOT_ASPECT): number {
  return Math.max(1, sourceAspect / boxAspect);
}

export function photoSlotSizes(src: string): string {
  const photo = photoBySrc.get(src);
  const scale = Number((photo ? coverScale(photo.width / photo.height) : 1).toFixed(3));
  const narrow = scale === 1 ? `calc${SLOT_WIDTH_NARROW}` : `calc(${SLOT_WIDTH_NARROW} * ${scale})`;
  return `(max-width: 767px) ${narrow}, ${Math.ceil(SLOT_WIDTH_WIDE * scale)}px`;
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
