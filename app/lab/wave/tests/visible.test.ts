import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { chooseSpine, checkOptions } from "../spineChoice";
import { PRESETS, REVIEWED_RULES } from "../settings";
import { checkLine } from "../spineRules";
import { spineById, type Anchors, type SpinePoint } from "../spines";

// The always-visible check on authored spines, against the real page measured
// at three sizes (fixtures/pages.json: the lab's anchors with the panel
// collapsed). Authored lines are never regenerated, so this check is the
// only thing standing between a line and an empty screen.

const pick3On = PRESETS.find((p) => p.id === "pick3-on")!.values;
const sizes = Object.keys(pages) as (keyof typeof pages)[];
const optsFor = (size: keyof typeof pages) => {
  const page = pages[size];
  return checkOptions(pick3On.path, pick3On.amplitude, page.viewport, page.anchors.width);
};

describe("always visible, authored spines", () => {
  it.each(sizes)("the always-on Signature line keeps some wave on screen at every scroll position at %s", (size) => {
    const report = checkLine(spineById("signature-reviewed-on").points, pages[size].anchors as Anchors, optsFor(size));
    expect(report.visible.worstGapPx).toBe(0);
    expect(report.failed).not.toContain("visible");
  });

  it.each(sizes)("the reviewed Signature line (as pasted) empties the screen beside Who I am at %s", (size) => {
    const page = pages[size];
    const report = checkLine(spineById("signature-reviewed").points, page.anchors as Anchors, optsFor(size));
    expect(report.visible.worstGapPx).toBeGreaterThan(0);
    expect(report.failed).toContain("visible");
    // The gap starts within the Who I am section's scroll range.
    const who = page.anchors.box.who;
    expect(report.visible.atY).toBeGreaterThan(who.top - page.viewport);
    expect(report.visible.atY).toBeLessThan(who.bottom);
  });

  it("the always-on line keeps every reviewed rule at 1440 and still reaches its end", () => {
    const report = checkLine(spineById("signature-reviewed-on").points, pages["1440x900"].anchors as Anchors, optsFor("1440x900"));
    expect(report.failed).toEqual([]);
    expect(report.end.shortPx).toBeLessThanOrEqual(1);
    expect(report.end.endsOff).toBe(true);
  });

  it("an authored line is drawn as authored (never swapped), so its report is what flags it", () => {
    const page = pages["1440x900"];
    const measure = { anchors: page.anchors as Anchors, viewport: page.viewport };
    const choice = chooseSpine({ ...pick3On.path, spine: "signature-reviewed" }, measure, pick3On.amplitude);
    expect(choice.def.id).toBe("signature-reviewed");
    expect(choice.generated).toBeNull();
  });

  it("the generator's fallback under the always-visible rule is the always-on line", () => {
    const page = pages["1440x900"];
    const measure = { anchors: page.anchors as Anchors, viewport: page.viewport };
    // An impossible rule (no flat run of 1px at any slope) forces the fallback.
    const rules = { ...REVIEWED_RULES, alwaysVisible: true, flatAnyPx: 1, flatAnySlope: 1 };
    const choice = chooseSpine({ ...pick3On.path, spine: "generated", rules }, measure, pick3On.amplitude);
    expect(choice.generated?.fallback).toBe(true);
    expect(choice.def.points).toEqual(spineById("signature-reviewed-on").points);
  });
});

// A synthetic page: six sections of 600px, words filling the middle 400px.
function page(width = 1200): Anchors {
  const keys = ["band", "about", "who", "up", "connect", "footer"] as const;
  const box = {} as Anchors["box"];
  const words = {} as Anchors["words"];
  keys.forEach((k, i) => {
    box[k] = { top: i * 600, bottom: (i + 1) * 600 };
    words[k] = { top: i * 600 + 100, bottom: i * 600 + 500 };
  });
  return { width, box, words, blocks: [], headings: [], links: [], hairlines: [] };
}

describe("always visible, the check itself", () => {
  const opts = { ...checkOptions({ ...pick3On.path, bandRun: false, headFromBand: false }, 80, 800, 1200), rules: { ...REVIEWED_RULES, alwaysVisible: true } };
  const line = (xs: number[]): SpinePoint[] =>
    (["about", "who", "up", "connect"] as const).flatMap((at, i) => [
      { at, y: 0.1, x: xs[i] },
      { at, y: 0.9, x: xs[i] },
    ]);

  it("passes a line that stays on screen", () => {
    expect(checkLine(line([0.5, 0.5, 0.5, 0.5]), page(), opts).visible.worstGapPx).toBe(0);
  });

  it("passes an edge run hugging the margin", () => {
    expect(checkLine(line([0.5, 0.015, 0.5, 0.5]), page(), opts).visible.worstGapPx).toBe(0);
  });

  it("fails a line that leaves for a section, and says where", () => {
    const report = checkLine(line([0.5, -0.3, -0.3, 0.5]), page(), opts);
    expect(report.visible.worstGapPx).toBeGreaterThan(0);
    expect(report.failed).toContain("visible");
    expect(report.visible.atY).toBeGreaterThan(400);
  });
});
