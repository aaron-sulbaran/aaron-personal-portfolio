import { describe, expect, it } from "vitest";
import { APERTURE_REACH, apertureBlades, pivotPoint } from "../aperture";
import { CONSTRUCTED_ALPHABET, buildConstructed, constructedInk, constructedLayout, glyphPose, glyphWidth, type GlyphPose } from "../constructed";
import { FIT_SHARE } from "../FooterStage";
import { METRICS } from "../glyphs";
import { easeToward, hoveredLetter, pivotTarget } from "../motion";
import { pathInk, pathRow } from "../pathFace";
import { band, bounds, clipHalfPlane, dBowl, mirrorX, rect, signedArea, superPoint, type Contour } from "../primitives";
import { DEFAULT_SETTINGS, PRESETS } from "../settings";
import { effectiveResponse, type TypesetFace } from "../useTypeface";
import { BAND, layoutWord, wordBand } from "../wordLayout";

const X = METRICS.xHeight;
const EPS = 1e-9;

// Nonzero winding at a point: how the renderer decides ink.
function winding(contours: readonly Contour[], x: number, y: number): number {
  let w = 0;
  for (const c of contours) {
    for (let i = 0; i < c.length; i++) {
      const [x0, y0] = c[i];
      const [x1, y1] = c[(i + 1) % c.length];
      if (y0 <= y && y1 > y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0) w++;
      else if (y0 > y && y1 <= y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0) w--;
    }
  }
  return w;
}

// The ink runs along a horizontal line, as [start, end] pairs.
function runs(contours: readonly Contour[], y: number, x1: number, step = 0.0005): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let x = -0.01; x <= x1 + 0.01; x += step) {
    const ink = winding(contours, x, y) !== 0;
    if (ink && start === null) start = x;
    if (!ink && start !== null) {
      out.push([start, x]);
      start = null;
    }
  }
  if (start !== null) out.push([start, x1]);
  return out;
}

const SHAPE = DEFAULT_SETTINGS.constructed;
const pose = (stem = SHAPE.stem, bar = SHAPE.bar, swell = 0, squash = 1): GlyphPose => glyphPose({ stem, bar, roundness: SHAPE.roundness }, 0.06, swell, squash);
const POSES = [pose(0.08, 0.06), pose(), pose(0.2, 0.15, 1), pose(0.2, 0.15, 1, 0.68), pose(0.26, 0.2, 1), pose(0.26, 0.26, 1, 0.3)];

describe("the primitives", () => {
  it("winds fills counterclockwise and cut-outs clockwise, mirrored or not", () => {
    expect(signedArea(rect(0, 0, 1, 2))).toBeCloseTo(2, 12);
    expect(signedArea(band(0, 0, 1, 1, 0.2, 0.2, 0, 180, 2))).toBeGreaterThan(0);
    const [outer, inner] = dBowl(0, 0.3, 0.3, 0.4, 0.3, 0.2, 0.15, 3);
    expect(signedArea(outer)).toBeGreaterThan(0);
    expect(signedArea(inner)).toBeLessThan(0);
    const [mOuter, mInner] = mirrorX([outer, inner], 0.7);
    expect(signedArea(mOuter)).toBeGreaterThan(0);
    expect(signedArea(mInner)).toBeLessThan(0);
  });

  it("cuts a band's ends flat along an axis at multiples of 90 degrees", () => {
    const c = band(0.5, 0.5, 0.4, 0.3, 0.1, 0.08, 180, 270, 4);
    expect(c[0][1]).toBeCloseTo(c[c.length - 1][1], 12); // the 180 end: a horizontal cut
    const mid = c.length / 2;
    expect(c[mid - 1][0]).toBeCloseTo(c[mid][0], 12); // the 270 end: a vertical cut
  });

  it("is the ellipse at exponent 2 and keeps the extremes when squared", () => {
    const [x, y] = superPoint(0, 0, 2, 1, 30, 2);
    expect(x).toBeCloseTo(2 * Math.cos(Math.PI / 6), 12);
    expect(y).toBeCloseTo(Math.sin(Math.PI / 6), 12);
    for (const deg of [0, 90, 180, 270]) {
      const [a, b] = superPoint(0, 0, 2, 1, deg, 7);
      expect(Math.abs(a) / 2 + Math.abs(b)).toBeCloseTo(1, 9);
    }
  });

  it("clips a convex polygon to a half-plane", () => {
    expect(signedArea(clipHalfPlane(rect(0, 0, 1, 1), 1, 0, 0.25))).toBeCloseTo(0.75, 12);
    expect(clipHalfPlane(rect(0, 0, 1, 1), 1, 0, 2)).toEqual([]);
  });
});

