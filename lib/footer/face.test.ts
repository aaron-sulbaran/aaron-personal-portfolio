import { describe, expect, it } from "vitest";
import { FOOTER } from "./constants";
import { ALPHABET, METRICS, buildGlyph, glyphOutline, glyphPose, glyphWidth, layoutWord, wordInk, type GlyphPose } from "./face";
import { band, bounds, dBowl, mirrorX, rect, signedArea, superPoint, type Contour } from "./primitives";

// Ported from the footer lab's round 3 and round 4 tests (branch lab,
// app/lab/footer/tests/, commit 22d3b4f), held to Aaron's face.

const X = METRICS.xHeight;
const EPS = 1e-9;
const F = FOOTER.face;
const AMOUNT = FOOTER.swell.amount;

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

const pose = (stem: number = F.stem, bar: number = F.bar, swell = 0, squash = 1): GlyphPose => glyphPose({ stem, bar, roundness: F.roundness }, AMOUNT, swell, squash);
// Aaron's face at rest, at the heaviest swell, and at the heaviest swell pressed
// to its deepest; then the extremes the lab held every face to.
const AARON = [pose(), pose(F.stem, F.bar, 1), pose(F.stem, F.bar, 1, 1 - FOOTER.press.depth)];
const POSES = [...AARON, pose(0.08, 0.06), pose(0.2, 0.15, 1, 0.68), pose(0.26, 0.2, 1), pose(0.26, 0.26, 1, 0.3)];

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
    expect(c[0][1]).toBeCloseTo(c[c.length - 1][1], 12);
    const mid = c.length / 2;
    expect(c[mid - 1][0]).toBeCloseTo(c[mid][0], 12);
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
});

