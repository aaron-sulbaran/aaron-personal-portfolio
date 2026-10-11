import { describe, expect, it } from "vitest";
import { galleryPlan, groupedPlan, namedPlan, pagesOf, phonePages, photoOrder, photoPages, slideWords, stageKind, type Plan } from "@/lib/gallery/plan";

// The rows as Aaron reads them: which photos, beside which words.
const rows = (plan: Plan) => plan.slides.map((slide) => ({ photos: slide.photos, words: slideWords(slide) }));
const beside = (...words: (number | undefined)[]) => words.map((word) => (word === undefined ? {} : { beside: word }));

describe("galleryPlan, words enough for every photo", () => {
  it("keeps a photo a row with the opening and closing words around them (Capital One)", () => {
    expect(galleryPlan(5, beside(1, 2, 3))).toEqual({
      intro: [0],
      slides: [
        { photo: 0, photos: [0], own: 1, before: [], after: [] },
        { photo: 1, photos: [1], own: 2, before: [], after: [] },
        { photo: 2, photos: [2], own: 3, before: [], after: [] },
      ],
      closing: [4],
    });
  });
  it("splits a run of free words between the rows around it (IEEE)", () => {
    const plan = galleryPlan(5, beside(0, 3, 4));
    expect(rows(plan)).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1], words: [2, 3] }, { photos: [2], words: [4] }]);
    expect([plan.intro, plan.closing]).toEqual([[], []]);
  });
  it("gives the card picture the first word and closes with the word nobody took (Hackathons)", () => {
    const plan = galleryPlan(4, beside(undefined, 1, 2), 0);
    expect(rows(plan)).toEqual([{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }]);
    expect(plan.closing).toEqual([3]);
  });
  it("gives a photo whose word the card picture took the next free word (Building in public)", () => {
    expect(rows(galleryPlan(3, beside(undefined, 0, 0), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }]);
  });
  it("lets a photo with no free word join the row before it, or the row after when that is the card picture's", () => {
    expect(rows(galleryPlan(3, beside(undefined, 2, undefined), 0))).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1, 2], words: [2] }]);
    expect(rows(galleryPlan(3, beside(undefined, 0, 1), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [2, 1], words: [1] }]);
  });
});

describe("galleryPlan, more photos than words", () => {
  it("stands the card picture still beside the first word and turns the rest beside the last (Mentorship, Misuki, Travel)", () => {
    expect(galleryPlan(2, beside(undefined, 0, 0, 1), 0)).toEqual({
      intro: [],
      slides: [{ photo: 0, photos: [0], own: 0, before: [], after: [] }, { photo: 1, photos: [1, 2, 3], own: 1, before: [], after: [] }],
      closing: [],
    });
  });
  it("gives every later word a group, the extras to the later rows (the band)", () => {
    expect(rows(galleryPlan(3, beside(undefined, 0, 1, 2), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2, 3], words: [2] }]);
    expect(rows(galleryPlan(3, Array.from({ length: 6 }, () => ({})), 0)).map((row) => row.photos)).toEqual([[0], [1, 2], [3, 4, 5]]);
  });
  it("stands a logo card's first photo still the same way (Anthropic)", () => {
    expect(rows(galleryPlan(2, beside(0, 1, 1)))).toEqual([{ photos: [0], words: [0] }, { photos: [1, 2], words: [1] }]);
  });
  it("never turns the card picture, even beside a lone word", () => {
    expect(rows(galleryPlan(1, beside(undefined, 0, 0), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1, 2], words: [] }]);
    expect(rows(galleryPlan(0, beside(undefined, undefined), 0))).toEqual([{ photos: [0], words: [] }, { photos: [1], words: [] }]);
    expect(rows(galleryPlan(0, beside(undefined, undefined)))).toEqual([{ photos: [0, 1], words: [] }]);
  });
  it("places every photo once and every word once, in order, for any card", () => {
    const cases: [number, (number | undefined)[], number | undefined][] = [
      [5, [1, 2, 3], undefined], [2, [0, 1, 1], undefined], [5, [0, 3, 4], undefined], [2, [undefined, 0, 0, 1], 0],
      [3, [undefined, 0, 1, 2], 0], [4, [undefined, 1, 2], 0], [3, [undefined, 0, 0], 0], [1, [], undefined], [2, [], undefined],
    ];
    for (const [words, named, lead] of cases) {
      const plan = galleryPlan(words, beside(...named), lead);
      expect(plan.slides.flatMap((slide) => slide.photos).sort((a, b) => a - b)).toEqual(named.map((_, i) => i));
      expect([...plan.intro, ...plan.slides.flatMap(slideWords), ...plan.closing]).toEqual(Array.from({ length: words }, (_, i) => i));
      if (lead !== undefined) expect(plan.slides[0].photos).toEqual([lead]);
    }
  });
  it("orders photos by the word they name, photos naming none last, the lead first", () => {
    expect(photoOrder(beside(2, undefined, 0), 3)).toEqual([2, 0, 1]);
    expect(photoOrder(beside(undefined, 1, 0), 3, 0)).toEqual([0, 2, 1]);
  });
});

