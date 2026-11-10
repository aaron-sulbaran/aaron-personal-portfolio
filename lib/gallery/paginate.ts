// How a phone's pager lays a card's pages out so that every page shows a photo and words, and nothing scrolls inside a page: the pure
// half (components/card/CardPager measures the numbers, lib/gallery/plan repage lays the pages out from the result).
//
// A unit is one page of the card's plan: its photos (one, or a group that takes turns) and the words the desktop pairs them with, as
// blocks in order (each paragraph, then one block for each of Mentorship's mentors, then the end block, the card's links). In Aaron's
// order of preference (2026-10-30):
//   1. Pair. The unit stays one page and its stage gets shorter, down to a floor, so its words fit beside its photos (a photo on a
//      short stage is cropped about its subject rather than shrunk, lib/gallery/boxes phoneBox).
//   2. Carry. Words that cannot fit beside even the floor break between blocks (never inside a paragraph) into as few pages as hold
//      them, cut as evenly as they can be (the shortest stage as tall as it can be). A group's photos are dealt out over those pages,
//      the first photos first; a page past the group carries a photo already shown (the group's again, in turn, or the one photo),
//      drawn again without its caption. The end block never stands alone: the card's links ride on a page with words.
//   3. Trim. A paragraph too tall to fit beside a floor stage on any page is named, and the pager drops its phone omissions (whole
//      sentences, lib/content cards' phoneOmit) one at a time and measures again. One with nothing left to drop keeps a page of its
//      own at the floor, and its words scroll there (a very short window).

export const END = "end";
// A mentor's block: the first carries the mentors' heading, and a mentor is never split from their line.
export const mentorId = (index: number) => `m${index}`;
// A name tag's block on a phone (the jobs card's, components/card/JobTagFold), by its photo's index: it follows its paragraph like a
// mentor follows hers, and is carried onto the unit's next page with a photo of its own when the page has no room for it.
export const tagId = (photo: number) => `t${photo}`;

export interface BlockSize {
  id: string; // "w3" (word unit 3), "m2" (mentor 2), "t6" (the name tag that is photo 6), or END
  height: number; // px
}

export interface UnitMeasure {
  unit: number; // the plan page's index among the card's phone pages
  photos: readonly number[]; // its stage's photos, in order (two or more take turns)
  captions: readonly number[]; // px, each photo's caption, in the order of photos (0: none)
  own?: number; // a stage with a height of its own (a name tag, the post's card): its natural height. It shrinks only to fitFloor of it
  floor?: number; // this stage's own floor where it is lower than the rules' (wide photos: still most of the page's width on a shorter stage)
  blocks: readonly BlockSize[];
}

export interface PageRules {
  room: number; // the pages' area
  cap: number; // a photo stage's tallest beside words
  wordlessCap: number; // and on a page with no words
  floor: number; // a photo stage's shortest
  pageGap: number; // between a page's stage, its caption and its words
  blockGap: number; // between the blocks of a page's words
  fitFloor: number; // the least an own stage is scaled to
}

export interface Chunk {
  photos: number[]; // the page's stage: one photo, or a group that takes turns
  carried?: true; // shown on an earlier page, drawn again without its caption
  stage: number; // px: the stage's height (an own stage's: the room it may take)
  units: number[];
  end: boolean; // the end block (the card's links) is on this page
  // Which mentors are on this page. Present on every chunk of a unit that has mentor blocks (an empty list when none is here), absent
  // on a unit that has none, so a page with no mentor blocks to place is told nothing about them.
  mentors?: number[];
  // Which name tags are on this page, by photo, on the same terms as mentors.
  tags?: number[];
}

// Every unit's pages, by unit.
export type Shape = Readonly<Record<number, readonly Chunk[]>>;
// tooTall: the word blocks ("w3") that could not fit beside a floor stage on a page of their own.
export interface Paged { shape: Shape; tooTall: string[] }

const indexed = (blocks: readonly BlockSize[], prefix: string) => blocks.filter((block) => block.id.startsWith(prefix)).map((block) => Number(block.id.slice(1)));

const wordsOf = (blocks: readonly BlockSize[], withMentors: boolean, withTags = false) => ({
  units: indexed(blocks, "w"),
  end: blocks.some((block) => block.id === END),
  ...(withMentors ? { mentors: indexed(blocks, "m") } : {}),
  ...(withTags ? { tags: indexed(blocks, "t") } : {}),
});

export const wordsHeight = (blocks: readonly BlockSize[], blockGap: number) => blocks.reduce((sum, block) => sum + block.height, 0) + blockGap * Math.max(0, blocks.length - 1);

