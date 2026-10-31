import { describe, expect, it } from "vitest";
import { cuts, dealPhotos, END, layoutKey, mentorId, moreTrims, paginate, shapeKey, stageRoom, trimsKey, wordsHeight, type PageRules, type UnitMeasure } from "@/lib/gallery/paginate";
import { repage, slideWords, type Page } from "@/lib/gallery/plan";

// A 600px tall area, a 338px cap (40 percent of 844), a 140px floor, and the pager's gaps.
const rules: PageRules = { room: 600, cap: 338, wordlessCap: 464, floor: 140, pageGap: 12, blockGap: 16, fitFloor: 0.8 };
const block = (id: string, height: number) => ({ id, height });
const unit = (over: Partial<UnitMeasure> & Pick<UnitMeasure, "blocks">): UnitMeasure => ({ unit: 0, photos: [0], captions: [40], ...over });
const words = (chunks: readonly { units: number[] }[]) => chunks.flatMap((chunk) => chunk.units);

describe("paginate: pair", () => {
  it("keeps a unit one page, its photo at the cap, when its words leave the room", () => {
    const { shape, tooTall } = paginate([unit({ blocks: [block("w0", 120)] })], rules);
    expect(shape[0]).toEqual([{ photos: [0], stage: 338, units: [0], end: false }]);
    expect(tooTall).toEqual([]);
  });
  it("shortens the stage, never the words, so a paragraph and its photo share a page (Capital One's first page)", () => {
    // 600 less the words (78 + 16 + 182), the caption and its gap (52) and the gap before the words (12): 260.
    const { shape } = paginate([unit({ blocks: [block("w0", 78), block("w1", 182)] })], rules);
    expect(shape[0]).toEqual([{ photos: [0], stage: 260, units: [0, 1], end: false }]);
  });
  it("keeps a group turning on one page while its words fit beside it, under the tallest of its captions", () => {
    const { shape } = paginate([unit({ photos: [1, 2, 3], captions: [20, 40, 20], blocks: [block("w1", 300)] })], rules);
    expect(shape[0]).toEqual([{ photos: [1, 2, 3], stage: 600 - 300 - 52 - 12, units: [1], end: false }]);
  });
  it("lets a stage of wide photos go under the floor to its own floor, so IEEE's plaque photo keeps both its paragraphs", () => {
    const blocks = [block("w2", 208), block("w3", 208)];
    // 600 - 432 - 52 - 12 = 104: under the 140px floor, over a wide photo's 100px one.
    expect(paginate([unit({ blocks })], rules).shape[0]).toHaveLength(2);
    expect(paginate([unit({ blocks, floor: 100 })], rules).shape[0]).toEqual([{ photos: [0], stage: 104, units: [2, 3], end: false }]);
    // A unit's floor never raises the rules' floor.
    expect(paginate([unit({ blocks: [block("w0", 300)], floor: 400 })], rules).shape[0][0].stage).toBe(236);
  });
  it("lays out a page with no words (a group's later photo) at the wordless cap", () => {
    expect(paginate([unit({ blocks: [] })], rules).shape[0]).toEqual([{ photos: [0], stage: 464, units: [], end: false }]);
  });
});

