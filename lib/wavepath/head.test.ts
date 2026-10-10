import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { DRAW_SPEED, SAMPLE_STEP, TRAIN_FADE, TRAIN_PX } from "./constants";
import { sampleSpine } from "./geometry";
import { HEAD_PARAMS, createHead, firstOnScreenY, gatedTarget, headTarget, runLength, stepHead, tailStart } from "./head";
import { SIGNATURE_ON, resolveSpine, type Anchors } from "./spine";

describe("the head", () => {
  it("waits at the run's end until the visitor answers; reduced motion takes the whole line", () => {
    expect(gatedTarget(900, 300, 5000, false, false)).toBe(300);
    expect(gatedTarget(900, 300, 5000, true, false)).toBe(900);
    expect(gatedTarget(900, 300, 5000, false, true)).toBe(5000);
  });
  it("is capped at the draw speed, eases in, and a 2600px flick arrives within 1.4s and rests within 2.15s", () => {
    const h = createHead();
    h.target = 2600;
    let t = 0, arrived = 0, last = 0;
    while (h.head !== h.target && t < 5) {
      stepHead(h, 1 / 60, false);
      t += 1 / 60;
      expect((h.head - last) * 60).toBeLessThanOrEqual(DRAW_SPEED + 1e-6);
      if (t < 1 / 30) expect(h.vel).toBeLessThan(DRAW_SPEED * 0.15);
      if (!arrived && h.target - h.head < 50) arrived = t;
      last = h.head;
    }
    expect(arrived).toBeLessThan(1.4);
    expect(t).toBeLessThan(2.15);
  });
  it("holds the tail back over the run, so the run stays whole while the head leaves it", () => {
    expect(tailStart(2000, TRAIN_PX, TRAIN_PX * TRAIN_FADE, 2000)).toBeLessThan(0);
    expect(tailStart(2000 + TRAIN_PX, TRAIN_PX, TRAIN_PX * TRAIN_FADE, 2000)).toBe(2000);
  });
  it("is the line's end at the page's maximum scroll", () => {
    const anchors = pages["1440x900"].anchors as Anchors;
    const samples = sampleSpine(resolveSpine({ points: SIGNATURE_ON }, anchors, { bandRun: true, viewport: 900 }), SAMPLE_STEP);
    const maxScrollY = anchors.box.footer.bottom - 900;
    const at = headTarget(HEAD_PARAMS, { samples, viewport: 900, scrollY: maxScrollY, maxScrollY, layerTop: 0, runLen: runLength(samples, 1440), entryY: firstOnScreenY(samples, 1440) });
    expect(samples.length - at).toBeLessThanOrEqual(1);
  });
});
