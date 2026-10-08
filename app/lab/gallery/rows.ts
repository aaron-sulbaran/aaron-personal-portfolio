import { coverScale } from "@/lib/photoSizes";

// The desktop gallery as plain data: which block sits beside which photo, the
// side each photo takes, and how wide the text column is left. No DOM, so the
// lab's tests read it and the site build can lift it as is.

export type Side = "left" | "right";

export type Row =
  | { kind: "pair"; block: number; photo: number; side: Side }
  | { kind: "text"; block: number }
  | { kind: "photos"; photos: number[]; side: Side };

export interface PhotoRef {
  // The block this photo belongs beside (photos.md). Undefined, or a block the
  // card does not have, makes it an extra that follows the last block.
  block?: number;
}

// Each paired photo sits beside its block, alternating sides from the left.
// Extras follow the last block, up to `extrasPerRow` to a row, and keep the
// alternation going. A card with one block puts every photo after it
// (modal-gallery.md, "Desktop"). A second photo naming a block already taken
// becomes an extra rather than crowding the row.
export function interleave(blockCount: number, photos: readonly PhotoRef[], extrasPerRow = 2): Row[] {
  const pairedTo = new Map<number, number>();
  const extras: number[] = [];
  photos.forEach((photo, index) => {
    const block = photo.block;
    const pairable = blockCount > 1 && block !== undefined && Number.isInteger(block) && block >= 0 && block < blockCount && !pairedTo.has(block);
    if (pairable) pairedTo.set(block, index);
    else extras.push(index);
  });

  const rows: Row[] = [];
  let photoRows = 0;
  const nextSide = (): Side => (photoRows++ % 2 === 0 ? "left" : "right");
  for (let block = 0; block < blockCount; block++) {
    const photo = pairedTo.get(block);
    rows.push(photo === undefined ? { kind: "text", block } : { kind: "pair", block, photo, side: nextSide() });
  }
  const perRow = Math.max(1, Math.floor(extrasPerRow));
  for (let i = 0; i < extras.length; i += perRow) {
    rows.push({ kind: "photos", photos: extras.slice(i, i + perRow), side: nextSide() });
  }
  return rows;
}

// The order the photos are read in on desktop, which is also the phone
// stage's order, so the two never disagree.
export function readingOrder(rows: readonly Row[]): number[] {
  return rows.flatMap((row) => (row.kind === "pair" ? [row.photo] : row.kind === "photos" ? row.photos : []));
}

export const MIN_TEXT_WIDTH = 280;

// The text column beside a photo: the panel's inner width less the photo and
// the gap between them.
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

export const PHOTO_ASPECT = 3 / 4;

// The phone stage: a 3:4 photo no taller than its share of the visible height
// and no wider than the panel's inner width.
export function stageBox(innerWidth: number, viewportHeight: number, maxHeightPercent: number) {
  const maxHeight = (viewportHeight * maxHeightPercent) / 100;
  const width = Math.min(innerWidth, maxHeight * PHOTO_ASPECT);
  const height = width / PHOTO_ASPECT;
  return { width, height, share: viewportHeight > 0 ? height / viewportHeight : 0, heightBound: width < innerWidth };
}

// next/image `sizes` for a gallery photo: the stage under the breakpoint, the
// row photo from it, each scaled up when a source wider than 3:4 is drawn with
// object-fit: cover (lib/photoSizes.ts coverScale).
export function gallerySizes(sourceAspect: number, desktopPhotoWidth: number, breakpoint = 1024, phoneInset = 72) {
  const scale = Number(coverScale(sourceAspect).toFixed(3));
  const phone = scale === 1 ? `calc(100vw - ${phoneInset}px)` : `calc((100vw - ${phoneInset}px) * ${scale})`;
  return `(max-width: ${breakpoint - 1}px) ${phone}, ${Math.ceil(desktopPhotoWidth * scale)}px`;
}