describe("the constructed alphabet", () => {
  it("covers build.stuff and the space", () => {
    for (const c of "build.stuff ") expect(CONSTRUCTED_ALPHABET).toContain(c);
  });

  it("starts each glyph at x = 0, spans its closed-form width, and never leaves the baseline or the ascender", () => {
    for (const p of POSES) {
      for (const c of "build.stuff") {
        const g = buildConstructed(c, p, null);
        const b = bounds(g.contours);
        expect(b.x0, c).toBeCloseTo(0, 9);
        expect(b.x1, c).toBeCloseTo(glyphWidth(c, p, null), 9);
        expect(b.x1, c).toBeCloseTo(g.width, 9);
        expect(b.y0, c).toBeGreaterThanOrEqual(-EPS);
        expect(b.y0, c).toBeLessThanOrEqual(EPS);
        expect(b.y1, c).toBeCloseTo(g.top, 9);
        if (p.barV === p.bar) expect(b.y1, c).toBeLessThanOrEqual(METRICS.ascender + EPS);
      }
    }
  });

  it("reads as lowercase: ascenders on b, d, l and f, the t between, the rest at the x-height", () => {
    const p = pose();
    const top = (c: string) => buildConstructed(c, p, null).top;
    for (const c of "bdlf") expect(top(c), c).toBe(METRICS.ascender);
    for (const c of "us") expect(top(c), c).toBe(X);
    expect(top("t")).toBeGreaterThan(X + 0.1);
    expect(top("t")).toBeLessThan(METRICS.ascender);
    expect(top("i")).toBeGreaterThan(X + 0.1);
  });

  it("keeps every stem the stem's thickness", () => {
    for (const p of [pose(), pose(0.26, 0.2, 1)]) {
      const S = p.stem;
      const scan = (c: string, y: number) => runs(buildConstructed(c, p, null).contours, y, glyphWidth(c, p, null)).map(([a, b]) => b - a);
      const tol = 0.002;
      for (const c of "bdli") expect(Math.min(...scan(c, X / 2)), c).toBeCloseTo(S, 2);
      for (const w of scan("u", 0.45)) expect(Math.abs(w - S), "u").toBeLessThan(tol);
      for (const w of scan("b", X / 2)) expect(Math.abs(w - S), "b").toBeLessThan(tol);
      expect(scan("t", 0.7)[0]).toBeCloseTo(S, 2);
      expect(scan("f", 0.3)[0]).toBeCloseTo(S, 2);
    }
  });

  it("joins bars to stems and curves into one shape, with no gap", () => {
    const p = pose();
    const B = p.bar;
    const count = (c: string, y: number) => runs(buildConstructed(c, p, null).contours, y, glyphWidth(c, p, null)).length;
    expect(count("b", X - B / 2)).toBe(1);
    expect(count("b", B / 2)).toBe(1);
    expect(count("d", X - B / 2)).toBe(1);
    expect(count("u", B / 2)).toBe(1);
    expect(count("s", X / 2)).toBe(1);
    expect(count("s", X - B / 4)).toBe(1);
    expect(count("s", B / 4)).toBe(1);
    expect(count("t", B / 2)).toBe(1);
    expect(count("t", X - B / 2)).toBe(1);
    expect(count("f", METRICS.ascender - B / 2)).toBe(1);
    expect(count("f", X - B / 2)).toBe(1);
    // and the i's dot is its own square
    expect(count("i", X + 0.05)).toBe(0);
    const dot = buildConstructed("i", p, null).contours[1];
    const db = bounds([dot]);
    expect(db.x1 - db.x0).toBeCloseTo(db.y1 - db.y0, 12);
  });

  it("keeps the counters open at the heaviest swell and the deepest press", () => {
    for (const p of [pose(0.32, 0.26, 1), pose(0.26, 0.26, 1, 0.3)]) {
      const S = p.stem;
      const open = (c: string, x: number, y: number) => expect(winding(buildConstructed(c, p, null).contours, x, y), `${c} at ${x}, ${y}`).toBe(0);
      open("b", S + 0.12, X / 2);
      open("d", glyphWidth("d", p, null) - S - 0.12, X / 2);
      open("u", glyphWidth("u", p, null) / 2, X / 2 + 0.05);
      // Down the s's middle: the top bar, the spine and the bottom bar, with
      // both counters open between them.
      const sc = buildConstructed("s", p, null).contours;
      const mid = glyphWidth("s", p, null) / 2;
      const ys = Array.from({ length: 600 }, (_, k) => (k + 0.5) * (X / 600));
      let bars = 0;
      let last = false;
      for (const y of ys) {
        const ink = winding(sc, mid, y) !== 0;
        if (ink && !last) bars++;
        last = ink;
      }
      expect(bars, "s").toBe(3);
    }
  });

  it("reaches the ascender and never the baseline's underside, swelled or not", () => {
    for (const swell of [0, 1]) {
      const ink = constructedInk("build.stuff", pose(SHAPE.stem, SHAPE.bar, swell), null);
      expect(ink.bottom).toBe(0);
      expect(ink.top).toBe(METRICS.ascender);
    }
  });

  it("lays the word out box after box, each letter widening with its own swell", () => {
    const rest = constructedLayout("build.stuff", 100, [pose()], 0, 0.09, null);
    const swelled = constructedLayout("build.stuff", 100, [...Array(11)].map((_, i) => (i === 0 ? pose(0.2, 0.15, 1) : pose())), 0, 0.09, null, false);
    // the b gains two stems' worth of swell (its stem and its bowl's side)
    expect(swelled.width - rest.width).toBeCloseTo(2 * 0.06 * 100, 9);
    expect(swelled.placements[1].inkX - rest.placements[1].inkX).toBeCloseTo(12, 9);
    rest.placements.forEach((p, i) => {
      if (i > 0) expect(p.boxX).toBeGreaterThan(rest.placements[i - 1].inkX + rest.placements[i - 1].width - EPS);
    });
  });
});

