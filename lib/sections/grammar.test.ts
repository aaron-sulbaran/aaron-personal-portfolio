import { describe, expect, it } from "vitest";
import { GRAMMAR, bandFor, lineStagger, planBlock, scrubFor, stickyStyle, type BlockKind } from "@/lib/sections/grammar";

const KINDS: BlockKind[] = ["kicker", "heading", "body", "item", "links"];
const MASKED = { yPercent: 110 };

describe("Aaron's pick", () => {
  it("holds the values he chose in the sections lab", () => {
    expect(GRAMMAR).toEqual({
      lag: 0.8, lagStep: 0.12, itemLagStep: 0.06, spread: 0.4, bandStart: 90, bandEnd: 60,
      follow: 6, ease: "power3.out", stickyTop: 112, stopOffset: 120,
    });
  });
});

describe("the scrub", () => {
  it("is the lag plus a step per rank: kicker, then heading, then body", () => {
    expect(scrubFor("kicker")).toBeCloseTo(0.8, 10);
    expect(scrubFor("heading")).toBeCloseTo(0.92, 10);
    expect(scrubFor("body")).toBeCloseTo(1.04, 10);
    expect(scrubFor("links")).toBeCloseTo(1.04, 10);
  });
  it("adds the item step per Up to now item, so the items arrive in turn", () => {
    expect(scrubFor("item", 0)).toBeCloseTo(1.04, 10);
    expect(scrubFor("item", 3)).toBeCloseTo(1.22, 10);
    expect(scrubFor("body", 3), "only items step by index").toBeCloseTo(1.04, 10);
  });
  it("follows another grammar's numbers when given one", () => {
    expect(scrubFor("heading", 0, { ...GRAMMAR, lag: 1.6, lagStep: 0.2 })).toBeCloseTo(1.8, 10);
  });
});

describe("the trigger band", () => {
  it("runs kickers and headings from 90 to 60 percent of the viewport", () => {
    expect(bandFor("kicker")).toEqual({ start: "top+=0 90%", end: "top+=0 60%" });
    expect(bandFor("heading")).toEqual({ start: "top+=0 90%", end: "top+=0 60%" });
  });
  it("starts bodies, items and links 6 percent later", () => {
    for (const kind of ["body", "item", "links"] as const) {
      expect(bandFor(kind)).toEqual({ start: "top+=0 84%", end: "top+=0 54%" });
    }
  });
  it("carries a held block's offset inside its sticky column", () => {
    expect(bandFor("heading", 44)).toEqual({ start: "top+=44 90%", end: "top+=44 60%" });
  });
});

describe("the reduced-motion branch", () => {
  it("plans nothing for any kind, so every block stays as the server rendered it", () => {
    for (const kind of KINDS) for (const split of ["lines", "block"] as const) {
      expect(planBlock({ kind, reduce: true, split, rows: 4 })).toBeNull();
    }
  });
});

describe("the plans", () => {
  it("masks a heading or body in by lines, overlapping by the spread", () => {
    expect(lineStagger()).toBeCloseTo(0.34, 10);
    const plan = planBlock({ kind: "body", reduce: false })!;
    expect(plan).toMatchObject({ ease: "power3.out", duration: 1, split: "lines" });
    expect(plan.scrub).toBeCloseTo(1.04, 10);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ target: "lines", from: MASKED, at: 0 });
    expect(plan.steps[0].stagger).toBeCloseTo(0.34, 10);
  });
  it("masks a block-split heading or body in as one piece", () => {
    for (const kind of ["heading", "body"] as const) {
      const plan = planBlock({ kind, reduce: false, split: "block" })!;
      expect(plan.split).toBe("block");
      expect(plan.steps).toEqual([{ target: "inner", from: MASKED, at: 0 }]);
    }
  });
  it("draws a kicker's rule, then brings its label in", () => {
    expect(planBlock({ kind: "kicker", reduce: false })).toMatchObject({
      split: null,
      steps: [
        { target: "rule", from: { scaleX: 0 }, at: 0 },
        { target: "label", from: { opacity: 0, x: -8 }, at: 0.45 },
      ],
    });
  });
  it("draws an item's hairline, then masks its words in", () => {
    const plan = planBlock({ kind: "item", reduce: false, index: 2 })!;
    expect(plan.scrub).toBeCloseTo(1.16, 10);
    expect(plan.steps).toEqual([
      { target: "hair", from: { scaleX: 0 }, at: 0 },
      { target: "text", from: MASKED, at: 0.35 },
    ]);
  });
  it("draws each Connect row's rule and lifts its content, row after row", () => {
    const steps = planBlock({ kind: "links", reduce: false, rows: 3 })!.steps;
    expect(steps.map((step) => [step.target, step.row])).toEqual([
      ["rowHair", 0], ["rowInner", 0], ["rowHair", 1], ["rowInner", 1], ["rowHair", 2], ["rowInner", 2],
    ]);
    expect(steps[1].at).toBeCloseTo(0.25, 10);
    expect(steps[2].at).toBeCloseTo(0.34, 10);
    expect(steps[3].at).toBeCloseTo(0.59, 10);
    expect(steps[3].from).toEqual(MASKED);
  });
  it("animates only opacity and transforms", () => {
    const allowed = new Set(["opacity", "x", "yPercent", "scaleX"]);
    for (const kind of KINDS) for (const split of ["lines", "block"] as const) {
      for (const step of planBlock({ kind, reduce: false, split, rows: 2 })!.steps) {
        for (const key of Object.keys(step.from)) expect(allowed.has(key), `${kind} ${key}`).toBe(true);
      }
    }
  });
});

describe("the sticky hold", () => {
  it("hands the hold's top and early stop to CSS as custom properties", () => {
    expect(stickyStyle()).toEqual({ "--sections-sticky-top": "112px", "--sections-sticky-stop": "120px" });
  });
});
