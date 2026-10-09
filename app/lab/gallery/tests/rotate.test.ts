import { describe, expect, it } from "vitest";
import { CARDS, drawnShape } from "../cards";
import { groupingOf } from "../cardSteps";
import { groupFrame, pagesOf, photoPlan, repeatedBlocks, rotatingPages, rotatingPlan, slideText, uniformBoxes, type Plan } from "../plan";
import { exportValues, INITIAL, PRESETS } from "../settings";
import { remainingAfter, ROTATOR_VISIBLE, rotatorRuns, type RotatorGate } from "../stage";
import { pagerSteps, planSteps } from "../timing";

const card = (id: string) => CARDS.find((c) => c.id === id)!;
const rotating = (id: string) => {
  const c = card(id);
  return rotatingPlan(c.blocks.length, c.photos, c.flownPhoto);
};
const roundFour = (id: string) => {
  const c = card(id);
  return photoPlan(c.blocks.length, c.photos, c.flownPhoto);
};
// The rows as Aaron reads them: which photos, beside which blocks.
const rows = (plan: Plan) => plan.slides.map((s) => ({ photos: s.photos ?? [s.photo], words: slideText(s).blocks }));
const all = () => true;

describe("rotatingPlan, words enough for every photo", () => {
  it("keeps round four's rows unchanged where every photo already had words (Capital One, Hackathons, IEEE)", () => {
    for (const id of ["capital-one", "hackathons", "ieee"]) {
      const plan = rotating(id);
      expect({ ...plan, slides: plan.slides.map(({ photos, ...slide }) => slide) }).toEqual(roundFour(id));
      expect(plan.slides.every((s) => s.photos?.length === 1)).toBe(true);
    }
  });

  it("gives a photo whose block the card picture took the next free block instead of a placeholder (Building in public)", () => {
    expect(rows(roundFour("building-in-public"))).toEqual([
      { photos: [0], words: [0] },
      { photos: [1], words: [] },
      { photos: [2], words: [] },
    ]);
    expect(rows(rotating("building-in-public"))).toEqual([
      { photos: [0], words: [0] },
      { photos: [1], words: [1] },
      { photos: [2], words: [2] },
    ]);
    expect(rotating("building-in-public").closing).toEqual([]);
  });

  it("lets a photo with no free block join the row before it, or the row after when that is the card picture", () => {
    // Block 1 sits between the card picture and the photo that took block 2,
    // so the photo naming none has nothing free after it: it joins block 2.
    expect(rows(rotatingPlan(3, [{}, { block: 2 }, {}], 0))).toEqual([
      { photos: [0], words: [0, 1] },
      { photos: [1, 2], words: [2] },
    ]);
    // A photo naming the card picture's block, the next block free: it takes it.
    expect(rows(rotatingPlan(2, [{}, { block: 0 }], 0))).toEqual([
      { photos: [0], words: [0] },
      { photos: [1], words: [1] },
    ]);
    // Nothing free between the card picture and the next photo's block: the
    // card picture stays still and the photo joins the row after.
    expect(rows(rotatingPlan(3, [{}, { block: 0 }, { block: 1 }], 0))).toEqual([
      { photos: [0], words: [0] },
      { photos: [2, 1], words: [1] },
    ]);
  });
});

describe("rotatingPlan, more photos than words", () => {
  it("stands the card picture still beside the first block and turns photos 2, 3 and 4 beside the last (Mentorship, Aaron's example)", () => {
    expect(rotating("mentorship")).toEqual({
      intro: [],
      slides: [
        { photo: 0, photos: [0], own: 0, before: [], after: [] },
        { photo: 1, photos: [1, 2, 3], own: 1, before: [], after: [] },
      ],
      closing: [],
    });
    expect(rows(rotating("misuki"))).toEqual([
      { photos: [0], words: [0] },
      { photos: [1, 2, 3], words: [1] },
    ]);
  });

  it("stands a logo card's first photo still the same way (Anthropic)", () => {
    expect(rows(rotating("anthropic"))).toEqual([
      { photos: [0], words: [0] },
      { photos: [1, 2], words: [1] },
    ]);
  });

  it("gives every later block a group, the extras going to the later rows", () => {
    const six = Array.from({ length: 6 }, () => ({}));
    expect(rows(rotatingPlan(3, six, 0))).toEqual([
      { photos: [0], words: [0] },
      { photos: [1, 2], words: [1] },
      { photos: [3, 4, 5], words: [2] },
    ]);
    expect(rows(rotatingPlan(3, six.slice(0, 4), 0)).map((r) => r.photos)).toEqual([[0], [1], [2, 3]]);
  });

  it("turns every photo beside a lone block, the card picture first, and survives no blocks", () => {
    expect(rows(rotatingPlan(1, [{ block: 0 }, {}, { block: 0 }], 1))).toEqual([{ photos: [1, 0, 2], words: [0] }]);
    expect(rows(rotatingPlan(0, [{}, {}]))).toEqual([{ photos: [0, 1], words: [] }]);
  });

  it("never shows a placeholder, places every photo once and every block once, in order", () => {
    for (const c of CARDS) {
      const plan = rotatingPlan(c.blocks.length, c.photos, c.flownPhoto);
      expect(plan.slides.flatMap((s) => s.photos!).sort()).toEqual(c.photos.map((_, i) => i));
      if (c.flownPhoto !== undefined) expect(plan.slides[0].photos).toEqual([c.flownPhoto]);
      expect(plan.slides.some((s) => slideText(s).note)).toBe(false);
      const blocks = [...plan.intro, ...plan.slides.flatMap((s) => slideText(s).blocks), ...plan.closing];
      expect(blocks).toEqual(c.blocks.map((_, b) => b));
    }
  });
});

