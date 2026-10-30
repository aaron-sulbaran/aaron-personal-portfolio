import { describe, expect, it } from "vitest";
import { END, heightOf, paginate, shapeKey, type UnitMeasure } from "@/lib/gallery/paginate";
import { repage, type Page } from "@/lib/gallery/plan";

const rules = { blockGap: 16, endPad: 24 };
const block = (id: string, height: number) => ({ id, height });

describe("paginate", () => {
  it("leaves a unit alone when all its words fit beside its stage", () => {
    const units: UnitMeasure[] = [{ photo: 3, above: 400, blocks: [block("w0", 120)] }];
    expect(paginate(units, 546, rules)).toEqual({});
  });
  it("sends words that do not fit beside the stage to a page of their own", () => {
    const units: UnitMeasure[] = [{ photo: 3, above: 400, blocks: [block("w0", 180)] }];
    expect(paginate(units, 546, rules)).toEqual({ 3: { stage: { units: [], end: false }, more: [{ units: [0], end: false }] } });
  });
  it("keeps the first paragraphs beside the stage while they fit, and the rest follow on pages that hold them", () => {
    const units: UnitMeasure[] = [{ photo: 1, above: 300, blocks: [block("w0", 100), block("w1", 100), block("w2", 200), block("w3", 200), block("w4", 100)] }];
    // beside the stage: 100 + 16 + 100 + 24 = 240 <= 246, a third would be 456; then 200 + 16 + 200 + 24 = 440 <= 546, a fifth would be 556.
    expect(paginate(units, 546, rules)).toEqual({ 1: { stage: { units: [0, 1], end: false }, more: [{ units: [2, 3], end: false }, { units: [4], end: false }] } });
  });
  it("breaks one run of words between paragraphs when it is taller than a page, never inside one", () => {
    const units: UnitMeasure[] = [{ photo: 0, above: 500, blocks: [block("w0", 300), block("w1", 300)] }];
    const shape = paginate(units, 546, rules);
    expect(shape[0].more.map((chunk) => chunk.units)).toEqual([[0], [1]]);
  });
  it("puts the end block (mentors, links) on the last page of words when it fits there, else on a page of its own", () => {
    const fits = paginate([{ photo: 1, above: 500, blocks: [block("w0", 200), block(END, 100)] }], 546, rules);
    expect(fits[1].more).toEqual([{ units: [0], end: true }]);
    const alone = paginate([{ photo: 1, above: 500, blocks: [block("w0", 400), block(END, 200)] }], 546, rules);
    expect(alone[1].more).toEqual([{ units: [0], end: false }, { units: [], end: true }]);
  });
  it("gives a block taller than the whole room a page, and no more than one", () => {
    const shape = paginate([{ photo: 2, above: 300, blocks: [block("w0", 700), block("w1", 100)] }], 546, rules);
    expect(shape[2].more).toEqual([{ units: [0], end: false }, { units: [1], end: false }]);
  });
  it("takes a taller room as more words beside the stage", () => {
    const units: UnitMeasure[] = [{ photo: 5, above: 330, blocks: [block("w0", 170), block("w1", 120)] }];
    expect(paginate(units, 546, rules)[5].more.flatMap((chunk) => chunk.units)).toEqual([1]);
    expect(paginate(units, 700, rules)).toEqual({});
  });
  it("says the same thing twice for the same numbers, so measuring a page it laid out changes nothing", () => {
    const units: UnitMeasure[] = [{ photo: 1, above: 300, blocks: [block("w0", 100), block("w1", 300), block("w2", 300)] }];
    expect(shapeKey(paginate(units, 546, rules))).toBe(shapeKey(paginate(units, 546, rules)));
  });
  it("counts a page as its blocks, the gaps between them and the padding under the last", () => {
    expect(heightOf([block("w0", 100), block("w1", 50)], rules)).toBe(100 + 50 + 16 + 24);
  });
  it("names a shape", () => {
    expect(shapeKey({})).toBe("");
    expect(shapeKey({ 4: { stage: { units: [], end: false }, more: [{ units: [0, 1], end: true }] } })).toBe("4:|0.1+");
  });
});

describe("repage", () => {
  const page = (photo: number, units: number[], over: Partial<Page> = {}): Page => ({ photo, photos: [photo], before: [], own: units[0], after: units.slice(1), links: false, ...over });
  const pages = [page(4, [0]), page(0, [], { wordless: true }), page(5, [1, 2]), page(9, [3], { links: true })];
  const words = (list: Page[]) => list.flatMap((p) => [...p.before, ...(p.own === undefined ? [] : [p.own]), ...p.after]);

  it("leaves every page alone with no shape", () => {
    expect(repage(pages, {})).toEqual(pages);
  });
  it("lays a unit out as its stage's page, wordless when nothing shares it, then a page of words for each chunk", () => {
    const out = repage(pages, { 4: { stage: { units: [], end: false }, more: [{ units: [0], end: false }] } });
    expect(out.map((p) => [p.photo, words([p]), p.wordless ?? false, p.wordsOnly ?? false])).toEqual([[4, [], true, false], [4, [0], false, true], [0, [], true, false], [5, [1, 2], false, false], [9, [3], false, false]]);
  });
  it("keeps the first words on the stage's page when they fit beside it", () => {
    const out = repage(pages, { 5: { stage: { units: [1], end: false }, more: [{ units: [2], end: false }] } });
    expect(out.filter((p) => p.photo === 5).map((p) => [words([p]), p.wordless ?? false, p.wordsOnly ?? false])).toEqual([[[1], false, false], [[2], false, true]]);
  });
  it("carries the end block (the card's links) to the page the shape puts it on", () => {
    const out = repage(pages, { 9: { stage: { units: [], end: false }, more: [{ units: [3], end: false }, { units: [], end: true }] } });
    expect(out.filter((p) => p.photo === 9).map((p) => [words([p]), p.links, p.wordsOnly ?? false])).toEqual([[[], false, false], [[3], false, true], [[], true, true]]);
  });
  it("keeps every paragraph once and in order, whatever the shape", () => {
    const shape = { 5: { stage: { units: [], end: false }, more: [{ units: [1], end: false }, { units: [2], end: false }] }, 9: { stage: { units: [3], end: true }, more: [] } };
    expect(words(repage(pages, shape))).toEqual(words(pages));
  });
});
