import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { SAMPLE_STEP } from "./constants";
import { sampleSpine } from "./geometry";
import { SIGNATURE_ON, resolveSpine, type Anchors, type SpinePoint } from "./spine";
import { checkLine, chooseTrain, visibleOptions } from "./visible";

const sizes = Object.keys(pages) as (keyof typeof pages)[];
const optsFor = (size: keyof typeof pages) => visibleOptions(pages[size].anchors.width, pages[size].viewport);

describe("always visible, the shipped line", () => {
  it.each(sizes)("keeps some wave on screen at every scroll position at %s", (size) => {
    expect(checkLine(SIGNATURE_ON, pages[size].anchors as Anchors, optsFor(size)).visible.worstGapPx).toBe(0);
  });
  it("reaches its end at max scroll and ends past an edge at 1440", () => {
    const { end } = checkLine(SIGNATURE_ON, pages["1440x900"].anchors as Anchors, optsFor("1440x900"));
    expect(end.shortPx).toBeLessThanOrEqual(1);
    expect(end.endsOff).toBe(true);
  });
});

function page(width = 1200): Anchors {
  const keys = ["band", "who", "numbers", "connect", "footer"] as const;
  const box = {} as Anchors["box"];
  const words = {} as Anchors["words"];
  keys.forEach((k, i) => {
    box[k] = { top: i * 600, bottom: (i + 1) * 600 };
    words[k] = { top: i * 600 + 100, bottom: i * 600 + 500 };
  });
  return { width, box, words, blocks: [], headings: [], links: [], hairlines: [] };
}

describe("always visible, the check itself", () => {
  const opts = { ...visibleOptions(1200, 800), bandRun: false, head: { mode: "viewport" as const, headAt: 0.7, preDrawn: 0, fromBand: false } };
  const line = (xs: number[]): SpinePoint[] =>
    (["who", "numbers", "connect"] as const).flatMap((at, i) => [{ at, y: 0.1, x: xs[i] }, { at, y: 0.9, x: xs[i] }]);
  it("passes a line that stays on screen", () => expect(checkLine(line([0.5, 0.5, 0.5]), page(), opts).visible.worstGapPx).toBe(0));
  it("passes an edge run hugging the margin", () => expect(checkLine(line([0.015, 0.5, 0.5]), page(), opts).visible.worstGapPx).toBe(0));
  it("fails a line that leaves for a section, and says where", () => {
    const report = checkLine(line([0.5, -0.3, -0.3]), page(), opts);
    expect(report.visible.worstGapPx).toBeGreaterThan(0);
    expect(report.visible.atY).toBeGreaterThan(400);
  });
  it("keeps the train for a line that passes, draws the whole line for one that does not", () => {
    const ok = sampleSpine(resolveSpine({ points: line([0.5, 0.5, 0.5]) }, page()), SAMPLE_STEP);
    const gone = sampleSpine(resolveSpine({ points: line([0.5, -0.3, -0.3]) }, page()), SAMPLE_STEP);
    expect(chooseTrain(ok, page(), opts)).toBe(opts.train);
    expect(chooseTrain(gone, page(), opts)).toBeNull();
  });
});