describe("paginate: carry", () => {
  it("breaks words between paragraphs onto a page that carries the photo again, without its caption, when they do not fit beside the floor", () => {
    // Together: 600 - 476 - 64 = 60, under the floor. Apart: 600 - 200 - 64 = 336 beside the photo, 600 - 260 - 12 = 328 carried.
    const { shape } = paginate([unit({ blocks: [block("w0", 200), block("w1", 260)] })], rules);
    expect(shape[0]).toEqual([
      { photos: [0], stage: 336, units: [0], end: false },
      { photos: [0], carried: true, stage: 328, units: [1], end: false },
    ]);
  });
  it("deals a group's photos over the pages, one each, before it carries any (Mentorship's mentors)", () => {
    const mentors = [146, 109, 135, 135, 109, 135].map((height, i) => block(mentorId(i), height));
    const { shape } = paginate([unit({ photos: [1, 2, 3], captions: [20, 20, 40], blocks: [block("w1", 104), ...mentors, block(END, 47)] })], rules);
    const chunks = shape[0];
    expect(chunks.map((chunk) => chunk.photos)).toEqual([[1], [2], [3]]);
    expect(chunks.every((chunk) => !chunk.carried && chunk.stage >= rules.floor)).toBe(true);
    expect(words(chunks)).toEqual([1]);
    expect(chunks.flatMap((chunk) => chunk.mentors ?? [])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(chunks.map((chunk) => chunk.end)).toEqual([false, false, true]);
    // Every page of the unit is told which mentors it has, the first page none but its paragraph's.
    expect(chunks.every((chunk) => Array.isArray(chunk.mentors))).toBe(true);
  });
  it("cuts the words as evenly as it can: the shortest stage of the fewest pages as tall as it can be", () => {
    const { shape } = paginate([unit({ photos: [1, 2], captions: [20, 20], blocks: [100, 100, 100, 100, 100, 100].map((height, i) => block(`w${i}`, height)) })], rules);
    // Two pages: three paragraphs each (332px of words, a 224px stage) beats four and two (448 and a 108px stage).
    expect(shape[0].map((chunk) => chunk.units)).toEqual([[0, 1, 2], [3, 4, 5]]);
    expect(shape[0].map((chunk) => chunk.stage)).toEqual([224, 224]);
  });
  it("carries the group's photos again, in turn, past the group", () => {
    const { shape } = paginate([unit({ photos: [1, 2], captions: [20, 20], blocks: [300, 300, 300].map((height, i) => block(`w${i}`, height)) })], rules);
    expect(shape[0].map((chunk) => [chunk.photos, !!chunk.carried])).toEqual([[[1], false], [[2], false], [[1], true]]);
  });
  it("never leaves the card's links alone on a page: they ride with the words before them", () => {
    const { shape } = paginate([unit({ blocks: [block("w0", 200), block("w1", 300), block(END, 40)] })], rules);
    expect(shape[0].map((chunk) => [chunk.units, chunk.end])).toEqual([[[0], false], [[1], true]]);
    for (const chunk of shape[0]) expect(chunk.units.length + (chunk.mentors?.length ?? 0), "words beside the links").toBeGreaterThan(0);
  });
  it("names a paragraph that only fits alone when the links must ride with it, so it can be trimmed", () => {
    const { shape, tooTall } = paginate([unit({ blocks: [block("w0", 380), block(END, 47)] })], rules);
    expect(tooTall).toEqual(["w0"]);
    expect(shape[0]).toEqual([{ photos: [0], stage: 140, units: [0], end: true }]);
  });
});

describe("paginate: trim", () => {
  it("names a paragraph too tall to fit beside a floor stage, and gives it a page of its own at the floor", () => {
    // The tallest that fits: 600 - 140 - 12 - 52 = 396.
    const { shape, tooTall } = paginate([unit({ blocks: [block("w0", 500), block("w1", 100)] })], rules);
    expect(tooTall).toEqual(["w0"]);
    expect(shape[0][0]).toMatchObject({ photos: [0], stage: 140, units: [0] });
    expect(words(shape[0])).toEqual([0, 1]);
  });
  it("drops one more omission from each paragraph named too tall, until it has none left", () => {
    const left = (unit: number) => (unit === 2 ? 2 : 0);
    const once = moreTrims({}, ["w2", "w3", END], left);
    expect(once).toEqual({ 2: 1 });
    const twice = moreTrims(once, ["w2"], left);
    expect(twice).toEqual({ 2: 2 });
    expect(moreTrims(twice, ["w2"], left)).toBe(twice);
    expect(trimsKey(twice)).toBe("2:2");
  });
});

describe("paginate: a window too short for the floor", () => {
  it("gives a page whose words must scroll half of what the caption leaves, so the words keep an area of their own", () => {
    // A 197px area (a 420px tall window): the floor and the caption leave the words nothing, so the stage takes (197 - 52 - 12) / 2.
    const short = { ...rules, room: 197, cap: 168 };
    const { shape, tooTall } = paginate([unit({ blocks: [block("w0", 300)] })], short);
    expect(tooTall).toEqual(["w0"]);
    expect(shape[0]).toEqual([{ photos: [0], stage: 66.5, units: [0], end: false }]);
  });
});

describe("paginate: a stage of its own (the jobs card)", () => {
  it("gives a name tag the whole room, and leaves the post's paragraph its room under the post's card", () => {
    const tag = unit({ unit: 1, photos: [4], captions: [0], own: 409, blocks: [] });
    const post = unit({ unit: 2, photos: [9], captions: [0], own: 237, blocks: [block("w3", 260)] });
    const { shape, tooTall } = paginate([tag, post], rules);
    expect(shape[1]).toEqual([{ photos: [4], stage: 600, units: [], end: false }]);
    expect(shape[2]).toEqual([{ photos: [9], stage: 600 - 260 - 12, units: [3], end: false }]);
    expect(tooTall).toEqual([]);
  });
  it("names the post's paragraph too tall when the card would shrink past its floor beside it", () => {
    const { tooTall } = paginate([unit({ photos: [9], captions: [0], own: 400, blocks: [block("w3", 300)] })], rules);
    expect(tooTall).toEqual(["w3"]);
  });
});

describe("paginate: parts", () => {
  it("counts words as their blocks and the gaps between them, and the stage as what the words leave", () => {
    expect(wordsHeight([block("w0", 100), block("w1", 50)], 16)).toBe(166);
    expect(stageRoom(250, 40, true, rules)).toBe(600 - 250 - 52 - 12);
    expect(stageRoom(100, 40, true, rules), "never past the cap").toBe(338);
    expect(stageRoom(0, 0, false, rules)).toBe(464);
  });
  it("cuts n blocks into k runs every way, in order", () => {
    expect(cuts(4, 2)).toEqual([[1, 3], [2, 2], [3, 1]]);
    expect(cuts(3, 3)).toEqual([[1, 1, 1]]);
    expect(cuts(2, 3)).toEqual([]);
  });
  it("deals photos over pages, the first pages taking one more, and carries them again in turn past the group", () => {
    expect(dealPhotos([1, 2, 3], 2)).toEqual([{ photos: [1, 2], carried: false }, { photos: [3], carried: false }]);
    expect(dealPhotos([1, 2, 3], 3).map((deal) => deal.photos)).toEqual([[1], [2], [3]]);
    expect(dealPhotos([5], 3)).toEqual([{ photos: [5], carried: false }, { photos: [5], carried: true }, { photos: [5], carried: true }]);
  });
  it("names the pages, and again with every stage's height, the same for the same layout", () => {
    const { shape } = paginate([unit({ blocks: [block("w0", 200), block("w1", 260)] })], rules);
    expect(shapeKey(shape)).toBe("0=0:0|0^:1");
    expect(layoutKey(shape)).toBe("0=0:0@336|0^:1@328");
    expect(shapeKey(paginate([unit({ blocks: [block("w0", 200), block("w1", 260)] })], rules).shape)).toBe(shapeKey(shape));
  });
});

describe("repage", () => {
  const page = (photo: number, units: number[], over: Partial<Page> = {}): Page => ({ photo, photos: [photo], before: [], own: units[0], after: units.slice(1), links: false, ...over });
  const pages = [page(0, [0, 1]), page(1, [2]), page(2, [3, 4], { links: true })];
  const allWords = (list: Page[]) => list.flatMap(slideWords);

  it("leaves every page as it is with no shape, naming each page's unit", () => {
    expect(repage(pages, {})).toEqual(pages.map((p, unit) => ({ ...p, unit })));
  });
  it("lays a unit out as its shape's pages: the stage's height, the photos, the words, a carried photo marked", () => {
    const out = repage(pages, { 0: [{ photos: [0], stage: 336, units: [0], end: false }, { photos: [0], carried: true, stage: 328, units: [1], end: false }] });
    expect(out.slice(0, 2).map((p) => [p.unit, p.part, p.photos, p.stage, slideWords(p), p.carried ?? false])).toEqual([
      [0, 0, [0], 336, [0], false],
      [0, 1, [0], 328, [1], true],
    ]);
    expect(out.slice(2).map((p) => p.unit)).toEqual([1, 2]);
  });
  it("deals a group out and carries Mentorship's mentors and the links to the pages the shape puts them on", () => {
    const group = [page(1, [1], { photos: [1, 2, 3], links: true })];
    const out = repage(group, { 0: [{ photos: [1], stage: 200, units: [1], end: false, mentors: [0] }, { photos: [2, 3], stage: 220, units: [], end: true, mentors: [1, 2] }] });
    expect(out.map((p) => [p.photo, p.photos, p.mentors, p.links])).toEqual([[1, [1], [0], false], [2, [2, 3], [1, 2], true]]);
  });
  it("keeps every paragraph once and in order, whatever the shape", () => {
    const shape = { 0: [{ photos: [0], stage: 300, units: [0], end: false }, { photos: [0], carried: true as const, stage: 300, units: [1], end: false }], 2: [{ photos: [2], stage: 250, units: [3, 4], end: true }] };
    expect(allWords(repage(pages, shape))).toEqual(allWords(pages));
  });
});
