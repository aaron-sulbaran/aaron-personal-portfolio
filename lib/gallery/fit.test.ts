import { describe, expect, it } from "vitest";
import { wordsToSplit } from "@/lib/gallery/fit";
import { splitWords, type Page } from "@/lib/gallery/plan";

describe("which words do not fit under their stage", () => {
  const units = [
    { photo: 4, stage: 409, words: 180 },
    { photo: 5, stage: 306, words: 206 },
    { photo: 6, stage: 200, words: 150 },
  ];
  it("splits the units whose stage, gap and words are taller than the room", () => {
    expect(wordsToSplit(units, 496, 12)).toEqual([4, 5]);
  });
  it("keeps one that fits to the pixel, and splits one that is a pixel over", () => {
    expect(wordsToSplit([{ photo: 1, stage: 300, words: 184 }], 496, 12)).toEqual([]);
    expect(wordsToSplit([{ photo: 1, stage: 300, words: 186 }], 496, 12)).toEqual([1]);
  });
  it("splits fewer with a taller room, and all with a shorter one", () => {
    expect(wordsToSplit(units, 546, 12)).toEqual([4]);
    expect(wordsToSplit(units, 300, 12)).toEqual([4, 5, 6]);
  });
});

describe("splitWords", () => {
  const page = (photo: number, own: number | undefined, over: Partial<Page> = {}): Page => ({ photo, photos: [photo], own, before: [], after: [], links: false, ...over });
  const pages = [page(4, 0), page(0, undefined, { wordless: true }), page(5, 1), page(9, 3, { links: true })];

  it("leaves every page alone when none is named", () => {
    expect(splitWords(pages, [])).toEqual(pages);
  });
  it("gives the named page's words a page of their own right after its stage, the stage wordless", () => {
    const split = splitWords(pages, [5]);
    expect(split.map((p) => [p.photo, p.own, p.wordless ?? false, p.wordsOnly ?? false])).toEqual([[4, 0, false, false], [0, undefined, true, false], [5, undefined, true, false], [5, 1, false, true], [9, 3, false, false]]);
  });
  it("carries the card's links with the words to their page, so the stage page has none", () => {
    const split = splitWords(pages, [9]);
    expect(split.slice(-2).map((p) => [p.photo, p.links, p.wordsOnly ?? false])).toEqual([[9, false, false], [9, true, true]]);
  });
  it("keeps every paragraph once and in order, whatever is named", () => {
    const words = (list: Page[]) => list.flatMap((p) => (p.wordless ? [] : [p.own])).filter((own) => own !== undefined);
    expect(words(splitWords(pages, [4, 5, 9]))).toEqual(words(pages));
  });
  it("does not split a page that has no words", () => {
    expect(splitWords(pages, [0])).toEqual(pages);
  });
});