describe("the shutter period", () => {
  const area = (cs: readonly Contour[]) => cs.reduce((a, c) => a + signedArea(c), 0);

  it("fills the square with its blades but for the gaps, at rest and leaning the whole reach", () => {
    for (const blades of [3, 4] as const) {
      for (let k = 0; k <= 16; k++) {
        const pivot = k === 16 ? { x: 0, y: 0 } : { x: Math.cos((k * Math.PI) / 8), y: Math.sin((k * Math.PI) / 8) };
        const pieces = apertureBlades(blades, 0.08, pivot);
        expect(pieces.length, `${blades} at ${k}`).toBe(2 * blades);
        for (const piece of pieces) {
          expect(signedArea(piece)).toBeGreaterThan(0);
          for (const [x, y] of piece) {
            expect(x).toBeGreaterThanOrEqual(-EPS);
            expect(x).toBeLessThanOrEqual(1 + EPS);
            expect(y).toBeGreaterThanOrEqual(-EPS);
            expect(y).toBeLessThanOrEqual(1 + EPS);
          }
        }
        expect(area(pieces)).toBeLessThan(1);
        expect(area(pieces)).toBeGreaterThan(0.7);
      }
    }
  });

  it("holds the pivot to its reach", () => {
    expect(pivotPoint({ x: 0, y: 0 })).toEqual([0.5, 0.5]);
    const [x, y] = pivotPoint({ x: 3, y: 4 });
    expect(Math.hypot(x - 0.5, y - 0.5)).toBeCloseTo(APERTURE_REACH, 12);
  });

  it("replaces the constructed period with a square of blades the scale of a stem", () => {
    const p = pose();
    const g = buildConstructed(".", p, { blades: 4, scale: 1.3, gap: 0.08 });
    const b = bounds(g.contours);
    expect(b.x1 - b.x0).toBeCloseTo(0.26, 9);
    expect(b.y1 - b.y0).toBeCloseTo(0.26, 9);
    expect(glyphWidth(".", p, { blades: 4, scale: 1.3, gap: 0.08 })).toBeCloseTo(0.26, 12);
  });
});

