import { describe, expect, it } from "vitest";
import { galleryPlan, pagesOf } from "@/lib/gallery/plan";
import { axisOf, pagerReducer, releaseOf, rubberBand } from "@/lib/gallery/pager";
import { photoWipeIn, photoWipeOut, sweepInsets, textIn, textOut } from "@/lib/gallery/reveal";
import { remainingAfter, rotatorRuns, wrap } from "@/lib/gallery/rotator";
import { maskTable, pagerSteps, planSteps } from "@/lib/gallery/timing";

const ids = (steps: { id: string }[][]) => steps.map((step) => step.map((part) => part.id));
const beside = (...words: (number | undefined)[]) => words.map((word) => (word === undefined ? {} : { beside: word }));

describe("the mask table", () => {
  it("starts at the given start, staggers steps 110ms and lines 45ms, each mask 480ms", () => {
    const table = maskTable([[{ id: "title" }], [{ id: "meta" }], [{ id: "words-0", lines: 3 }]], { startMs: 520, lengthMs: 480, staggerMs: 110, lineStaggerMs: 45 });
    expect(table.entries.map((e) => [e.id, e.startMs, e.endMs, e.lineStartsMs])).toEqual([["title", 520, 1000, [520]], ["meta", 630, 1110, [630]], ["words-0", 740, 1310, [740, 785, 830]]]);
    expect(table.endMs).toBe(1310);
  });
  it("masks the header, the opening words, each row with its photo, caption and words, the closing words, the trailing parts, the links (Capital One)", () => {
    expect(ids(planSteps(galleryPlan(5, beside(1, 2, 3)), { hasCaption: () => true, hasLinks: false }))).toEqual([
      ["title"], ["meta"], ["words-0"], ["photo-0", "caption-0", "words-1"], ["photo-1", "caption-1", "words-2"], ["photo-2", "caption-2", "words-3"], ["words-4"],
    ]);
  });
  it("never masks the photo a parked flown card covers, adds a turning row's controls, and the mentors before the links (Mentorship)", () => {
    expect(ids(planSteps(galleryPlan(2, beside(undefined, 0, 0, 1), 0), { flown: 0, hasCaption: () => true, hasLinks: true, trailing: ["mentors"] }))).toEqual([
      ["title"], ["meta"], ["caption-0", "words-0"], ["photo-1", "caption-1", "words-1", "rotator-1"], ["mentors"], ["links"],
    ]);
  });
  it("masks a card with no photos as its words alone", () => {
    expect(ids(planSteps(galleryPlan(2, []), { hasCaption: () => false, hasLinks: true }))).toEqual([["title"], ["meta"], ["words-0"], ["words-1"], ["links"]]);
  });
  it("on a phone masks the header, the first page and the pager's controls", () => {
    const pages = pagesOf(galleryPlan(2, beside(undefined, 0, 0, 1), 0));
    expect(ids(pagerSteps(pages, { hasCaption: () => true, hasLinks: true, trailing: ["mentors"] }))).toEqual([["title"], ["meta"], ["photo-0", "caption-0"], ["words-0"], ["pager"]]);
    const one = pagesOf(galleryPlan(1, beside(0)));
    expect(ids(pagerSteps(one, { hasCaption: () => false, hasLinks: true }))).toEqual([["title"], ["meta"], ["photo-0"], ["words-0", "links"]]);
  });
});

