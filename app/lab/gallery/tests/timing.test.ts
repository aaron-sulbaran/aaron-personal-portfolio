import { describe, expect, it } from "vitest";
import { interleave } from "../layout";
import { desktopSteps, maskTable, partId, phoneSteps } from "../timing";

const T = { startMs: 520, lengthMs: 450, staggerMs: 120, lineStaggerMs: 40 };

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
    expect(entries[0].endMs).toBe(1090);
    expect(endMs).toBe(1090);
  });

  it("treats zero or fractional lines as at least one", () => {
    const { entries } = maskTable([[{ id: "x", lines: 0 }, { id: "y", lines: 2.7 }]], T);
    expect(entries[0].lineStartsMs).toHaveLength(1);
    expect(entries[1].lineStartsMs).toHaveLength(2);
  });

  it("ends at the start when there is nothing to mask", () => {
    expect(maskTable([], T).endMs).toBe(520);
  });

  it("finishes Capital One on desktop in about a second and a half (the brief's budget)", () => {
    const rows = interleave(5, [{ block: 1 }, { block: 2 }, { block: 3 }]);
    const steps = desktopSteps(rows, 0, { flown: "logo", hasLinks: false });
    // title, meta, five rows
    expect(steps).toHaveLength(7);
    const { endMs } = maskTable(steps, { ...T, startMs: 0 });
    expect(endMs).toBe(6 * 120 + 450);
  });
});

describe("steps", () => {
  it("masks a pair's block and photo together, and never the flown first photo", () => {
    const rows = interleave(3, [{ block: 0 }, { block: 1 }, { block: 2 }]);
    const logo = desktopSteps(rows, 0, { flown: "logo", hasLinks: true });
    expect(logo.map((s) => s.map((p) => p.id))).toEqual([
      ["title"],
      ["meta"],
      ["block-0", "photo-0"],
      ["block-1", "photo-1"],
      ["block-2", "photo-2"],
      ["links"],
    ]);
    const photo = desktopSteps(rows, 0, { flown: "first-photo", hasLinks: false });
    expect(photo[2].map((p) => p.id)).toEqual(["block-0"]);
  });

  it("drops an extras row whose only photo is the flown one", () => {
    const rows = interleave(1, [{}]);
    const steps = desktopSteps(rows, 0, { flown: "first-photo", hasLinks: false });
    expect(steps.map((s) => s.map((p) => p.id))).toEqual([["title"], ["meta"], ["block-0"]]);
  });

  it("reads line counts for text parts only", () => {
    const rows = interleave(2, [{ block: 1 }]);
    const steps = desktopSteps(rows, 0, { flown: "logo", hasLinks: false, lines: (id) => (id === partId.block(1) ? 3 : 1) });
    expect(steps[3]).toEqual([{ id: "block-1", lines: 3 }, { id: "photo-0" }]);
  });

  it("masks the phone stage with the title unless it is the flown card", () => {
    expect(phoneSteps(2, { flown: "logo", hasLinks: false }).map((s) => s.map((p) => p.id))).toEqual([["stage", "title"], ["meta"], ["block-0"], ["block-1"]]);
    expect(phoneSteps(1, { flown: "first-photo", hasLinks: true })[0].map((p) => p.id)).toEqual(["title"]);
  });
});
