import { coverScale } from "@/lib/photoSizes";

// The desktop gallery as plain data: which block each photo belongs to, and
// whether the photo sits beside its paragraph (a vertical photo) or spans the
// row above it (a horizontal one). Photos keep their own shape
// (modal-gallery.md, "Aaron's decisions"); only the flown card picture is
// 3:4. No DOM, so the lab's tests read it and the site build can lift it.

export type Side = "left" | "right";

export type Row =
  | { kind: "lead"; photo: number; block?: number } // the card picture beside the title and the first block
  | { kind: "pair"; block: number; photo: number; side: Side } // a vertical photo beside its paragraph
  | { kind: "stack"; block: number; photo: number } // a horizontal photo across the row, its paragraph under it
  | { kind: "text"; block: number }
  | { kind: "photos"; photos: number[]; side: Side } // vertical extras side by side
  | { kind: "wide"; photo: number }; // a horizontal extra on its own row

export interface PhotoRef {
  // The block this photo belongs beside (photos.md). Undefined, or a block the
  // card does not have, makes it an extra that follows the last block.
  block?: number;
  // Width over height as the modal draws it.
  aspect: number;
}

export type LeadMode = "title" | "block";

export interface InterleaveOptions {
  extrasPerRow?: number;
  // A photo at least this wide for its height spans the row.
  wideFrom?: number;
  // The card picture (a photo card's flown card), which the modal shows
  // first (modal-gallery.md): beside the title ("title"), or claiming the
  // first block like any other photo ("block").
  lead?: number;
  leadMode?: LeadMode;
}

export const isWide = (aspect: number, wideFrom: number) => aspect >= wideFrom;

// The card picture, when there is one, comes first, beside the title; its
// row also carries the first block (cards.md: "The card picture sits beside
// the title; it is not paired"). Every other photo pairs with the block its
// `block` names, never by position. The first photo of a block sits beside
// it (vertical, the sides alternating from the left among the side-by-side
// rows) or spans the row above it (horizontal); further photos of the same
// block stack under it, consecutive vertical ones sharing a row (up to
// `extrasPerRow`), each horizontal one on its own. Photos naming no block, or
// one the card lacks, follow the last block the same way. A card with one
// block puts every photo after it.
export function interleave(blockCount: number, photos: readonly PhotoRef[], { extrasPerRow = 2, wideFrom = 1.1, lead, leadMode = "title" }: InterleaveOptions = {}): Row[] {
  const hasLead = lead !== undefined && lead >= 0 && lead < photos.length;
  const byBlock: number[][] = Array.from({ length: Math.max(0, blockCount) }, () => []);
  const extras: number[] = [];
  const valid = (block: number | undefined): block is number => block !== undefined && Number.isInteger(block) && block >= 0 && block < blockCount;
  photos.forEach((photo, index) => {
    if (hasLead && index === lead) return;
    if (valid(photo.block)) byBlock[photo.block].push(index);
    else extras.push(index);
  });
  if (hasLead && leadMode === "block") {
    if (blockCount > 0) byBlock[0].unshift(lead);
    else extras.unshift(lead);
  }

  const rows: Row[] = [];
  let sideRows = 0;
  const nextSide = (): Side => (sideRows++ % 2 === 0 ? "left" : "right");
  const wide = (photo: number) => isWide(photos[photo].aspect, wideFrom);
  const perRow = Math.max(1, Math.floor(extrasPerRow));
  const follow = (list: readonly number[]) => {
    let run: number[] = [];
    const flush = () => {
      for (let i = 0; i < run.length; i += perRow) rows.push({ kind: "photos", photos: run.slice(i, i + perRow), side: nextSide() });
      run = [];
    };
    for (const photo of list) {
      if (wide(photo)) {
        flush();
        rows.push({ kind: "wide", photo });
      } else run.push(photo);
    }
    flush();
  };

  let firstBlock = 0;
  if (hasLead && leadMode === "title") {
    if (blockCount > 0) {
      rows.push({ kind: "lead", photo: lead, block: 0 });
      follow(byBlock[0]);
      firstBlock = 1;
    } else rows.push({ kind: "lead", photo: lead });
  }
  for (let block = firstBlock; block < blockCount; block++) {
    const list = byBlock[block];
    if (list.length === 0 || blockCount === 1) {
      rows.push({ kind: "text", block });
      follow(list);
      continue;
    }
    const [first, ...rest] = list;
    rows.push(wide(first) ? { kind: "stack", block, photo: first } : { kind: "pair", block, photo: first, side: nextSide() });
    follow(rest);
  }
  follow(extras);
  return rows;
}

