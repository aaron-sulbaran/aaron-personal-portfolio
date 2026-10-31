import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { BAND_CLEAR_EXTRA } from "./constants";
import { dotReach } from "./columns";
import { runLength } from "./head";
import { layLine } from "./line";
import type { Anchors } from "./spine";
import { amplitudeFor } from "./visible";

// The wave as one line: after the band's run the line must not come back
// across the band. Checked on the page measured at three widths, and on the
// same page with the band moved up (the book taken away), since nothing in the
// line may depend on where the band sits in the document.

const SIZES = ["1440x900", "1024x768", "390x844"] as const;
const clearOf = (anchors: Anchors) => dotReach(amplitudeFor(anchors.width)) + BAND_CLEAR_EXTRA;

// The sections below the band closer to it by `by` px (a shorter page between them), the hardest case for a line that must keep its distance from the band.
// The route itself is measured from the band's own top, so where the band sits in the document (the book taken away) cannot change it; the e2e (e2e/player.spec.ts) covers the document side.
function closer(anchors: Anchors, by: number): Anchors {
  const shift = <T extends { top: number; bottom: number }>(span: T): T => ({ ...span, top: span.top - by, bottom: span.bottom - by });
  const box = { ...anchors.box };
  const words = { ...anchors.words };
  for (const key of Object.keys(anchors.box) as (keyof Anchors["box"])[]) {
    if (key === "band") continue;
    box[key] = shift(anchors.box[key]);
    words[key] = shift(anchors.words[key]);
  }
  const below = (r: { top: number }) => r.top > anchors.box.band.bottom;
  const move = <T extends { top: number; bottom: number }>(rs: T[]) => rs.map((r) => (below(r) ? shift(r) : r));
  return { ...anchors, box, words, blocks: move(anchors.blocks), links: move(anchors.links), headings: move(anchors.headings) };
}

// The samples after the run that are on screen across the width, and how far above `limit` the highest one is.
function intrusion(anchors: Anchors, viewport: number, limit: number) {
  const { samples } = layLine(anchors, viewport);
  const run = runLength(samples, anchors.width);
  let worst = 0;
  for (let i = Math.ceil(run / samples.step) + 1; i < samples.count; i++) {
    if (samples.x[i] < 0 || samples.x[i] > anchors.width) continue;
    worst = Math.max(worst, limit - samples.y[i]);
  }
  return worst;
}

describe("the line after the band's run, as one line", () => {
  for (const size of SIZES) {
    const anchors = pages[size].anchors as Anchors;
    const viewport = Number(size.split("x")[1]);
    const clear = clearOf(anchors);

    it(`never crosses the band's box nor its dots' reach at ${size}`, () => {
      expect(intrusion(anchors, viewport, anchors.box.band.bottom + clear)).toBeLessThan(4);
    });

    it(`keeps that clearance even with the sections far closer to the band at ${size}`, () => {
      const near = closer(anchors, 120);
      expect(intrusion(near, viewport, near.box.band.bottom + clear)).toBeLessThan(4);
    });

    it(`does not depend on anything but the page: the same anchors lay the same line at ${size}`, () => {
      const here = layLine(anchors, viewport).route.points;
      const again = layLine(JSON.parse(JSON.stringify(anchors)) as Anchors, viewport).route.points;
      expect(again).toEqual(here);
    });
  }
});
