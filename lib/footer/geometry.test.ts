import { describe, expect, it } from "vitest";
import { FOOTER } from "./constants";
import { glyphPose, glyphWidth } from "./face";
import { falloff } from "./motion";
import {
  bandShare,
  fieldDepths,
  fieldMaskImage,
  fieldStops,
  footerGeometry,
  lettersRect,
  reachInk,
  rippleReach,
  sizeShare,
  swelledXs,
  unitWidth,
  wordRest,
} from "./geometry";

const TEXT = "build.stuff";
const EPS = 1e-9;
const WIDTHS = [320, 390, 768, 1024, 1440, 2560];

describe("the word's size and band", () => {
  it("holds Aaron's 14.5vw to 92 percent of the width, the band 1.4 of the size", () => {
    expect(unitWidth(TEXT)).toBeCloseTo(6.76125, 9);
    expect((FOOTER.heightVw / 100) * unitWidth(TEXT)).toBeGreaterThan(FOOTER.fitShare);
    expect(sizeShare(TEXT)).toBeCloseTo(FOOTER.fitShare / 6.76125, 12);
    expect(reachInk(TEXT)).toEqual({ top: 1, bottom: 0 });
    expect(bandShare(TEXT)).toBeCloseTo(1.4 * sizeShare(TEXT), 12);
    expect(bandShare(TEXT)).toBeCloseTo(0.1905, 4);
  });

  it("lays the baseline, the top, the rise's clip and the rise's start out of the band", () => {
    const g = footerGeometry(TEXT, 1440, 454, 180);
    expect(g.size).toBeCloseTo(195.94, 2);
    const band = bandShare(TEXT) * 1440;
    expect(g.baselineY).toBeCloseTo(180 + band - FOOTER.bottomClear * g.size, 9);
    expect(g.wordTop).toBeCloseTo(g.baselineY - g.size, 9);
    expect(g.wordTop - 180).toBeCloseTo(FOOTER.gap * g.size, 9);
    expect(g.clipBottom).toBeCloseTo(g.baselineY + FOOTER.rise.floor * g.size, 9);
    expect(g.clipBottom).toBeLessThan(180 + band);
    expect(g.riseDistance).toBeCloseTo(1.06 * g.size + 4, 9);
  });
});

describe("no glyph is ever clipped", () => {
  it("keeps every letter inside the footer at rest and with the pointer anywhere over the word", () => {
    for (const w of WIDTHS) {
      const g = footerGeometry(TEXT, w, 600, 200);
      const rest = wordRest(TEXT, g);
      const chars = [...TEXT];
      const radius = FOOTER.swell.radius * g.size;
      for (let px = -radius; px <= w + radius; px += w / 200) {
        for (const py of [g.wordTop, (g.wordTop + g.baselineY) / 2, g.baselineY]) {
          const swells = rest.centers.map((c) => falloff(Math.hypot(px - c.x, py - c.y), radius));
          const xs = swelledXs(TEXT, g, swells);
          const right = Math.max(...xs.map((x, i) => x + glyphWidth(chars[i], glyphPose(FOOTER.face, FOOTER.swell.amount, swells[i])) * g.size));
          expect(xs[0], `${w} at ${px}`).toBeGreaterThanOrEqual(0);
          expect(right, `${w} at ${px}`).toBeLessThanOrEqual(w * 0.98);
        }
      }
      expect(g.wordTop).toBeGreaterThan(g.bandTop);
      expect(g.baselineY).toBeLessThan(g.bandTop + bandShare(TEXT) * w);
    }
  });

  it("centers the word at rest across 92 percent of the width", () => {
    const g = footerGeometry(TEXT, 1440, 454, 180);
    const rest = wordRest(TEXT, g);
    const chars = [...TEXT];
    const right = rest.xs[10] + glyphWidth(chars[10], glyphPose(FOOTER.face, FOOTER.swell.amount, 0)) * g.size;
    expect(rest.xs[0]).toBeGreaterThan(0.04 * 1440);
    expect(right).toBeLessThan(0.96 * 1440);
    expect(rest.centers[5].x / 1440).toBeCloseTo(0.4824, 3); // the period
    expect(rest.halfWidths[5]).toBeCloseTo((FOOTER.face.stem * g.size) / 2, 9);
  });
});

describe("the field's stops and mask", () => {
  it("keeps the rise, the hold and the fade in order", () => {
    expect(fieldStops(100, 150, 400)).toEqual({ inEnd: 100, start: 250 });
  });

  it("meets in proportion when the rise and the fade overlap, never out of order", () => {
    const { inEnd, start } = fieldStops(120, 60, 90);
    expect(inEnd).toBeCloseTo(60, 9);
    expect(start).toBe(inEnd);
    for (const [rise, fall, stop] of [
      [0, 0, 50],
      [300, 0, 50],
      [0, 300, 50],
      [10, 10, 0],
    ]) {
      const r = fieldStops(rise, fall, stop);
      expect(r.inEnd).toBeLessThanOrEqual(r.start);
      expect(r.start).toBeLessThanOrEqual(stop);
      expect(r.inEnd).toBeGreaterThanOrEqual(0);
    }
  });

  it("writes the mask in order, ending at the word's top with the letters' depth below", () => {
    const g = footerGeometry(TEXT, 1440, 454, 180);
    const mask = fieldMaskImage(g, 1);
    const stops = [...mask.matchAll(/([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(stops).toHaveLength(5);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThanOrEqual(stops[i - 1]);
    expect(stops[4]).toBeCloseTo(g.wordTop, 2);
    expect(mask.endsWith(`black ${g.wordTop.toFixed(2)}px)`)).toBe(true);
    expect(fieldMaskImage(g, 1.2 / 1.8)).toContain("rgba(0, 0, 0, 0.6667)");
  });

  it("draws each depth itself when live, and holds the footer's share of the deeper one on the poster", () => {
    expect(fieldDepths(true)).toEqual({ canvas: 1.2, backdropShare: 1 });
    const poster = fieldDepths(false);
    expect(poster.canvas).toBe(1.8);
    expect(poster.backdropShare).toBeCloseTo(1.2 / 1.8, 12);
  });
});

describe("the letters' rect and the ripple's reach", () => {
  it("pads the word's rect as the hero pads its lockup, the band starting just over the word's top", () => {
    const g = footerGeometry(TEXT, 1440, 454, 180);
    const { band, rect } = lettersRect(TEXT, g);
    expect(band).toBeCloseTo(g.wordTop - 2, 9);
    expect(rect.w).toBeCloseTo(FOOTER.fitShare * 1440 + 2 * FOOTER.field.surfacePad * g.size, 6);
    expect(rect.x + rect.w / 2).toBeCloseTo(720, 9);
    expect(rect.h).toBeCloseTo(g.size * (1 + 2 * FOOTER.field.surfacePad), 9);
  });

  it("runs to the stage's far corner", () => {
    const g = footerGeometry(TEXT, 1000, 400, 100);
    expect(rippleReach(g, { x: 300, y: 380 })).toBeCloseTo(Math.hypot(700, 380) / g.size, 9);
    expect(rippleReach(g, { x: 300, y: 380 })).toBeGreaterThan(EPS);
  });
});