// The stage a page's words leave it: the room less the words, the caption and the gaps between them, at most the cap.
export function stageRoom(words: number, caption: number, hasWords: boolean, rules: PageRules): number {
  const cap = hasWords ? rules.cap : rules.wordlessCap;
  return Math.min(cap, rules.room - words - (caption > 0 ? caption + rules.pageGap : 0) - (hasWords ? rules.pageGap : 0));
}

// Every way to cut n blocks, in order, into k runs, as the runs' lengths.
export function cuts(n: number, k: number): number[][] {
  if (k <= 0 || k > n) return [];
  if (k === 1) return [[n]];
  const out: number[][] = [];
  for (let first = 1; first <= n - k + 1; first++) for (const rest of cuts(n - first, k - 1)) out.push([first, ...rest]);
  return out;
}

// A group's photos dealt over k pages, in order: the first pages take one more when they do not divide evenly. Past the group (more
// pages than photos) each page carries one of them again, in turn.
export function dealPhotos(photos: readonly number[], k: number): { photos: number[]; carried: boolean }[] {
  const p = photos.length;
  if (p === 0) return Array.from({ length: k }, () => ({ photos: [], carried: false }));
  if (k > p) return Array.from({ length: k }, (_, i) => ({ photos: [photos[i % p]], carried: i >= p }));
  const base = Math.floor(p / k);
  const extra = p % k;
  let at = 0;
  return Array.from({ length: k }, (_, i) => {
    const size = base + (i < extra ? 1 : 0);
    const shown = photos.slice(at, at + size);
    at += size;
    return { photos: shown, carried: false };
  });
}

type Laid = { chunks: Chunk[]; least: number; total: number };

// A page whose words cannot fit beside even the floor (they scroll there): its stage is the floor, or on a window too short for that, half
// of what the caption and gaps leave, so the words always keep an area of their own to scroll in.
const scrollingStage = (caption: number, rules: PageRules) => Math.min(rules.floor, Math.max(0, (rules.room - (caption > 0 ? caption + rules.pageGap : 0) - rules.pageGap) / 2));

function layUnit(unit: UnitMeasure, pageRules: PageRules, tooTall: string[]): Chunk[] {
  const { blocks, photos } = unit;
  const rules = unit.floor === undefined ? pageRules : { ...pageRules, floor: Math.min(pageRules.floor, unit.floor) };
  const withMentors = blocks.some((block) => block.id.startsWith("m"));
  const withTags = blocks.some((block) => block.id.startsWith("t"));
  if (unit.own !== undefined) {
    // A name tag, or the post's card with its paragraph under it: one page, the card shrunk to leave the paragraph its room.
    const words = wordsHeight(blocks, rules.blockGap);
    const stage = blocks.length ? rules.room - words - rules.pageGap : rules.room;
    if (blocks.length && stage < unit.own * rules.fitFloor - 0.5) tooTall.push(...blocks.filter((block) => block.id.startsWith("w")).map((block) => block.id));
    return [{ photos: [...photos], stage: Math.max(0, stage), ...wordsOf(blocks, withMentors, withTags) }];
  }
  const captionOf = (shown: readonly number[], carried: boolean) => (carried ? 0 : Math.max(0, ...shown.map((photo) => unit.captions[photos.indexOf(photo)] ?? 0)));
  if (blocks.length === 0) return [{ photos: [...photos], stage: stageRoom(0, captionOf(photos, false), false, rules), ...wordsOf(blocks, withMentors, withTags) }];

  // The tallest a block can be and still fit beside a floor stage on a page of its own, whichever of the unit's captions is there.
  const widest = captionOf(photos, false);
  const limit = rules.room - rules.floor - rules.pageGap - (widest > 0 ? widest + rules.pageGap : 0);
  const over = new Set<string>();
  const sized = blocks.map((block) => {
    if (block.id === END || block.height <= limit + 0.5) return block;
    if (block.id.startsWith("w")) tooTall.push(block.id);
    over.add(block.id);
    // Laid out as if it fitted, so it gets a page of its own with its stage at the floor; the trim (or the page's scroll) does the rest.
    return { ...block, height: Math.max(0, limit) };
  });

  const n = sized.length;
  const endAlone = (run: readonly BlockSize[]) => run.length === 1 && run[0].id === END;
  let best: Laid | null = null;
  for (let k = 1; k <= n && !best; k++) {
    const dealt = dealPhotos(photos, k);
    for (const lengths of cuts(n, k)) {
      let at = 0;
      const runs = lengths.map((length) => sized.slice(at, (at += length)));
      if (runs.some(endAlone)) continue;
      const chunks = runs.map((run, i): Chunk => {
        const { photos: shown, carried } = dealt[i];
        const caption = captionOf(shown, carried);
        const room = stageRoom(wordsHeight(run, rules.blockGap), caption, true, rules);
        const stage = run.some((block) => over.has(block.id)) ? Math.min(room, scrollingStage(caption, rules)) : room;
        return { photos: shown, ...(carried ? { carried: true as const } : {}), stage, ...wordsOf(run, withMentors, withTags) };
      });
      const least = Math.min(...chunks.map((chunk) => chunk.stage));
      if (least < rules.floor - 0.5) continue;
      const total = chunks.reduce((sum, chunk) => sum + chunk.stage, 0);
      if (!best || least > best.least + 0.5 || (least > best.least - 0.5 && total > best.total + 0.5)) best = { chunks, least, total };
    }
  }
  if (best) return best.chunks;
  // Nothing holds them even a block a page (the links with a paragraph that only just fits alone, or a window too short for the floor):
  // a block a page, the end block with the one before it. A page whose words do not fit names its paragraphs too tall, and its stage
  // stands at the floor (or half the room, scrollingStage) while its words scroll.
  const runs: BlockSize[][] = [];
  for (const block of blocks) {
    if (block.id === END && runs.length) runs[runs.length - 1].push(block);
    else runs.push([block]);
  }
  const dealt = dealPhotos(photos, runs.length);
  return runs.map((run, i) => {
    const { photos: shown, carried } = dealt[i];
    const caption = captionOf(shown, carried);
    const room = stageRoom(wordsHeight(run, rules.blockGap), caption, true, rules);
    const fits = room >= rules.floor - 0.5;
    if (!fits) for (const block of run) if (block.id.startsWith("w") && !tooTall.includes(block.id)) tooTall.push(block.id);
    return { photos: shown, ...(carried ? { carried: true as const } : {}), stage: fits ? room : scrollingStage(caption, rules), ...wordsOf(run, withMentors, withTags) };
  });
}

