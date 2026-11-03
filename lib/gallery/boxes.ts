// The gallery's boxes (the lab's round four, Aaron's pick): one vertical box
// (3:4) and one horizontal box (4:3) of about the same area, every photo drawn
// in the box of its orientation; and on a phone, every photo fitted whole.

export type Box = { width: number; height: number };
export interface Boxes { vertical: Box; horizontal: Box }

export const isWide = (aspect: number, wideFrom: number) => aspect >= wideFrom;

export function fitWhole(aspect: number, boxWidth: number, boxHeight: number): Box {
  if (!(aspect > 0) || boxWidth <= 0 || boxHeight <= 0) return { width: 0, height: 0 };
  const width = Math.min(boxWidth, boxHeight * aspect);
  return { width, height: width / aspect };
}

export function uniformBoxes(verticalWidth: number, horizontalWidth: number): Boxes {
  return { vertical: { width: verticalWidth, height: (verticalWidth * 4) / 3 }, horizontal: { width: horizontalWidth, height: (horizontalWidth * 3) / 4 } };
}

export const boxFor = (aspect: number, boxes: Boxes, wideFrom: number): Box => (isWide(aspect, wideFrom) ? boxes.horizontal : boxes.vertical);

export function groupFrame(boxes: readonly Box[]): Box {
  return boxes.reduce<Box>((frame, box) => ({ width: Math.max(frame.width, box.width), height: Math.max(frame.height, box.height) }), { width: 0, height: 0 });
}

export interface ColumnSettings { boxes: Boxes; wideFrom: number; columnGap: number; textWidth: number; padding: number; border: number }

// The photo column is as wide as the card's widest box, so its words sit in one
// place on every row; the panel is that column, the gap, the words, the padding
// and the border. A card with no photos is the words alone.
export function rowColumns(aspects: readonly number[], g: ColumnSettings) {
  return columnsFor(aspects.reduce((widest, aspect) => Math.max(widest, boxFor(aspect, g.boxes, g.wideFrom).width), 0), g);
}

// The same, for a card whose media column is a width of its own (the jobs card's clusters, lib/gallery/jobs).
export function columnsFor(slot: number, g: ColumnSettings) {
  const inner = slot > 0 ? slot + g.columnGap + g.textWidth : g.textWidth;
  return { slot, panel: inner + 2 * g.padding + 2 * g.border };
}

// A phone page's photo: whole in its stage while that leaves it at least minShare of the page's width. On a stage too short for that
// (a page that gave its words the room), it keeps that width and is cropped top and bottom (object-fit: cover, about the photo's own
// focus, lib/content/media), so it never shrinks to a thumbnail. maxCrop bounds the crop: the share of the picture cut is one less
// the whole photo's width over the box's, so on a wide page (a 900 by 600 window, where a share of the width is a box twice as wide as
// tall) the box stops at the width that cuts maxCrop, and the photo is a smaller, whole-ish picture rather than a strip of one.
export type StageBox = Box & { cropped: boolean };

export function phoneBox(aspect: number, innerWidth: number, height: number, minShare: number, maxCrop = 1): StageBox {
  const whole = fitWhole(aspect, innerWidth, height);
  const least = innerWidth * Math.min(1, minShare);
  if (whole.height <= 0 || whole.width + 0.5 >= least) return { ...whole, cropped: false };
  const width = Math.min(least, whole.width / (1 - Math.min(maxCrop, 0.99)));
  if (width <= whole.width + 0.5) return { ...whole, cropped: false };
  return { width, height, cropped: true };
}

// A page's stage, its frame the largest of its boxes: every photo whole, or with minShare, cropped where whole would be narrower than
// that share of the width (by at most maxCrop). whole names media that is never cropped (a demo video letterboxes itself in its own frame).
export function pageStage(photos: readonly number[], aspects: readonly number[], innerWidth: number, height: number, minShare = 0, whole: (photo: number) => boolean = () => false, maxCrop = 1) {
  const boxes = photos.map((photo): StageBox => (minShare > 0 && !whole(photo) ? phoneBox(aspects[photo], innerWidth, height, minShare, maxCrop) : { ...fitWhole(aspects[photo], innerWidth, height), cropped: false }));
  return { frame: groupFrame(boxes), boxes };
}

// The CSS object-position that keeps a cropped photo's subject in view: focus is a share of its height from the top (lib/content/media).
export const focusOf = (focus: number | undefined) => `50% ${Math.round((focus ?? 0.5) * 100)}%`;

// The cap, or less when the page is too short to leave the words their room,
// never below the floor.
export const stageHeight = (capPx: number, roomPx: number, floorPx: number) => Math.max(floorPx, Math.min(capPx, roomPx));
