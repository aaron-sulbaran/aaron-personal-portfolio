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
  return boxes.reduce((frame, box) => ({ width: Math.max(frame.width, box.width), height: Math.max(frame.height, box.height) }), { width: 0, height: 0 });
}

export interface ColumnSettings { boxes: Boxes; wideFrom: number; columnGap: number; textWidth: number; padding: number; border: number }

// The photo column is as wide as the card's widest box, so its words sit in one
// place on every row; the panel is that column, the gap, the words, the padding
// and the border. A card with no photos is the words alone.
export function rowColumns(aspects: readonly number[], g: ColumnSettings) {
  const slot = aspects.reduce((widest, aspect) => Math.max(widest, boxFor(aspect, g.boxes, g.wideFrom).width), 0);
  const inner = slot > 0 ? slot + g.columnGap + g.textWidth : g.textWidth;
  return { slot, panel: inner + 2 * g.padding + 2 * g.border };
}

export function pageStage(photos: readonly number[], aspects: readonly number[], innerWidth: number, height: number) {
  const boxes = photos.map((photo) => fitWhole(aspects[photo], innerWidth, height));
  return { frame: groupFrame(boxes), boxes };
}

// The cap, or less when the page is too short to leave the words their room,
// never below the floor.
export const stageHeight = (capPx: number, roomPx: number, floorPx: number) => Math.max(floorPx, Math.min(capPx, roomPx));
