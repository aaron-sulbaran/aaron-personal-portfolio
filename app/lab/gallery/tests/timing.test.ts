import { describe, expect, it } from "vitest";
import { interleave } from "../rows";
import { desktopSteps, maskTable, partId, phoneSteps } from "../timing";

const T = { startMs: 520, lengthMs: 450, staggerMs: 120, lineStaggerMs: 40 };
const V = 3 / 4;
const all = () => true;
const none = () => false;

describe("maskTable", () => {
  it("starts each step one stagger after the last and ends on the last mask", () => {
    const { entries, endMs } = maskTable([[{ id: "a" }], [{ id: "b" }, { id: "c" }], [{ id: "d" }]], T);
    expect(entries.map((e) => [e.id, e.step, e.startMs, e.endMs])).toEqual([
      ["a", 0, 520, 970],
      ["b", 1, 640, 1090],
      ["c", 1, 640, 1090],
      ["d", 2, 760, 1210],
    ]);
    expect(endMs).toBe(1210);
  });

  it("staggers a split part's lines and lets its last line set the end", () => {
    const { entries, endMs } = maskTable([[{ id: "body", lines: 4 }]], T);
    expect(entries[0].lineStartsMs).toEqual([520, 560, 600, 640]);
    expect(endMs).toBe(1090);
  });

  it("treats zero or fractional lines as at least one, and ends at the start with nothing to mask", () => {
    const { entries } = maskTable([[{ id: "x", lines: 0 }, { id: "y", lines: 2.7 }]], T);
    expect(entries[0].lineStartsMs).toHaveLength(1);
    expect(entries[1].lineStartsMs).toHaveLength(2);
    expect(maskTable([], T).endMs).toBe(520);
  });

  it("finishes Capital One on desktop in about a second and a half (the brief's budget)", () => {
    const rows = interleave(5, [{ block: 1, aspect: V }, { block: 2, aspect: V }, { block: 3, aspect: V }]);
    const steps = desktopSteps(rows, { hasCaption: all, hasLinks: false });
    expect(steps).toHaveLength(7);
    expect(maskTable(steps, { ...T, startMs: 0 }).endMs).toBe(6 * 120 + 450);
  });
});

describe("steps", () => {
  it("masks a row's photo, caption and block together", () => {
    const rows = interleave(2, [{ block: 0, aspect: 1.5 }, { block: 1, aspect: V }]);
    const steps = desktopSteps(rows, { hasCaption: all, hasLinks: true });
    expect(steps.map((s) => s.map((p) => p.id))).toEqual([
      ["title"],
      ["meta"],
      ["photo-0", "caption-0", "block-0"],
      ["photo-1", "caption-1", "block-1"],
      ["links"],
    ]);
  });

  it("never masks the flown card picture, but masks its caption", () => {
    // Hackathons: the card picture is the second photo.
    const rows = interleave(3, [{ block: 0, aspect: 1.41 }, { block: 1, aspect: V }, { block: 2, aspect: V }]);
    const steps = desktopSteps(rows, { flownPhoto: 1, hasCaption: all, hasLinks: false });
    expect(steps[3].map((p) => p.id)).toEqual(["caption-1", "block-1"]);
  });

  it("drops a row with nothing left to mask, and masks wide and grouped extras", () => {
    const rows = interleave(1, [{ aspect: V }, { aspect: 2 }, { aspect: V }]);
    const steps = desktopSteps(rows, { flownPhoto: 0, hasCaption: none, hasLinks: false });
    expect(steps.map((s) => s.map((p) => p.id))).toEqual([["title"], ["meta"], ["block-0"], ["photo-1"], ["photo-2"]]);
  });

  it("reads line counts for text parts, captions included", () => {
    const rows = interleave(2, [{ block: 1, aspect: V }]);
    const lines = (id: string) => (id === partId.block(1) ? 3 : id === partId.caption(0) ? 2 : 1);
    const steps = desktopSteps(rows, { hasCaption: all, hasLinks: false, lines });
    expect(steps[3]).toEqual([{ id: "photo-0" }, { id: "caption-0", lines: 2 }, { id: "block-1", lines: 3 }]);
  });

  it("masks the phone stage with its caption and the title unless the stage opens on the flown card", () => {
    expect(phoneSteps(2, 0, { hasCaption: all, hasLinks: false, stageCaption: true }).map((s) => s.map((p) => p.id))).toEqual([
      ["stage", "stage-caption", "title"],
      ["meta"],
      ["block-0"],
      ["block-1"],
    ]);
    expect(phoneSteps(1, 0, { flownPhoto: 0, hasCaption: all, hasLinks: true, stageCaption: false })[0].map((p) => p.id)).toEqual(["title"]);
    // Misuki: the flown picture is the last photo, so the stage still masks.
    expect(phoneSteps(2, 0, { flownPhoto: 3, hasCaption: all, hasLinks: false, stageCaption: true })[0].map((p) => p.id)).toEqual(["stage", "stage-caption", "title"]);
  });
});
