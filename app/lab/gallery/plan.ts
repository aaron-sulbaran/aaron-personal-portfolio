import { fitWhole, isWide, type Box } from "./rows";

// Round four (Aaron, 2026-10-09): one layout for every card, modelled on
// Capital One. The header leads at the top left, then every photo, the card
// picture included, gets its own row with its words beside it, the sides
// alternating; on a phone the same rows become pages of a pager. Pure, so the
// tests read it and the site build can lift it.

export interface PlanPhoto {
  // The block the photo names (photos.md). Undefined, or a block the card
  // lacks, names none.
  block?: number;
}

export interface Slide {
  photo: number;
  // The block that belongs to this photo, or undefined when the photo has no
  // words of its own yet and shows Aaron's placeholder instead.
  own?: number;
  // Blocks no photo claimed, carried beside this photo so no paragraph sits
  // between two photos: the first half of a run after the photo before it,
  // the rest before the photo after it.
  before: number[];
  after: number[];
}

export interface Plan {
  // Blocks before the first photo's own words (Capital One's opening line)
  // and after the last one's (its closing line): full width on desktop, on
  // the first and last page of the pager.
  intro: number[];
  slides: Slide[];
  closing: number[];
}

// The card picture leads; the other photos follow in the order of the block
// they name, photos naming none last.
export function photoOrder(photos: readonly PlanPhoto[], blockCount: number, lead?: number): number[] {
  const valid = (b: number | undefined): b is number => b !== undefined && Number.isInteger(b) && b >= 0 && b < blockCount;
  const rest = photos.map((p, i) => ({ i, key: valid(p.block) ? p.block : Infinity })).filter(({ i }) => i !== lead);
  rest.sort((a, b) => a.key - b.key || a.i - b.i);
  const hasLead = lead !== undefined && lead >= 0 && lead < photos.length;
  return [...(hasLead ? [lead] : []), ...rest.map(({ i }) => i)];
}

// Which words go beside which photo. The card picture takes the first block
// (it led beside it in round three); every other photo takes the block it
// names when no earlier photo took it, else a placeholder. Blocks nobody
// took ride with the nearest photo, or open or close the card.
export function photoPlan(blockCount: number, photos: readonly PlanPhoto[], lead?: number): Plan {
  const valid = (b: number | undefined): b is number => b !== undefined && Number.isInteger(b) && b >= 0 && b < blockCount;
  const order = photoOrder(photos, blockCount, lead);
  const claimed = new Set<number>();
  type Item = { kind: "slide"; slide: Slide; at: number } | { kind: "text"; block: number; at: number };
  const items: Item[] = [];
  for (const photo of order) {
    const named = photo === lead && blockCount > 0 ? 0 : photos[photo].block;
    const own = valid(named) && !claimed.has(named) ? named : undefined;
    if (own !== undefined) claimed.add(own);
    // A photo whose block was taken follows the photo that took it.
    const at = own !== undefined ? own : valid(named) ? named + 0.5 : Infinity;
    items.push({ kind: "slide", slide: { photo, own, before: [], after: [] }, at });
  }
  for (let b = 0; b < blockCount; b++) if (!claimed.has(b)) items.push({ kind: "text", block: b, at: b });
  items.sort((x, y) => x.at - y.at || (x.kind === "slide" ? -1 : 1) - (y.kind === "slide" ? -1 : 1));

  const slides = items.flatMap((item) => (item.kind === "slide" ? [item.slide] : []));
  const intro: number[] = [];
  const closing: number[] = [];
  let previous: Slide | undefined;
  let run: number[] = [];
  for (const item of items) {
    if (item.kind === "text") {
      run.push(item.block);
      continue;
    }
    if (!previous) intro.push(...run);
    else {
      const half = Math.ceil(run.length / 2);
      previous.after.push(...run.slice(0, half));
      item.slide.before.push(...run.slice(half));
    }
    run = [];
    previous = item.slide;
  }
  if (previous) closing.push(...run);
  else intro.push(...run);
  return { intro, slides, closing };
}

// The pager's pages: the plan's rows, the opening blocks on the first page
// and the closing ones on the last, so every page is one photo and its words.
export interface Page extends Slide {
  links: boolean;
}

export function pagesOf(plan: Plan): Page[] {
  const last = plan.slides.length - 1;
  return plan.slides.map((slide, i) => ({
    ...slide,
    before: i === 0 ? [...plan.intro, ...slide.before] : slide.before,
    after: i === last ? [...slide.after, ...plan.closing] : slide.after,
    links: i === last,
  }));
}

// The text blocks a slide shows, in reading order, and whether it shows the
// placeholder between them.
export function slideText(slide: Slide): { blocks: number[]; note: boolean } {
  return { blocks: [...slide.before, ...(slide.own === undefined ? [] : [slide.own]), ...slide.after], note: slide.own === undefined };
}

// Desktop: one vertical box and one horizontal box, every photo of each
// orientation drawn in exactly its box (cropped to it, the same size every
// time). The vertical box is the card picture's 3:4.
export const VERTICAL_SHAPE = 3 / 4;
export const HORIZONTAL_SHAPES = { "4:3": 4 / 3, "3:2": 3 / 2 } as const;
export type HorizontalShape = keyof typeof HORIZONTAL_SHAPES;

export interface Boxes {
  vertical: Box;
  horizontal: Box;
}

export function uniformBoxes(verticalWidth: number, horizontalWidth: number, horizontalShape: HorizontalShape): Boxes {
  const aspect = HORIZONTAL_SHAPES[horizontalShape];
  return {
    vertical: { width: verticalWidth, height: verticalWidth / VERTICAL_SHAPE },
    horizontal: { width: horizontalWidth, height: horizontalWidth / aspect },
  };
}

export const boxFor = (aspect: number, boxes: Boxes, wideFrom: number): Box => (isWide(aspect, wideFrom) ? boxes.horizontal : boxes.vertical);

// The photo column is as wide as the widest box this card uses, so the text
// column sits in the same place on every row of one card; the panel is that
// column, the gap and the text column, plus its padding.
export function uniformColumns(aspects: readonly number[], boxes: Boxes, wideFrom: number, columnGap: number, textWidth: number, padding: number) {
  const slot = aspects.reduce((widest, aspect) => Math.max(widest, boxFor(aspect, boxes, wideFrom).width), 0);
  return { slot, panel: 2 * padding + slot + columnGap + textWidth };
}

// The pager's stage: every photo of the card fitted whole inside the inner
// width and the stage height, the stage as tall as the tallest of them, so
// the stage never changes height between pages and never crops a photo. The
// height is the cap, or less when the page is too short to leave the words
// their room, and never below a floor.
export function pagerStage(aspects: readonly number[], innerWidth: number, capPx: number, roomPx = Infinity, floorPx = 120) {
  const height = Math.max(floorPx, Math.min(capPx, roomPx));
  const boxes = aspects.map((aspect) => fitWhole(aspect, innerWidth, height));
  const tallest = boxes.reduce((most, box) => Math.max(most, box.height), 0);
  return { boxes, height: tallest };
}

// A box's area against another's, for the readout ("about the same size").
export const areaRatio = (a: Box, b: Box) => (a.width * a.height) / (b.width * b.height);
