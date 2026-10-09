import { describe, expect, it } from "vitest";
import { CARDS, drawnShape } from "../cards";
import { cardLayout, groupingOf } from "../cardSteps";
import { fitWhole } from "../rows";
import { pageStage, phonePages, rotatingPlan, slideText, stageKind, stagePhotos, STRIP_VISIBLE, stripLayout, type Page, type PhoneGrouping } from "../plan";
import { photoMoveIn, photoWipeIn, photoWipeOut, sweepInsets, textIn, textOut } from "../reveal";
import { exportValues, INITIAL, PRESETS, type Settings } from "../settings";
import { pagerSteps } from "../timing";

const card = (id: string) => CARDS.find((c) => c.id === id)!;
const plan = (id: string) => {
  const c = card(id);
  return rotatingPlan(c.blocks.length, c.photos, c.flownPhoto);
};
const preset = (id: string) => PRESETS.find((p) => p.id === id)!.settings;
const FIVE = preset("round-five");
const GROUPINGS: PhoneGrouping[] = ["paragraph", "photo", "strip", "repeat"];
const words = (pages: readonly Page[]) => pages.flatMap((p) => slideText(p).blocks);

describe("the round six preset", () => {
  it("is the pick: Aaron's round five values, 3s a photo, every reveal left to right, a page a paragraph", () => {
    expect(PRESETS[0].id).toBe("round-six");
    expect(PRESETS[0].name).toBe("Round 6, Aaron's pick");
    expect(INITIAL).toBe(PRESETS[0].settings);
    expect(INITIAL).toEqual({
      ...FIVE,
      rotateSeconds: 3,
      photoDirection: "ltr",
      rotateDirection: "ltr",
      captionDirection: "ltr",
      textDirection: "ltr",
      phoneGrouping: "paragraph",
    });
  });

  it("keeps round five's numbers as Aaron copied them", () => {
    expect(INITIAL).toMatchObject({
      verticalWidth: 320,
      horizontalWidth: 424,
      textWidth: 460,
      rowGap: 64,
      columnGap: 56,
      photoAlign: "edge",
      textAlign: "center",
      rotateMs: 640,
      rotateDelayMs: 1200,
      landingMs: 520,
      maskMs: 480,
      staggerMs: 110,
      textSplit: "lines",
      lineStaggerMs: 45,
      settle: 2,
      ease: "site",
      stageMaxHeight: 40,
      slideMs: 360,
      flickPx: 96,
    });
  });

  it("keeps rounds five and four selectable, bottom up, round five's pages repeating", () => {
    for (const id of ["round-five", "round-four"]) {
      expect(preset(id)).toMatchObject({ photoDirection: "up", rotateDirection: "up", captionDirection: "up", textDirection: "up", phoneGrouping: "repeat" });
    }
  });
});

