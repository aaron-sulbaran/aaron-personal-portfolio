import { describe, expect, it } from "vitest";
import pages from "./fixtures/pages.json";
import { DRAW_SPEED, HEAD_SMOOTHING, RUN_START, SAMPLE_STEP, TRAIN_FADE, TRAIN_PX } from "./constants";
import { HEAD_PARAMS, bandLineY, createHead, firstOnScreenY, gatedTarget, headTarget, runLength, stepHead, tailStart } from "./head";
import { layLine } from "./line";
import type { Anchors } from "./spine";

describe("the head", () => {
  it("waits at the run's end until the visitor answers; reduced motion takes the whole line", () => {
    expect(gatedTarget(900, 300, 5000, false, false)).toBe(300);
    expect(gatedTarget(900, 300, 5000, true, false)).toBe(900);
    expect(gatedTarget(900, 300, 5000, false, true)).toBe(5000);
  });
  it("is capped at the draw speed, eases in, never passes its target, and a 2600px flick arrives within 1.8s and rests within 2.8s", () => {
    const h = createHead();
    h.target = 2600;
    let t = 0, arrived = 0, last = 0;
    while (h.head !== h.target && t < 5) {
      stepHead(h, 1 / 60, false);
      t += 1 / 60;
      expect((h.head - last) * 60).toBeLessThanOrEqual(DRAW_SPEED + 1e-6);
      expect(h.head).toBeLessThanOrEqual(h.target);
      if (t < 1 / 30) expect(h.vel).toBeLessThan(DRAW_SPEED * 0.15);
      if (!arrived && h.target - h.head < 50) arrived = t;
      last = h.head;
    }
    expect(arrived).toBeLessThan(1.8);
    expect(t).toBeLessThan(2.8);
  });
  it("goes no faster than the cap the view sets, and slows into its target without a lurch", () => {
    const h = createHead();
    h.target = 1000;
    h.cap = 600;
    let t = 0, last = 0, before = 0;
    while (h.head !== h.target && t < 10) {
      stepHead(h, 1 / 60, false);
      t += 1 / 60;
      expect(h.vel).toBeLessThanOrEqual(600 + 1e-6);
      // Slowing: the speed falls with the gap, never a step in one frame, and it stays under a gentle 3,000 px/s per second.
      if (h.head - last > 0 && h.target - h.head < 600 / HEAD_SMOOTHING) expect(before - h.vel).toBeLessThan(3000 / 60);
      before = h.vel;
      last = h.head;
    }
    expect(t, "a stretch of 1000px at 600px/s takes at least its distance over the cap").toBeGreaterThanOrEqual(1000 / 600);
    expect(h.head).toBe(1000);
  });
  it("turns round over a moment when the target falls behind it, never in a single frame", () => {
    const h = createHead();
    h.target = 3000;
    h.cap = 600;
    for (let k = 0; k < 120; k++) stepHead(h, 1 / 60, false);
    expect(h.vel).toBeGreaterThan(500);
    h.target = h.head - 3000;
    stepHead(h, 1 / 60, false);
    expect(h.vel, "one frame after the turn").toBeGreaterThan(300);
    for (let k = 0; k < 120; k++) stepHead(h, 1 / 60, false);
    expect(h.vel).toBeLessThan(-500);
  });
  it("holds the tail back over the run, so the run stays whole while the head leaves it", () => {
    expect(tailStart(2000, TRAIN_PX, TRAIN_PX * TRAIN_FADE, 2000)).toBeLessThan(0);
    expect(tailStart(2000 + TRAIN_PX, TRAIN_PX, TRAIN_PX * TRAIN_FADE, 2000)).toBe(2000);
  });
  it("is the line's end at the page's maximum scroll", () => {
    const anchors = pages["1440x900"].anchors as Anchors;
    const { samples } = layLine(anchors, 900);
    const maxScrollY = anchors.box.footer.bottom - 900;
    const at = headTarget(HEAD_PARAMS, { samples, viewport: 900, scrollY: maxScrollY, maxScrollY, layerTop: 0, runLen: runLength(samples, 1440), entryY: firstOnScreenY(samples, 1440) });
    expect(samples.length - at).toBeLessThanOrEqual(1);
  });
});

describe("the band's run", () => {
  const a1440 = pages["1440x900"].anchors as Anchors;
  it("starts the line as a level run on the band's measured line, from 24px past the left edge", () => {
    const { samples, route } = layLine({ ...a1440, line: 135 }, 900);
    expect(route.points[0]).toEqual({ x: RUN_START, y: 135 });
    const run = runLength(samples, 1440);
    expect(Math.abs(run - (1440 - 1 - RUN_START))).toBeLessThanOrEqual(SAMPLE_STEP);
    for (let i = 0; i * SAMPLE_STEP < run; i++) expect(Math.abs(samples.y[i] - 135)).toBeLessThan(0.5);
  });
  it("reads the measured band line, else the lab's formula", () => {
    expect(bandLineY({ ...a1440, line: 200 }, 900)).toBe(200);
    expect(bandLineY(a1440, 900)).toBe(a1440.words.band.top - 20 + 270 / 2);
  });
});
