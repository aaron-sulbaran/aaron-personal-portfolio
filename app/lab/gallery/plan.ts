import { fitWhole, isWide, type Box } from "./rows";

// Round four (Aaron, 2026-10-09): one layout for every card, modelled on
// Capital One. The header leads at the top left, then every photo, the card
// picture included, gets its own row with its words beside it, the sides
// alternating; on a phone the same rows become pages of a pager. Round five
// (rotatingPlan) keeps the rows and lets photos with no words of their own
// take turns beside a block instead of waiting on a placeholder. Pure, so
// the tests read it and the site build can lift it.

export interface PlanPhoto {
  // The block the photo names (photos.md). Undefined, or a block the card
  // lacks, names none.
  block?: number;
}

export interface Slide {
  photo: number;
  // Round five: the photos that take turns in this row's frame, `photo`
  // first; one photo is a still. Set on every round five slide and page,
  // which never shows a placeholder.
  photos?: number[];
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

// A slide and where it falls among the blocks, for the arranging.
type Placed = { slide: Slide; at: number };

// Which words go beside which photo. The card picture takes the first block
// (it led beside it in round three); every other photo takes the block it
// names when no earlier photo took it, else a placeholder. Blocks nobody
// took ride with the nearest photo, or open or close the card.
export function photoPlan(blockCount: number, photos: readonly PlanPhoto[], lead?: number): Plan {
  return arrange(blockCount, claimWords(blockCount, photos, lead));
}

function claimWords(blockCount: number, photos: readonly PlanPhoto[], lead?: number): Placed[] {
  const valid = (b: number | undefined): b is number => b !== undefined && Number.isInteger(b) && b >= 0 && b < blockCount;
  const claimed = new Set<number>();
  return photoOrder(photos, blockCount, lead).map((photo) => {
    const named = photo === lead && blockCount > 0 ? 0 : photos[photo].block;
    const own = valid(named) && !claimed.has(named) ? named : undefined;
    if (own !== undefined) claimed.add(own);
    // A photo whose block was taken follows the photo that took it.
    const at = own !== undefined ? own : valid(named) ? named + 0.5 : Infinity;
    return { slide: { photo, own, before: [], after: [] }, at };
  });
}

function arrange(blockCount: number, placed: readonly Placed[]): Plan {
  const claimed = new Set(placed.flatMap(({ slide }) => (slide.own === undefined ? [] : [slide.own])));
  type Item = { kind: "slide"; slide: Slide; at: number } | { kind: "text"; block: number; at: number };
  const items: Item[] = placed.map(({ slide, at }) => ({ kind: "slide", slide, at }));
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

// Round five (Aaron, 2026-10-09): "if there are not enough sentences ...
// just the photo rotates, and the actual text itself stays." With N photos
// and P blocks:
// - N <= P keeps round four's rows, a photo each, but every photo gets
//   words: a photo whose block another took takes the first block nobody
//   took between the photos around it. One with none free joins a
//   neighbour's turns (the row before, or the row after when the row before
//   is the card picture's).
// - N > P: the card picture (the first photo on a logo card) stands still
//   beside the first block, where the flight lands; every later block gets a
//   group of the remaining photos taking turns beside it, in order, the
//   extras going to the later rows (Mentorship: the last block with photos
//   2, 3 and 4). With one block every photo takes turns beside it, the card
//   picture first.
export function rotatingPlan(blockCount: number, photos: readonly PlanPhoto[], lead?: number): Plan {
  if (photos.length <= blockCount) return arrange(blockCount, giveEveryPhotoWords(claimWords(blockCount, photos, lead), blockCount, lead));
  const order = photoOrder(photos, blockCount, lead);
  const group = (members: number[], own?: number): Slide => ({ photo: members[0], photos: members, own, before: [], after: [] });
  if (blockCount <= 1) return { intro: [], slides: [group(order, blockCount === 1 ? 0 : undefined)], closing: [] };
  const [first, ...rest] = order;
  const rows = blockCount - 1;
  const base = Math.floor(rest.length / rows);
  const extra = rest.length % rows;
  const slides = [group([first], 0)];
  let taken = 0;
  for (let row = 0; row < rows; row++) {
    const size = base + (row >= rows - extra ? 1 : 0);
    slides.push(group(rest.slice(taken, taken + size), row + 1));
    taken += size;
  }
  return { intro: [], slides, closing: [] };
}

function giveEveryPhotoWords(placed: Placed[], blockCount: number, lead?: number): Placed[] {
  const owns = (list: readonly Placed[]) => list.flatMap(({ slide }) => (slide.own === undefined ? [] : [slide.own]));
  const taken = new Set(owns(placed));
  placed.forEach((item, i) => {
    if (item.slide.own !== undefined) return;
    const below = Math.max(-1, ...owns(placed.slice(0, i)));
    const above = Math.min(blockCount, ...owns(placed.slice(i + 1)));
    for (let b = below + 1; b < above; b++) {
      if (taken.has(b)) continue;
      item.slide.own = b;
      item.at = b;
      taken.add(b);
      return;
    }
  });
  const rows: Placed[] = [];
  let waiting: number[] = [];
  for (const { slide, at } of placed) {
    const previous = rows[rows.length - 1];
    if (slide.own !== undefined) {
      rows.push({ slide: { ...slide, photos: [slide.photo, ...waiting] }, at });
      waiting = [];
    } else if (previous && previous.slide.photo !== lead) previous.slide.photos!.push(slide.photo);
    else waiting.push(slide.photo);
  }
  const last = rows[rows.length - 1];
  if (last) last.slide.photos!.push(...waiting);
  else if (waiting.length) rows.push({ slide: { photo: waiting[0], photos: waiting, before: [], after: [] }, at: Infinity });
  return rows;
}

// The pager's pages: the plan's rows, the opening blocks on the first page
// and the closing ones on the last, so every page is one photo and its words.
export interface Page extends Slide {
  links: boolean;
  // Round six, B: a group's later page, its photo larger and its caption the
  // only words.
  wordless?: boolean;
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

// Round five on a phone: still one photo a page, a group's photos each on
// their own page with the group's words, so pages next to each other may
// repeat them (Aaron: "I think that's fine").
export function rotatingPages(plan: Plan): Page[] {
  const slides = plan.slides.flatMap((slide) => (slide.photos ?? [slide.photo]).map((photo) => ({ ...slide, photo, before: [...slide.before], after: [...slide.after] })));
  return pagesOf({ ...plan, slides });
}

// Round six on a phone (Aaron, 2026-10-09: round five's pages repeating a
// paragraph were "really, really sloppy"). How a group of photos that take
// turns on desktop sits in the pager:
// - "paragraph" (A): pages follow the words. A page is a row of the plan,
//   one paragraph (with any blocks riding beside it), and a group turns
//   inside that page's stage as the desktop frame does.
// - "photo" (B): a page a photo, but only a group's first page carries the
//   words; its later pages are the photo alone, larger, with its caption.
// - "strip" (C): a page a paragraph with the group's first photo; the rest
//   follow under the words as a strip of smaller frames.
// - "repeat": round five, a page a photo, a group's pages repeating its words.
export type PhoneGrouping = "paragraph" | "photo" | "strip" | "repeat";

export function phonePages(plan: Plan, grouping: PhoneGrouping): Page[] {
  if (grouping === "repeat") return rotatingPages(plan);
  if (grouping === "photo") return photoPages(plan);
  return pagesOf(plan);
}

// B: the links stay with the last page that has words, so a wordless page
// ends the card with its photo and caption alone.
export function photoPages(plan: Plan): Page[] {
  return pagesOf(plan).flatMap((page) => {
    const [first, ...rest] = page.photos ?? [page.photo];
    const wordless = rest.map((photo): Page => ({ photo, photos: [photo], own: undefined, before: [], after: [], links: false, wordless: true }));
    return [{ ...page, photo: first, photos: [first] }, ...wordless];
  });
}

// What a page's stage holds: one photo standing still, a group taking turns
// (A), or a group's first photo with the rest in a strip under the words (C).
export type StageKind = "still" | "turns" | "strip";

export function stageKind(page: Page, grouping: PhoneGrouping): StageKind {
  if ((page.photos?.length ?? 1) < 2) return "still";
  return grouping === "paragraph" ? "turns" : grouping === "strip" ? "strip" : "still";
}

// The photos a page's stage draws and the strip's, in order.
export function stagePhotos(page: Page, kind: StageKind): { stage: number[]; strip: number[] } {
  const group = page.photos ?? [page.photo];
  if (kind === "turns") return { stage: group, strip: [] };
  if (kind === "strip") return { stage: [group[0]], strip: group.slice(1) };
  return { stage: [page.photo], strip: [] };
}

// A page's stage: every photo it draws fitted whole inside the inner width
// and the height, and the frame that holds the largest of them, so a group
// taking turns never changes size and no photo is ever cropped by its stage.
export function pageStage(photos: readonly number[], aspects: readonly number[], innerWidth: number, height: number): { frame: Box; boxes: Box[] } {
  const boxes = photos.map((p) => fitWhole(aspects[p], innerWidth, height));
  return { frame: groupFrame(boxes), boxes };
}

// C's strip: two frames whole and a third peeking at the inner width. Each
// photo is fitted whole inside a square of the frame's width and stands on
// the frames' common floor, so every caption starts on one line.
export const STRIP_VISIBLE = 2.3;
export function stripLayout(aspects: readonly number[], innerWidth: number, gap: number) {
  const itemWidth = Math.max(0, (innerWidth - 2 * gap) / STRIP_VISIBLE);
  const boxes = aspects.map((aspect) => fitWhole(aspect, itemWidth, itemWidth));
  return { itemWidth, height: boxes.reduce((most, box) => Math.max(most, box.height), 0), boxes };
}

// For each page, the blocks an earlier page already shows: the repeat takes
// its own mask id, so no two parts of the pager share one.
export function repeatedBlocks(pages: readonly Page[]): number[][] {
  const seen = new Set<number>();
  return pages.map((page) => {
    const blocks = slideText(page).blocks;
    const repeated = blocks.filter((b) => seen.has(b));
    for (const b of blocks) seen.add(b);
    return repeated;
  });
}

// The text blocks a slide shows, in reading order, and whether it shows the
// placeholder between them (round four only; round five has none).
export function slideText(slide: Slide): { blocks: number[]; note: boolean } {
  return { blocks: [...slide.before, ...(slide.own === undefined ? [] : [slide.own]), ...slide.after], note: slide.own === undefined && slide.photos === undefined };
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

// The pager's stage: each page's photo fitted whole inside the inner width
// and the height, its stage exactly that tall, so a stage never crops its
// photo and a horizontal photo leaves its words the room a vertical one
// would take (the photo and its words travel together, so nothing jumps).
// The height is the cap, or less when the page is too short to leave the
// words their room, and never below a floor.
export function pagerStage(aspects: readonly number[], innerWidth: number, capPx: number, roomPx = Infinity, floorPx = 120) {
  const height = Math.max(floorPx, Math.min(capPx, roomPx));
  return { boxes: aspects.map((aspect) => fitWhole(aspect, innerWidth, height)), height };
}

// A box's area against another's, for the readout ("about the same size").
export const areaRatio = (a: Box, b: Box) => (a.width * a.height) / (b.width * b.height);

// A round five frame: big enough for every box in its group, so it never
// changes size as its photos take turns, each drawn at its own box inside.
export function groupFrame(boxes: readonly Box[]): Box {
  return boxes.reduce((frame, box) => ({ width: Math.max(frame.width, box.width), height: Math.max(frame.height, box.height) }), { width: 0, height: 0 });
}
