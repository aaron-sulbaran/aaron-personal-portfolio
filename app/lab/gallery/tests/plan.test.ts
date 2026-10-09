import { describe, expect, it } from "vitest";
import { CARDS, drawnShape } from "../cards";
import { areaRatio, boxFor, pagerStage, pagesOf, photoOrder, photoPlan, slideText, uniformBoxes, uniformColumns } from "../plan";

const card = (id: string) => CARDS.find((c) => c.id === id)!;
const planOf = (id: string) => {
  const c = card(id);
  return photoPlan(c.blocks.length, c.photos, c.flownPhoto);
};

describe("photoPlan", () => {
  it("keeps Capital One as it is: the opening line, a photo a summer, the closing line", () => {
    expect(planOf("capital-one")).toEqual({
      intro: [0],
      slides: [
        { photo: 0, own: 1, before: [], after: [] },
        { photo: 1, own: 2, before: [], after: [] },
        { photo: 2, own: 3, before: [], after: [] },
      ],
      closing: [4],
    });
  });

  it("gives the card picture the first block and every other photo its own words or a placeholder", () => {
    // Mentorship: the booth print and the red backdrop both name block 0,
    // which the card picture takes, so both wait for Aaron's sentence.
    expect(planOf("mentorship").slides).toEqual([
      { photo: 0, own: 0, before: [], after: [] },
      { photo: 1, own: undefined, before: [], after: [] },
      { photo: 2, own: undefined, before: [], after: [] },
      { photo: 3, own: 1, before: [], after: [] },
    ]);
    expect(planOf("hackathons")).toEqual({
      intro: [],
      slides: [
        { photo: 0, own: 0, before: [], after: [] },
        { photo: 1, own: 1, before: [], after: [] },
        { photo: 2, own: 2, before: [], after: [] },
      ],
      closing: [3],
    });
  });

  it("carries blocks no photo took with the nearest photos, so no paragraph sits between two photos (IEEE)", () => {
    expect(planOf("ieee")).toEqual({
      intro: [],
      slides: [
        { photo: 0, own: 0, before: [], after: [1] },
        { photo: 1, own: 3, before: [2], after: [] },
        { photo: 2, own: 4, before: [], after: [] },
      ],
      closing: [],
    });
  });

  it("places every photo once, the card picture first, and every block once", () => {
    for (const c of CARDS) {
      const plan = photoPlan(c.blocks.length, c.photos, c.flownPhoto);
      expect(plan.slides.map((s) => s.photo).sort()).toEqual(c.photos.map((_, i) => i));
      if (c.flownPhoto !== undefined) expect(plan.slides[0].photo).toBe(c.flownPhoto);
      const blocks = [...plan.intro, ...plan.slides.flatMap((s) => slideText(s).blocks), ...plan.closing];
      expect(blocks).toEqual(c.blocks.map((_, b) => b));
    }
  });

  it("orders photos by the block they name, photos naming none last, and survives no blocks", () => {
    expect(photoOrder([{ block: 2 }, {}, { block: 0 }, { block: 9 }], 3)).toEqual([2, 0, 1, 3]);
    expect(photoPlan(0, [{}, { block: 1 }], 0)).toEqual({ intro: [], slides: [{ photo: 0, own: undefined, before: [], after: [] }, { photo: 1, own: undefined, before: [], after: [] }], closing: [] });
    expect(photoPlan(2, [])).toEqual({ intro: [0, 1], slides: [], closing: [] });
  });
});

describe("pagesOf", () => {
  it("puts the opening blocks on the first page and the closing ones and the links on the last", () => {
    const pages = pagesOf(planOf("capital-one"));
    expect(pages.map((p) => slideText(p).blocks)).toEqual([[0, 1], [2], [3, 4]]);
    expect(pages.map((p) => p.links)).toEqual([false, false, true]);
    expect(pagesOf(planOf("building-in-public")).map((p) => slideText(p))).toEqual([
      { blocks: [0], note: false },
      { blocks: [], note: true },
      { blocks: [1, 2], note: true },
    ]);
  });
});

describe("boxes", () => {
  it("draws every vertical photo in one 3:4 box and every horizontal one in one box of about the same area", () => {
    const boxes = uniformBoxes(320, 424, "4:3");
    expect(boxes.vertical).toEqual({ width: 320, height: 320 / 0.75 });
    expect(boxes.horizontal).toEqual({ width: 424, height: 318 });
    expect(areaRatio(boxes.horizontal, boxes.vertical)).toBeGreaterThan(0.98);
    expect(areaRatio(boxes.horizontal, boxes.vertical)).toBeLessThan(1.02);
    expect(boxFor(1.87, boxes, 1)).toBe(boxes.horizontal);
    expect(boxFor(1.03, boxes, 1)).toBe(boxes.horizontal);
    expect(boxFor(0.8, boxes, 1)).toBe(boxes.vertical);
    expect(uniformBoxes(320, 420, "3:2").horizontal).toEqual({ width: 420, height: 280 });
  });

  it("sizes the photo column to the card's widest box and the panel around it", () => {
    const boxes = uniformBoxes(320, 424, "4:3");
    const aspects = (id: string) => card(id).photos.map((_, i) => drawnShape(card(id), i));
    expect(uniformColumns(aspects("capital-one"), boxes, 1, 56, 460, 40)).toEqual({ slot: 320, panel: 916 });
    expect(uniformColumns(aspects("ieee"), boxes, 1, 56, 460, 40)).toEqual({ slot: 424, panel: 1020 });
  });
});

describe("pagerStage", () => {
  it("fits every photo whole inside the width and the cap, at the tallest photo's height", () => {
    // IEEE at 390 by 844: inner width 318, the cap 40 percent of 844.
    const ieee = [1.5, 1.87, 0.75];
    const stage = pagerStage(ieee, 318, 337.6);
    for (const box of stage.boxes) {
      expect(box.width).toBeLessThanOrEqual(318 + 1e-9);
      expect(box.height).toBeLessThanOrEqual(stage.height + 1e-9);
    }
    expect(stage.height).toBeCloseTo(337.6);
    // Only horizontal photos: the stage shrinks to the tallest of them.
    expect(pagerStage([1.5, 1.87], 318, 337.6).height).toBeCloseTo(212);
    // A short page leaves the words their room, never under the floor.
    expect(pagerStage([0.75], 288, 312, 200).height).toBe(200);
    expect(pagerStage([0.75], 288, 312, 60).height).toBe(120);
  });

  it("never crops a photo at any phone width from 360 to 430", () => {
    for (let width = 360; width <= 430; width += 2) {
      for (const height of [740, 780, 844, 932]) {
        const inner = width - 72;
        for (const c of CARDS) {
          const aspects = c.photos.map((_, i) => drawnShape(c, i));
          const stage = pagerStage(aspects, inner, height * 0.4);
          stage.boxes.forEach((box, i) => {
            expect(box.width).toBeLessThanOrEqual(inner + 1e-9);
            expect(box.height).toBeLessThanOrEqual(stage.height + 1e-9);
            expect(box.width / box.height).toBeCloseTo(aspects[i]);
          });
        }
      }
    }
  });
});