describe("phone pages under each grouping", () => {
  const counts = (grouping: PhoneGrouping) => Object.fromEntries(CARDS.map((c) => [c.id, phonePages(plan(c.id), grouping).length]));

  it("gives A and C a page a paragraph (Mentorship 2) and B a page a photo (Mentorship 4)", () => {
    const byParagraph = { "capital-one": 3, hackathons: 3, mentorship: 2, ieee: 3, anthropic: 2, misuki: 2, "building-in-public": 3 };
    const byPhoto = { "capital-one": 3, hackathons: 3, mentorship: 4, ieee: 3, anthropic: 3, misuki: 4, "building-in-public": 3 };
    expect(counts("paragraph")).toEqual(byParagraph);
    expect(counts("strip")).toEqual(byParagraph);
    expect(counts("photo")).toEqual(byPhoto);
    expect(counts("repeat")).toEqual(byPhoto);
  });

  it("never puts a paragraph on two pages under A, B or C, and shows every one once in order", () => {
    for (const grouping of ["paragraph", "photo", "strip"] as const) {
      for (const c of CARDS) expect(words(phonePages(plan(c.id), grouping))).toEqual(c.blocks.map((_, b) => b));
    }
    // Round five did repeat them, which is what A, B and C replace.
    expect(words(phonePages(plan("mentorship"), "repeat"))).toEqual([0, 1, 1, 1]);
  });

  it("shows every photo once under every grouping", () => {
    for (const grouping of GROUPINGS) {
      for (const c of CARDS) {
        const pages = phonePages(plan(c.id), grouping);
        const shown = pages.flatMap((page) => {
          const { stage, strip } = stagePhotos(page, stageKind(page, grouping));
          return [...stage, ...strip];
        });
        expect(shown.sort()).toEqual(c.photos.map((_, i) => i));
      }
    }
  });

  it("turns Mentorship's group inside its second page under A", () => {
    const pages = phonePages(plan("mentorship"), "paragraph");
    expect(pages.map((p) => [stageKind(p, "paragraph"), stagePhotos(p, stageKind(p, "paragraph")), slideText(p).blocks, p.links])).toEqual([
      ["still", { stage: [0], strip: [] }, [0], false],
      ["turns", { stage: [1, 2, 3], strip: [] }, [1], true],
    ]);
  });

  it("gives B's later group pages the photo alone, and keeps the links on the last page with words", () => {
    const pages = phonePages(plan("mentorship"), "photo");
    expect(pages.map((p) => [p.photo, slideText(p).blocks, p.links, !!p.wordless, stageKind(p, "photo")])).toEqual([
      [0, [0], false, false, "still"],
      [1, [1], true, false, "still"],
      [2, [], false, true, "still"],
      [3, [], false, true, "still"],
    ]);
    expect(pages.some((p) => slideText(p).note)).toBe(false);
    const misuki = phonePages(plan("misuki"), "photo");
    expect(misuki.map((p) => [p.photo, !!p.wordless])).toEqual([
      [0, false],
      [1, false],
      [2, true],
      [3, true],
    ]);
  });

  it("gives C the group's first photo in the stage and the rest in the strip", () => {
    const at = (id: string) => phonePages(plan(id), "strip").map((p) => stagePhotos(p, stageKind(p, "strip")));
    expect(at("mentorship")).toEqual([
      { stage: [0], strip: [] },
      { stage: [1], strip: [2, 3] },
    ]);
    expect(at("anthropic")).toEqual([
      { stage: [0], strip: [] },
      { stage: [1], strip: [2] },
    ]);
  });

  it("matches round four's pages where nothing takes turns (Capital One)", () => {
    for (const grouping of GROUPINGS) expect(phonePages(plan("capital-one"), grouping).map((p) => [p.photo, slideText(p).blocks, p.links])).toEqual([
      [0, [0, 1], false],
      [1, [2], false],
      [2, [3, 4], true],
    ]);
  });

  it("masks A's first page as round five did", () => {
    const pages = phonePages(plan("mentorship"), "paragraph");
    const steps = pagerSteps(pages, { flownPhoto: 0, hasCaption: () => true, hasLinks: true });
    expect(steps.map((s) => s.map((p) => p.id))).toEqual([["title"], ["meta"], ["caption-0"], ["block-0"], ["pager"]]);
  });

  it("reads the page count back for the panel", () => {
    const c = card("mentorship");
    const aspects = c.photos.map((_, i) => drawnShape(c, i));
    expect(cardLayout(c, aspects, INITIAL).pages).toHaveLength(2);
    expect(groupingOf(c, aspects, INITIAL).summary).toBe("4 photos, 2 paragraphs: more photos than words; 2 pages on a phone");
    expect(groupingOf(c, aspects, { ...INITIAL, phoneGrouping: "photo" }).summary).toContain("4 pages on a phone");
  });
});

describe("a page's stage", () => {
  it("holds every photo of a turning group whole, and never changes size between them (Misuki at 390 by 844)", () => {
    const c = card("misuki");
    const aspects = c.photos.map((_, i) => drawnShape(c, i));
    const [width, height] = [316, 0.4 * 844];
    const { frame, boxes } = pageStage([1, 2, 3], aspects, width, height);
    expect(frame.width).toBeLessThanOrEqual(width);
    expect(frame.height).toBeLessThanOrEqual(height + 1e-9);
    for (const [i, p] of [1, 2, 3].entries()) {
      expect(boxes[i].width).toBeLessThanOrEqual(frame.width);
      expect(boxes[i].height).toBeLessThanOrEqual(frame.height);
      expect(boxes[i].width / boxes[i].height).toBeCloseTo(aspects[p]);
    }
    expect(frame).toEqual({ width: 316, height: 0.4 * 844 });
  });

  it("is one photo's fit for a still page", () => {
    const { frame, boxes } = pageStage([0], [4 / 3], 316, 464);
    expect(boxes).toEqual([fitWhole(4 / 3, 316, 464)]);
    expect(frame).toEqual(boxes[0]);
  });
});