// The order the photos are read in on desktop, which is also the phone
// stage's order, so the two never disagree.
export function readingOrder(rows: readonly Row[]): number[] {
  return rows.flatMap((row) => (row.kind === "photos" ? row.photos : row.kind === "text" ? [] : [row.photo]));
}

// The blocks a row shows, for the mask steps and the markup.
export function rowBlock(row: Row): number | undefined {
  return row.kind === "photos" || row.kind === "wide" ? undefined : row.block;
}

export const MIN_TEXT_WIDTH = 280;
export const MIN_PHOTO_WIDTH = 320;

// The text column beside a vertical photo: the panel's inner width less the
// photo and the gap between them.
export function textColumn(panelWidth: number, panelPadding: number, photoWidth: number, columnGap: number) {
  const inner = panelWidth - 2 * panelPadding;
  const width = inner - photoWidth - columnGap;
  return { inner, width, roomy: width >= MIN_TEXT_WIDTH };
}

// The panel's real width inside a viewport: the setting, capped by the
// viewport less the backdrop's side padding.
export function panelWidthIn(viewportWidth: number, setting: number, sidePadding: number) {
  return Math.max(0, Math.min(setting, viewportWidth - 2 * sidePadding));
}

export type Box = { width: number; height: number };

// A photo fitted whole inside a box, keeping its shape.
export function fitWhole(aspect: number, boxWidth: number, boxHeight: number): Box {
  if (!(aspect > 0) || boxWidth <= 0 || boxHeight <= 0) return { width: 0, height: 0 };
  const width = Math.min(boxWidth, boxHeight * aspect);
  return { width, height: width / aspect };
}

// A vertical photo in the column: the column's width, its own height, and
// never wider than its source at 1x (the LinkedIn screenshot is 532px).
export function columnBox(aspect: number, columnWidth: number, maxWidth = Infinity): Box {
  const width = Math.min(columnWidth, maxWidth);
  return { width, height: aspect > 0 ? width / aspect : 0 };
}

// A horizontal photo across the row: the row's width, unless that would make
// it taller than the cap, then narrower; never under the 320px floor.
export function wideBox(aspect: number, rowWidth: number, maxHeight: number): Box {
  const fitted = fitWhole(aspect, rowWidth, maxHeight);
  const width = Math.min(rowWidth, Math.max(fitted.width, MIN_PHOTO_WIDTH));
  return { width, height: aspect > 0 ? width / aspect : 0 };
}

export type StageFit = "each" | "tallest";

// The phone stage: each photo fitted whole inside the panel's inner width
// and the height cap. "each" lets the stage take each photo's height (it
// eases between them, the brief's reading); "tallest" holds the tallest
// photo's height so the text under it never moves.
export function stageLayout(aspects: readonly number[], innerWidth: number, maxHeight: number, fit: StageFit) {
  const boxes = aspects.map((aspect) => fitWhole(aspect, innerWidth, maxHeight));
  const tallest = boxes.reduce((most, box) => Math.max(most, box.height), 0);
  const heights = boxes.map((box) => (fit === "tallest" ? tallest : box.height));
  return { boxes, heights, tallest };
}

// next/image `sizes` for a modal photo drawn at a known width on desktop and
// the panel's inner width under the breakpoint, scaled up when the source is
// wider than the box it is drawn into with object-fit: cover.
export function gallerySizes(sourceAspect: number, drawnAspect: number, desktopWidth: number, breakpoint = 1024, phoneInset = 72) {
  const scale = Number(coverScale(sourceAspect, drawnAspect).toFixed(3));
  const phone = scale === 1 ? `calc(100vw - ${phoneInset}px)` : `calc((100vw - ${phoneInset}px) * ${scale})`;
  return `(max-width: ${breakpoint - 1}px) ${phone}, ${Math.ceil(desktopWidth * scale)}px`;
}