describe("rotatingPages", () => {
  it("gives every photo its own page, a group's pages repeating its words, the links on the last", () => {
    const pages = rotatingPages(rotating("mentorship"));
    expect(pages.map((p) => [p.photo, slideText(p).blocks, p.links])).toEqual([
      [0, [0], false],
      [1, [1], false],
      [2, [1], false],
      [3, [1], true],
    ]);
    expect(pages.some((p) => slideText(p).note)).toBe(false);
    expect(repeatedBlocks(pages)).toEqual([[], [], [1], [1]]);
  });

  it("matches round four's pages where nothing takes turns (Capital One)", () => {
    const strip = (pages: ReturnType<typeof pagesOf>) => pages.map(({ photos, ...page }) => page);
    expect(strip(rotatingPages(rotating("capital-one")))).toEqual(pagesOf(roundFour("capital-one")));
  });
});

describe("the rotating frame", () => {
  it("holds the largest box of its group, so its size never changes between photos", () => {
    const boxes = uniformBoxes(320, 424, "4:3");
    expect(groupFrame([boxes.horizontal, boxes.horizontal])).toEqual({ width: 424, height: 318 });
    expect(groupFrame([boxes.vertical, boxes.horizontal])).toEqual({ width: 424, height: 320 / 0.75 });
  });

  it("runs only with two photos or more, after the start delay, unpaused, unhovered, unfocused and on screen", () => {
    const go: RotatorGate = { count: 3, reduced: false, started: true, paused: false, hovered: false, focused: false, visible: true };
    expect(rotatorRuns(go)).toBe(true);
    for (const key of ["reduced", "paused", "hovered", "focused"] as const) expect(rotatorRuns({ ...go, [key]: true })).toBe(false);
    for (const key of ["started", "visible"] as const) expect(rotatorRuns({ ...go, [key]: false })).toBe(false);
    expect(rotatorRuns({ ...go, count: 1 })).toBe(false);
    expect(ROTATOR_VISIBLE).toBeCloseTo(1 / 3);
  });

  it("resumes a paused photo with the time it had left", () => {
    expect(remainingAfter(4500, 1200)).toBe(3300);
    expect(remainingAfter(500, 900)).toBe(0);
    expect(remainingAfter(4500, -5)).toBe(4500);
  });
});

describe("round five steps", () => {
  it("masks a turning row's first photo, caption and words, then its dots and pause button, and no placeholder", () => {
    const c = card("mentorship");
    const steps = planSteps(rotating("mentorship"), { flownPhoto: 0, hasCaption: (p) => !!c.photos[p].caption, hasLinks: true });
    expect(steps.map((s) => s.map((p) => p.id))).toEqual([["title"], ["meta"], ["caption-0", "block-0"], ["photo-1", "caption-1", "block-1", "rotator-1"], ["links"]]);
  });

  it("masks the pager's first page as round four does", () => {
    const steps = pagerSteps(rotatingPages(rotating("mentorship")), { flownPhoto: 0, hasCaption: all, hasLinks: true });
    expect(steps.map((s) => s.map((p) => p.id))).toEqual([["title"], ["meta"], ["caption-0"], ["block-0"], ["pager"]]);
  });
});

describe("the round five preset", () => {
  it("is the pick, round four with rotating photos, round four still selectable", () => {
    expect(PRESETS[0].id).toBe("round-five");
    expect(INITIAL).toBe(PRESETS[0].settings);
    const four = PRESETS.find((p) => p.id === "round-four")!.settings;
    expect(INITIAL).toEqual({ ...four, extras: "rotate" });
    expect(four.extras).toBe("placeholder");
    expect(INITIAL).toMatchObject({ rotateSeconds: 4.5, rotateMs: 640, rotateDelayMs: 1200, rotateStyle: "mask", rotateAlign: "center" });
  });

  it("copies the rotation with the values, and not under round four", () => {
    const values = exportValues(INITIAL, "Round 5", "light", { desktop: [], phone: [] }, "Mentorship") as Record<string, unknown>;
    expect(values.rotation).toMatchObject({ interval: "4.5s a photo, looping", words: "never change" });
    const four = PRESETS.find((p) => p.id === "round-four")!.settings;
    expect((exportValues(four, "Round 4", "light", { desktop: [], phone: [] }, "Mentorship") as Record<string, unknown>).rotation).toBeUndefined();
  });

  it("reads the grouping back per card for the panel", () => {
    const c = card("mentorship");
    expect(groupingOf(c, c.photos.map((_, i) => drawnShape(c, i)), INITIAL)).toEqual({
      summary: "4 photos, 2 paragraphs: more photos than words; 4 pages on a phone",
      rows: ["Row 1: photo 1 (card picture), still, beside paragraph 1", "Row 2: photos 2, 3 and 4 take turns (424 by 318px frame), beside paragraph 2"],
    });
    const capitalOne = card("capital-one");
    expect(groupingOf(capitalOne, capitalOne.photos.map((_, i) => drawnShape(capitalOne, i)), INITIAL).rows).toEqual([
      "Opens with paragraph 1",
      "Row 1: photo 1, beside paragraph 2",
      "Row 2: photo 2, beside paragraph 3",
      "Row 3: photo 3, beside paragraph 4",
      "Closes with paragraph 5",
    ]);
  });
});
