import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { BAND_CLEAR_EXTRA, SAMPLE_STEP } from "./constants";
import { dotReach } from "./columns";
import { sampleSpine } from "./geometry";
import { runLength } from "./head";
import { SIGNATURE_ON, resolveSpine, type Anchors } from "./spine";
import { amplitudeFor } from "./visible";

// The wave as one line: after the band's run the line must not come back
// across the band. Checked on the page measured at three widths, and on the
// same page with the band moved up (the book taken away), since nothing in the
// line may depend on where the band sits in the document.

const SIZES = ["1440x900", "1024x768", "390x844"] as const;
const clearOf = (anchors: Anchors) => dotReach(amplitudeFor(anchors.width)) + BAND_CLEAR_EXTRA;

// The sections below the band closer to it by `by` px (a shorter page between them), the hardest case for a line that must keep its distance from the band.
// The spine itself is measured from the band's own top, so where the band sits in the document (the book taken away) cannot change it; the e2e (e2e/player.spec.ts) covers the document side.
function closer(anchors: Anchors, by: number): Anchors {
  const shift = (span: { top: number; bottom: number }) => ({ top: span.top - by, bottom: span.bottom - by });
  const box = { ...anchors.box };
  const words = { ...anchors.words };
  for (const key of Object.keys(anchors.box) as (keyof Anchors["box"])[]) {
    if (key === "band") continue;
    box[key] = shift(anchors.box[key]);
    words[key] = shift(anchors.words[key]);
  }
  return { ...anchors, box, words, blocks: anchors.blocks.map((b) => ({ ...b, top: b.top - by, bottom: b.bottom - by })) };
}

// The samples after the run that are on screen across the width, and how far above `limit` the highest one is.
function intrusion(anchors: Anchors, viewport: number, clearBand: number | undefined, limit: number) {
  const samples = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport, clearBand }), SAMPLE_STEP);
  const run = runLength(samples, anchors.width);
  let worst = 0;
  for (let i = Math.ceil(run / SAMPLE_STEP) + 1; i < samples.count; i++) {
    if (samples.x[i] < 0 || samples.x[i] > anchors.width) continue;
    worst = Math.max(worst, limit - samples.y[i]);
    if (samples.y[i] > limit + 400) break;
  }
  return worst;
}

describe("the line after the band's run, as one line", () => {
  for (const size of SIZES) {
    const page = pages[size] as { anchors: Anchors; viewport?: number };
    const anchors = page.anchors;
    const viewport = Number(size.split("x")[1]);
    const clear = clearOf(anchors);

    it(`today comes back across the band at ${size} (the overlap Aaron saw)`, () => {
      expect(intrusion(anchors, viewport, undefined, anchors.box.band.bottom)).toBeGreaterThan(20);
    });

    it(`with the clearance, never crosses the band's box nor its dots' reach at ${size}`, () => {
      expect(intrusion(anchors, viewport, clear, anchors.box.band.bottom + clear)).toBeLessThan(4);
    });

    it(`keeps that clearance even with the sections far closer to the band at ${size}`, () => {
      const near = closer(anchors, 120);
      expect(intrusion(near, viewport, clear, near.box.band.bottom + clear)).toBeLessThan(4);
    });

    it(`does not depend on the band's place in the document: the spine is the same wherever the band sits at ${size}`, () => {
      const here = resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport, clearBand: clear });
      const again = resolveSpine({ points: SIGNATURE_ON }, JSON.parse(JSON.stringify(anchors)) as Anchors, { bandRun: true, viewport, clearBand: clear });
      expect(again).toEqual(here);
    });

    it(`still starts as the level run and still ends where the line always did at ${size}`, () => {
      const plain = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport }), SAMPLE_STEP);
      const one = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport, clearBand: clear }), SAMPLE_STEP);
      expect(runLength(one, anchors.width)).toBe(runLength(plain, anchors.width));
      const n = Math.min(plain.count, one.count) - 1;
      for (let i = 0; i * SAMPLE_STEP < runLength(plain, anchors.width); i++) expect(Math.abs(one.y[i] - plain.y[i])).toBeLessThan(0.1);
      expect(one.length).toBeGreaterThan(plain.length * 0.9);
      expect(n).toBeGreaterThan(100);
    });
  }

  it("leaves the line alone with no clearance asked for", () => {
    const anchors = (pages["1440x900"] as { anchors: Anchors }).anchors;
    const a = resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport: 900 });
    const b = resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport: 900, clearBand: 0 });
    expect(b).toEqual(a);
  });
});