describe("the new motion", () => {
  it("eases the pivot independent of frame rate", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = easeToward(a, 1, 0.12, 1 / 60);
    let b = 0;
    for (let i = 0; i < 120; i++) b = easeToward(b, 1, 0.12, 1 / 120);
    expect(a).toBeCloseTo(b, 10);
    expect(easeToward(0, 1, 0.12, 1 / 60)).toBeCloseTo(0.12, 12);
    expect(easeToward(0.3, 1, 1, 0.016)).toBe(1);
  });

  it("aims the pivot at the pointer, the whole reach from afar, y up", () => {
    expect(pivotTarget(0, -500, 10)).toEqual([0, 1]);
    const [x, y] = pivotTarget(300, 400, 10);
    expect(x).toBeCloseTo(0.6, 12);
    expect(y).toBeCloseTo(-0.8, 12);
    expect(pivotTarget(5, 0, 10)).toEqual([0.5, -0]);
    expect(pivotTarget(5, 0, 0)).toEqual([0, 0]);
  });

  it("finds the letter under the pointer, and none between, above or below", () => {
    const xs = [10, 40, 70];
    const halves = [8, 8, 8];
    expect(hoveredLetter(42, 50, xs, halves, 0, 100, 2)).toBe(1);
    expect(hoveredLetter(25, 50, xs, halves, 0, 100, 2)).toBe(-1);
    expect(hoveredLetter(21, 50, xs, halves, 0, 100, 4)).toBe(0);
    expect(hoveredLetter(42, -1, xs, halves, 0, 100, 2)).toBe(-1);
    expect(hoveredLetter(42, 101, xs, halves, 0, 100, 2)).toBe(-1);
  });

  it("slices only a path face; a typeset face swells or grows instead", () => {
    const face = (canSwell: boolean) => ({ canSwell }) as TypesetFace;
    expect(effectiveResponse("slice", null)).toBe("slice");
    expect(effectiveResponse("lean", null)).toBe("swell");
    expect(effectiveResponse("slice", face(true))).toBe("swell");
    expect(effectiveResponse("slice", face(false))).toBe("grow");
  });
});

describe("the round 3 preset", () => {
  const round2 = PRESETS.find((p) => p.id === "round2")!.settings;
  const round3 = PRESETS.find((p) => p.id === "round3")!;

  it("is first, new, and the default; round 2 stays selectable as Aaron's pick", () => {
    expect(PRESETS[0]).toBe(round3);
    expect(round3.name).toBe("Round 3, constructed");
    expect(round3.tag).toBe("new");
    expect(round3.settings).toBe(DEFAULT_SETTINGS);
    expect(PRESETS.find((p) => p.id === "round2")!.tag).toBe("pick");
  });

  it("takes round 2's field, floor and Connect row, with the constructed face, the shutter and the swell", () => {
    const s = round3.settings;
    expect(s.field).toEqual(round2.field);
    expect(s.floor).toBe(round2.floor);
    expect(s.connect).toBe(round2.connect);
    expect(s.face).toBe("constructed");
    expect(s.aperture.on).toBe(true);
    expect(s.response).toBe("swell");
    expect(s.constructed.stem).toBe(round2.weight);
  });

  it("spans what round 2's word does, under the wide-face cap", () => {
    const span3 = pathRow("constructed", "build.stuff", round3.settings.heightVw / 100, round3.settings).width;
    const span2 = layoutWord("build.stuff", round2.heightVw / 100, [round2.weight], round2.tracking).width;
    expect(Math.abs(span3 - span2)).toBeLessThan(0.01);
    expect(span3).toBeLessThan(FIT_SHARE);
  });

  it("rests whole above the bottom edge at floor 0, swelled or not", () => {
    const s = round3.settings;
    const reach = pathInk("constructed", "build.stuff", s, true);
    const rest = pathInk("constructed", "build.stuff", s, false);
    const band = wordBand(150, reach, rest, 0, s.gap);
    expect(band.baselineFromBottom - reach.bottom * 150).toBeCloseTo(BAND.bottomClear * 150, 9);
    expect(reach.bottom).toBe(0);
  });
});