export function paginate(units: readonly UnitMeasure[], rules: PageRules): Paged {
  const shape: Record<number, readonly Chunk[]> = {};
  const tooTall: string[] = [];
  for (const unit of units) shape[unit.unit] = layUnit(unit, rules, tooTall);
  return { shape, tooTall };
}

// The phone omissions in use, by word unit: how many of each paragraph's omissions are dropped.
export type Trims = Readonly<Record<number, number>>;

// One more omission dropped from each paragraph named too tall that has one left; the same object when none has.
export function moreTrims(trims: Trims, tooTall: readonly string[], left: (unit: number) => number): Trims {
  const next: Record<number, number> = { ...trims };
  let changed = false;
  for (const id of tooTall) {
    if (!id.startsWith("w")) continue;
    const unit = Number(id.slice(1));
    const level = next[unit] ?? 0;
    if (level < left(unit)) {
      next[unit] = level + 1;
      changed = true;
    }
  }
  return changed ? next : trims;
}

// What a page holds, as a string: the same for the same pages, so the mask-in replays only when the pages themselves change.
const chunkKey = (chunk: Chunk) => `${chunk.photos.join(".")}${chunk.carried ? "^" : ""}:${chunk.units.join(".")}${chunk.mentors?.length ? `~${chunk.mentors.join(".")}` : ""}${chunk.tags?.length ? `#${chunk.tags.join(".")}` : ""}${chunk.end ? "+" : ""}`;

export const shapeKey = (shape: Shape): string =>
  Object.keys(shape)
    .map(Number)
    .sort((a, b) => a - b)
    .map((unit) => `${unit}=${shape[unit].map(chunkKey).join("|")}`)
    .join(";");

// The same with every stage's height (to the pixel), so the pager lays the pages out again when a stage changes.
export const layoutKey = (shape: Shape): string =>
  Object.keys(shape)
    .map(Number)
    .sort((a, b) => a - b)
    .map((unit) => `${unit}=${shape[unit].map((chunk) => `${chunkKey(chunk)}@${Math.round(chunk.stage)}`).join("|")}`)
    .join(";");

export const trimsKey = (trims: Trims): string =>
  Object.keys(trims)
    .map(Number)
    .sort((a, b) => a - b)
    .map((unit) => `${unit}:${trims[unit]}`)
    .join(",");