describe("groupedPlan (the jobs timeline)", () => {
  it("keeps photos naming one entry together, beside it, and lets the other words ride with the rows", () => {
    const plan = groupedPlan(8, beside(4, 4, 6, 7));
    expect(plan.intro).toEqual([0, 1, 2, 3]);
    expect(rows(plan)).toEqual([{ photos: [0, 1], words: [4, 5] }, { photos: [2], words: [6] }, { photos: [3], words: [7] }]);
    expect(plan.closing).toEqual([]);
  });
  it("puts a photo naming nothing in the last group, and survives no photos", () => {
    // Photo 0 names word 1 and photo 1 names none: both sit in word 1's row; word 0 opens the card, word 2 closes it.
    const plan = groupedPlan(3, beside(1, undefined));
    expect(rows(plan)).toEqual([{ photos: [0, 1], words: [1] }]);
    expect([plan.intro, plan.closing]).toEqual([[0], [2]]);
    expect(groupedPlan(2, [])).toEqual({ intro: [0, 1], slides: [], closing: [] });
  });
});

describe("namedPlan (the band and Travel, as cards.md pairs them, no row without words)", () => {
  it("gives the card picture the first word and sends the photos that named it to the next row's rotation, behind that row's own", () => {
    expect(rows(namedPlan(3, beside(undefined, 0, 1, 2), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [2, 1], words: [1] }, { photos: [3], words: [2] }]);
  });
  it("makes the photos that named the first word a row of their own on the next free word when no row follows (Travel)", () => {
    const travel = namedPlan(2, beside(undefined, 0, 0, 0), 0);
    expect(rows(travel)).toEqual([{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }]);
    expect([travel.intro, travel.closing]).toEqual([[], []]);
  });
  it("never turns the card picture, and splits the words no photo names between the rows around them", () => {
    expect(rows(namedPlan(3, beside(undefined, 2), 0))).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1], words: [2] }]);
    expect(rows(namedPlan(4, beside(undefined, 3), 0))).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1], words: [2, 3] }]);
  });
  it("places every photo and word once, in order, with a word in every row while a word is left", () => {
    const cases: [number, (number | undefined)[]][] = [[3, [undefined, 0, 1, 2]], [2, [undefined, 0, 0, 0]], [3, [undefined, 2]], [2, [undefined]], [2, [undefined, 5]], [3, [undefined, 0, undefined]], [4, [undefined, 0, 0, 1, 3]]];
    for (const [words, named] of cases) {
      const plan = namedPlan(words, beside(...named), 0);
      expect(plan.slides[0].photos).toEqual([0]);
      expect(plan.slides.flatMap((slide) => slide.photos).sort((a, b) => a - b)).toEqual(named.map((_, i) => i));
      expect([...plan.intro, ...plan.slides.flatMap(slideWords), ...plan.closing].sort((a, b) => a - b)).toEqual(Array.from({ length: words }, (_, i) => i));
      expect(plan.slides.filter((slide) => slideWords(slide).length === 0).length, `${words} words, ${named}`).toBeLessThanOrEqual(Math.max(0, plan.slides.length - words));
    }
  });
  it("keeps a wordless row only when the card has one word beside several photos", () => {
    expect(rows(namedPlan(1, beside(undefined, 0, 0), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1, 2], words: [] }]);
    expect(rows(namedPlan(0, beside(undefined, undefined), 0))).toEqual([{ photos: [0], words: [] }, { photos: [1], words: [] }]);
  });
});

describe("pages on a phone", () => {
  const mentorship = galleryPlan(2, beside(undefined, 0, 0, 1), 0);
  it("A: a page a row, the opening words on the first page, the closing words and the links on the last", () => {
    const pages = pagesOf(galleryPlan(5, beside(1, 2, 3)));
    expect(pages.map((page) => [page.photos, slideWords(page), page.links])).toEqual([[[0], [0, 1], false], [[1], [2], false], [[2], [3, 4], true]]);
    expect(phonePages(mentorship, "paragraph").map((page) => stageKind(page, "paragraph"))).toEqual(["still", "turns"]);
  });
  it("B: a group's later photos become wordless pages, and the links stay on the last page with words", () => {
    const pages = photoPages(mentorship);
    expect(pages.map((page) => [page.photo, slideWords(page), !!page.wordless, page.links])).toEqual([[0, [0], false, false], [1, [1], false, true], [2, [], true, false], [3, [], true, false]]);
    expect(pages.every((page) => stageKind(page, "photo") === "still")).toBe(true);
  });
  it("C: a group is a strip under its page's words", () => {
    expect(phonePages(mentorship, "strip").map((page) => stageKind(page, "strip"))).toEqual(["still", "strip"]);
  });
  it("gives a card with no photos no pages", () => {
    expect(pagesOf(galleryPlan(2, []))).toEqual([]);
  });
});
