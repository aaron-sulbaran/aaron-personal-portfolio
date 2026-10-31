import { describe, expect, it } from "vitest";
import layout from "./fixtures/layout.json";
import pages from "./fixtures/pages.json";
import { SAMPLE_STEP } from "./constants";
import { sampleSpine, type Point } from "./geometry";
import { layLine } from "./line";
import type { Anchors } from "./spine";
import { blankScrolls, checkLine, headOutOfFrame, visibleOptions } from "./visible";

const measured = { ...Object.fromEntries(Object.entries(pages).map(([k, v]) => [`pages ${k}`, v])), ...Object.fromEntries(Object.entries(layout).map(([k, v]) => [`layout ${k}`, v])) } as Record<string, { anchors: unknown; viewport: number }>;
const sizes = Object.keys(measured);

describe("in view, the shipped line", () => {
  for (const size of sizes) {
    const anchors = measured[size].anchors as Anchors;
    const viewport = measured[size].viewport;
    const opts = visibleOptions(anchors.width, viewport);
    const { samples } = layLine(anchors, viewport);

    // The serpentine stays off screen past words with no gap to cross in, and the line leaves the screen whole before it comes back
    // (Aaron, A33: it need not always be on screen). So the screen is empty where the whole line has nothing to show, or for the stretch
    // the head is out of frame between one crossing and the next; never with the head in view.
    it(`empties the screen only where the whole line would, or while the head is out of frame, at ${size}`, () => {
      const own = new Set(blankScrolls(samples, anchors, { ...opts, train: null }));
      const added = blankScrolls(samples, anchors, opts).filter((y) => !own.has(y));
      expect(added.filter((y) => !headOutOfFrame(samples, anchors, opts, y)), "scroll positions the train empties with its head in view").toEqual([]);
      // Short: the head is off screen only while it goes round a turn, a step or two of scroll on the page's own grid.
      expect(added.length * 50, "px of scroll the train empties that the whole line would not").toBeLessThanOrEqual(150);
    });

    it(`reaches its end at max scroll, past an edge, at ${size}`, () => {
      const { end } = checkLine(samples, anchors, opts);
      expect(end.shortPx).toBeLessThanOrEqual(1);
      expect(end.endsOff).toBe(true);
    });
  }
});

function page(width = 1200): Anchors {
  const keys = ["band", "cards", "numbers", "connect", "footer"] as const;
  const box = {} as Anchors["box"];
  const words = {} as Anchors["words"];
  keys.forEach((k, i) => {
    box[k] = { top: i * 600, bottom: (i + 1) * 600 };
    words[k] = { top: i * 600 + 100, bottom: i * 600 + 500 };
  });
  return { width, box, words, blocks: [], headings: [], links: [], hairlines: [] };
}

describe("in view, the check itself", () => {
  const opts = { ...visibleOptions(1200, 800), bandRun: false, head: { mode: "viewport" as const, headAt: 0.7, preDrawn: 0, fromBand: false } };
  // A line down the page at these x, one per 600 px band from 600 to 2400.
  const line = (xs: number[]): Point[] => xs.flatMap((x, i) => [{ x: x * 1200, y: 600 + i * 600 + 60 }, { x: x * 1200, y: 600 + i * 600 + 540 }]);
  const samples = (xs: number[]) => sampleSpine(line(xs), SAMPLE_STEP);
  it("passes a line that stays on screen", () => expect(checkLine(samples([0.5, 0.5, 0.5]), page(), opts).visible.worstGapPx).toBe(0));
  it("passes an edge run hugging the margin", () => expect(checkLine(samples([0.015, 0.5, 0.5]), page(), opts).visible.worstGapPx).toBe(0));
  it("fails a line that leaves for a section, and says where", () => {
    const report = checkLine(samples([0.5, -0.3, -0.3]), page(), opts).visible;
    expect(report.worstGapPx).toBeGreaterThan(0);
    expect(report.atY).toBeGreaterThan(400);
  });
  it("empties the screen for a line that leaves and comes back only while its head is out of frame", () => {
    // A line whose on-screen stretches sit far apart along the line but close down the page: the train lets go of the first long
    // before the second comes, while the whole line would still show the first. The head is off screen for all of that.
    const coil = sampleSpine([{ x: 600, y: 700 }, { x: 600, y: 900 }, { x: 5000, y: 910 }, { x: 5000, y: 1200 }, { x: 600, y: 1210 }, { x: 600, y: 2400 }], SAMPLE_STEP);
    const own = new Set(blankScrolls(coil, page(), { ...opts, train: null }));
    const added = blankScrolls(coil, page(), opts).filter((y) => !own.has(y));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((y) => headOutOfFrame(coil, page(), opts, y))).toBe(true);
    // A line that stays on screen has its head in view throughout.
    const ok = samples([0.5, 0.5, 0.5]);
    expect([800, 1000, 1400].some((y) => headOutOfFrame(ok, page(), opts, y))).toBe(false);
  });
});