describe("C's strip", () => {
  it("shows two frames whole and a third peeking, every photo whole in a square on one floor", () => {
    const gap = 12;
    const { itemWidth, height, boxes } = stripLayout([3 / 4, 4 / 3, 1.15], 316, gap);
    expect(2 * itemWidth + 2 * gap).toBeLessThan(316);
    expect(3 * itemWidth + 2 * gap).toBeGreaterThan(316);
    expect(itemWidth).toBeCloseTo((316 - 2 * gap) / STRIP_VISIBLE);
    for (const box of boxes) {
      expect(box.width).toBeLessThanOrEqual(itemWidth + 1e-9);
      expect(box.height).toBeLessThanOrEqual(height + 1e-9);
    }
    expect(height).toBeCloseTo(itemWidth);
  });
});

describe("reveal directions", () => {
  it("wipes a photo from the left edge to the right, or up from the foot", () => {
    expect(photoWipeIn("ltr")).toEqual({ from: "inset(0% 100% 0% 0% round 12px)", to: "inset(0% 0% 0% 0% round 12px)" });
    expect(photoWipeIn("up").from).toBe("inset(100% 0% 0% 0% round 12px)");
    expect(photoWipeOut("ltr").to).toBe("inset(0% 0% 0% 100% round 12px)");
    expect(photoWipeOut("up").to).toBe("inset(0% 0% 100% 0% round 12px)");
    expect(photoMoveIn("ltr").from).toEqual({ xPercent: -110 });
    expect(photoMoveIn("up").from).toEqual({ yPercent: 110 });
  });

  it("opens a line's clip left to right in place, or raises it into its clip", () => {
    expect(textIn("ltr")).toEqual({ from: { clipPath: "inset(-25% 102% -25% -2%)" }, to: { clipPath: "inset(-25% -2% -25% -2%)" } });
    expect(textIn("up")).toEqual({ from: { yPercent: 110 }, to: { yPercent: 0 } });
    expect(textOut("ltr").to).toEqual({ clipPath: "inset(-25% -2% -25% 102%)" });
    expect(textOut("up").to).toEqual({ yPercent: -110 });
  });

  it("sweeps one edge across a rotating frame, even when the two photos' boxes differ", () => {
    const vertical = { left: 52, width: 320 };
    const horizontal = { left: 0, width: 424 };
    expect(sweepInsets(0, 424, horizontal, vertical)).toEqual({ incoming: "inset(0px 424px 0px 0px round 12px)", outgoing: "inset(0px 0px 0px 0px round 12px)" });
    expect(sweepInsets(1, 424, horizontal, vertical)).toEqual({ incoming: "inset(0px 0px 0px 0px round 12px)", outgoing: "inset(0px 0px 0px 320px round 12px)" });
    // At a quarter the edge is at 106px: the horizontal photo shows its first
    // 106px, the vertical one (from 52px) is cleared up to the same edge.
    expect(sweepInsets(0.25, 424, horizontal, vertical)).toEqual({ incoming: "inset(0px 318px 0px 0px round 12px)", outgoing: "inset(0px 0px 0px 54px round 12px)" });
    expect(sweepInsets(0.1, 424, vertical, horizontal).incoming).toBe("inset(0px 320px 0px 0px round 12px)");
  });
});

describe("the copied values", () => {
  const values = (s: Settings) => exportValues(s, "label", "light", { desktop: [], phone: [] }, "Mentorship") as unknown as Record<string, Record<string, unknown>>;

  it("record the phone grouping, each part's direction and the 3s interval", () => {
    const v = values(INITIAL);
    expect(v.phone.grouping).toBe("A. One page per paragraph");
    expect(v.mask.direction).toEqual({ photo: "Left to right", rotator: "Left to right", caption: "Left to right", text: "Left to right" });
    expect(v.rotation.interval).toBe("3s a photo, looping");
    for (const grouping of ["photo", "strip"] as const) expect(values({ ...INITIAL, phoneGrouping: grouping }).phone.grouping).toMatch(grouping === "photo" ? /^B\./ : /^C\./);
    expect(values(FIVE).mask.direction).toEqual({ photo: "Bottom up", rotator: "Bottom up", caption: "Bottom up", text: "Bottom up" });
  });
});