describe("the reveals read left to right", () => {
  it("wipes a photo in from its left edge and out to its right", () => {
    expect(photoWipeIn("ltr")).toEqual({ from: "inset(0% 100% 0% 0% round 12px)", to: "inset(0% 0% 0% 0% round 12px)" });
    expect(photoWipeOut("ltr")).toEqual({ from: "inset(0% 0% 0% 0% round 12px)", to: "inset(0% 0% 0% 100% round 12px)" });
  });
  it("opens a line's clip in place, with room for the ink above and below", () => {
    expect(textIn("ltr")).toEqual({ from: { clipPath: "inset(-25% 102% -25% -2%)" }, to: { clipPath: "inset(-25% -2% -25% -2%)" } });
    expect(textOut("ltr")).toEqual({ from: { clipPath: "inset(-25% -2% -25% -2%)" }, to: { clipPath: "inset(-25% -2% -25% 102%)" } });
  });
  it("sweeps one edge across a turning frame, so photos of two shapes hand over on one line", () => {
    expect(sweepInsets(0.5, 424, { left: 52, width: 320 }, { left: 0, width: 424 })).toEqual({ incoming: "inset(0px 160px 0px 0px)", outgoing: "inset(0px 0px 0px 212px)" });
    expect(sweepInsets(1.2, 424, { left: 0, width: 424 }, { left: 52, width: 320 })).toEqual({ incoming: "inset(0px 0px 0px 0px)", outgoing: "inset(0px 0px 0px 320px)" });
  });
});

describe("the pager", () => {
  it("turns a page at a time and stops at either end", () => {
    expect(pagerReducer({ index: 0, count: 3 }, { type: "prev" })).toEqual({ index: 0, count: 3 });
    expect(pagerReducer({ index: 2, count: 3 }, { type: "next" })).toEqual({ index: 2, count: 3 });
    expect(pagerReducer({ index: 0, count: 3 }, { type: "goto", index: 9 })).toEqual({ index: 2, count: 3 });
  });
  it("returns the same state when the page does not change, so a reducer can bail out", () => {
    const atStart = { index: 0, count: 3 };
    const atEnd = { index: 2, count: 3 };
    expect(pagerReducer(atStart, { type: "prev" })).toBe(atStart);
    expect(pagerReducer(atEnd, { type: "next" })).toBe(atEnd);
    expect(pagerReducer(atStart, { type: "goto", index: 0 })).toBe(atStart);
    expect(pagerReducer(atStart, { type: "next" })).not.toBe(atStart);
  });
  it("picks a drag's axis once it moves past the slop", () => {
    expect(axisOf(3, 2)).toBeNull();
    expect(axisOf(10, 4)).toBe("x");
    expect(axisOf(4, 10)).toBe("y");
  });
  it("turns on a sideways drag, closes on a 96px vertical flick or a quick one, and never closes sideways", () => {
    const o = { flickPx: 96 };
    expect(releaseOf("x", -60, 0, 0, o)).toBe("next");
    expect(releaseOf("x", 60, 0, 0, o)).toBe("prev");
    expect(releaseOf("x", -30, 0, -0.7, o)).toBe("next");
    expect(releaseOf("x", 0, 200, 0, o)).toBe("stay");
    expect(releaseOf("y", 0, 100, 0, o)).toBe("dismiss");
    expect(releaseOf("y", 0, 50, 0, o)).toBe("stay");
    expect(releaseOf("y", 0, 30, 0.8, o)).toBe("dismiss");
    expect(releaseOf(null, 0, 0, 0, o)).toBe("stay");
  });
  it("follows the finger at a third of its travel past either end", () => {
    expect(rubberBand(30, 0, 3)).toBe(10);
    expect(rubberBand(-30, 2, 3)).toBe(-10);
    expect(rubberBand(30, 1, 3)).toBe(30);
  });
});

describe("the rotator's gate", () => {
  const go = { count: 3, reduced: false, started: true, paused: false, held: false, visible: true };
  it("turns only with two photos or more, after the start delay, unpaused, unheld, a third on screen, motion allowed", () => {
    expect(rotatorRuns(go)).toBe(true);
    for (const stop of [{ count: 1 }, { reduced: true }, { started: false }, { paused: true }, { held: true }, { visible: false }]) expect(rotatorRuns({ ...go, ...stop })).toBe(false);
  });
  it("wraps, and resumes with the time it had left", () => {
    expect([wrap(-1, 3), wrap(3, 3), wrap(0, 0)]).toEqual([2, 0, 0]);
    expect([remainingAfter(3000, 1200), remainingAfter(3000, 5000), remainingAfter(3000, -5)]).toEqual([1800, 0, 3000]);
  });
});