describe("the face", () => {
  it("covers build.stuff and the space", () => {
    for (const c of "build.stuff ") expect(ALPHABET).toContain(c);
  });

  it("starts each glyph at x = 0, spans its closed-form width, and never leaves the baseline or the ascender", () => {
    for (const p of POSES) {
      for (const c of "build.stuf") {
        const g = buildGlyph(c, p);
        const b = bounds(g.contours);
        expect(b.x0, c).toBeCloseTo(0, 9);
        expect(b.x1, c).toBeCloseTo(glyphWidth(c, p), 9);
        expect(b.x1, c).toBeCloseTo(g.width, 9);
        expect(b.y0, c).toBeGreaterThanOrEqual(-EPS);
        expect(b.y0, c).toBeLessThanOrEqual(EPS);
        expect(b.y1, c).toBeCloseTo(g.top, 9);
        if (p.barV === p.bar) expect(b.y1, c).toBeLessThanOrEqual(METRICS.ascender + EPS);
      }
    }
  });

  it("keeps Aaron's face whole at rest, at the heaviest swell and pressed to the deepest", () => {
    for (const p of AARON) {
      for (const c of "build.stuf") {
        const b = bounds(buildGlyph(c, p).contours);
        expect(b.x0, c).toBeGreaterThanOrEqual(-EPS);
        expect(b.x1, c).toBeLessThanOrEqual(glyphWidth(c, p) + EPS);
        expect(b.y0, c).toBeGreaterThanOrEqual(-EPS);
      }
    }
    expect(wordInk("build.stuff", AARON[1])).toEqual({ top: 1, bottom: 0 });
  });

  it("reads as lowercase: ascenders on b, d, l and f, the t between, the rest at the x-height", () => {
    const p = pose();
    const top = (c: string) => buildGlyph(c, p).top;
    for (const c of "bdlf") expect(top(c), c).toBe(METRICS.ascender);
    for (const c of "us") expect(top(c), c).toBe(X);
    expect(top("t")).toBeGreaterThan(X + 0.1);
    expect(top("t")).toBeLessThan(METRICS.ascender);
    expect(top("i")).toBeGreaterThan(X + 0.1);
  });

  it("keeps every stem the stem's thickness", () => {
    for (const p of [pose(), pose(F.stem, F.bar, 1), pose(0.26, 0.2, 1)]) {
      const S = p.stem;
      const scan = (c: string, y: number) => runs(buildGlyph(c, p).contours, y, glyphWidth(c, p)).map(([a, b]) => b - a);
      const tol = 0.002;
      for (const c of "bdli") expect(Math.min(...scan(c, X / 2)), c).toBeCloseTo(S, 2);
      for (const w of scan("u", 0.45)) expect(Math.abs(w - S), "u").toBeLessThan(tol);
      for (const w of scan("b", X / 2)) expect(Math.abs(w - S), "b").toBeLessThan(tol);
      expect(scan("t", 0.7)[0]).toBeCloseTo(S, 2);
      expect(scan("f", 0.3)[0]).toBeCloseTo(S, 2);
    }
  });

  it("joins bars to stems and curves into one shape, with no gap", () => {
    for (const p of [pose(), pose(F.stem, F.bar, 1)]) {
      const B = p.bar;
      const count = (c: string, y: number) => runs(buildGlyph(c, p).contours, y, glyphWidth(c, p)).length;
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
      expect(count("i", X + 0.05)).toBe(0);
      const dot = bounds([buildGlyph("i", p).contours[1]]);
      expect(dot.x1 - dot.x0).toBeCloseTo(dot.y1 - dot.y0, 12);
    }
  });

  it("keeps the counters open at the heaviest swell and the deepest press", () => {
    for (const p of [AARON[1], AARON[2], pose(0.32, 0.26, 1), pose(0.26, 0.26, 1, 0.3)]) {
      const S = p.stem;
      const open = (c: string, x: number, y: number) => expect(winding(buildGlyph(c, p).contours, x, y), `${c} at ${x}, ${y}`).toBe(0);
      open("b", S + 0.12, X / 2);
      open("d", glyphWidth("d", p) - S - 0.12, X / 2);
      open("u", glyphWidth("u", p) / 2, X / 2 + 0.05);
      // Down the s's middle: the top bar, the spine and the bottom bar, with both counters open between them.
      const sc = buildGlyph("s", p).contours;
      const mid = glyphWidth("s", p) / 2;
      let bars = 0;
      let last = false;
      for (let k = 0; k < 600; k++) {
        const ink = winding(sc, mid, (k + 0.5) * (X / 600)) !== 0;
        if (ink && !last) bars++;
        last = ink;
      }
      expect(bars, "s").toBe(3);
    }
  });

  it("reaches the ascender and never the baseline's underside, swelled or not", () => {
    for (const swell of [0, 1]) expect(wordInk("build.stuff", pose(F.stem, F.bar, swell))).toEqual({ top: METRICS.ascender, bottom: 0 });
  });

  it("lays the word out box after box, each letter widening with its own swell", () => {
    const rest = layoutWord("build.stuff", 100, [pose()], 0, F.gap);
    const swelled = layoutWord("build.stuff", 100, [...Array(11)].map((_, i) => (i === 0 ? pose(F.stem, F.bar, 1) : pose())), 0, F.gap, false);
    // the b gains two stems' worth of swell (its stem and its bowl's side)
    expect(swelled.width - rest.width).toBeCloseTo(2 * AMOUNT * 100, 9);
    expect(swelled.placements[1].inkX - rest.placements[1].inkX).toBeCloseTo(2 * AMOUNT * 100, 9);
    rest.placements.forEach((p, i) => {
      if (i > 0) expect(p.boxX).toBeGreaterThan(rest.placements[i - 1].inkX + rest.placements[i - 1].width - EPS);
    });
  });

  it("spans 6.76125 units at rest with Aaron's stem and gap", () => {
    expect(layoutWord("build.stuff", 1, [pose()], FOOTER.tracking, F.gap).width).toBeCloseTo(6.76125, 9);
  });

  it("draws a glyph's outline as closed path data, y down", () => {
    const d = glyphOutline("l", 100, pose());
    expect(d).toBe("M0 0L23.5 0L23.5 -100L0 -100Z");
  });
});
