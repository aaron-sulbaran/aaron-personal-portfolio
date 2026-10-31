import { describe, expect, it } from "vitest";
import layout from "./fixtures/layout.json";
import pages from "./fixtures/pages.json";
import { SAMPLE_STEP, TRAIN_PX } from "./constants";
import { sampleSpine, type Point } from "./geometry";
import { layLine } from "./line";
import type { Anchors } from "./spine";
import { blankScrolls, checkLine, chooseTrain, visibleOptions } from "./visible";

const measured = { ...Object.fromEntries(Object.entries(pages).map(([k, v]) => [`pages ${k}`, v])), ...Object.fromEntries(Object.entries(layout).map(([k, v]) => [`layout ${k}`, v])) } as Record<string, { anchors: unknown; viewport: number }>;
const sizes = Object.keys(measured);

describe("in view, the shipped line", () => {
  for (const size of sizes) {
    const anchors = measured[size].anchors as Anchors;
    const viewport = measured[size].viewport;
    const opts = visibleOptions(anchors.width, viewport);
    const { samples } = layLine(anchors, viewport);

    // The serpentine stays off screen past words with no gap to cross in: the screen may be empty there, and only there. The train
    // never adds an empty screen to those: it lets go of a crossing only once the crossing has left the view.
    it(`keeps the train, which never empties a screen the whole line would not, at ${size}`, () => {
      expect(chooseTrain(samples, anchors, opts)).toBe(TRAIN_PX);
      const own = new Set(blankScrolls(samples, anchors, { ...opts, train: null }));
      expect(blankScrolls(samples, anchors, opts).filter((y) => !own.has(y))).toEqual([]);
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
  it("keeps the train for a line whose empty screens are its own, draws the whole line when the train would add one", () => {
    const ok = samples([0.5, 0.5, 0.5]);
    expect(chooseTrain(ok, page(), opts)).toBe(opts.train);
    // A line whose on-screen stretches sit far apart along the line but close down the page: the train lets go of the first long
    // before the second comes, while the whole line would still show the first.
    const coil = sampleSpine([{ x: 600, y: 700 }, { x: 600, y: 900 }, { x: 5000, y: 910 }, { x: 5000, y: 1200 }, { x: 600, y: 1210 }, { x: 600, y: 2400 }], SAMPLE_STEP);
    expect(chooseTrain(coil, page(), opts)).toBeNull();
  });
});
