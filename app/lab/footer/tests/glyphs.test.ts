import { describe, expect, it } from "vitest";
import { ALPHABET, GLYPHS, METRICS, glyphPaths, renderGlyph, sampleStroke } from "../glyphs";
import { boxWidth, layoutWord, sizeForWidth } from "../layout";

const WEIGHTS = [0.04, 0.1, 0.17, 0.26];
const EPS = 1e-9;

describe("the alphabet", () => {
  it("covers a to z, the period, the hyphen and space", () => {
    const expected = [..."abcdefghijklmnopqrstuvwxyz", ".", "-", " "];
    expect([...ALPHABET].sort()).toEqual([...expected].sort());
  });

  it("starts every skeleton at x = 0 and keeps it between the descender and the ascender", () => {
    for (const char of ALPHABET) {
      const g = GLYPHS[char];
      const points = [...g.strokes.flatMap((s) => sampleStroke(s, 64)), ...g.dots];
      if (points.length === 0) continue;
      const xs = points.map(([x]) => x);
      expect(Math.min(...xs), char).toBeCloseTo(0, 9);
      expect(Math.max(...xs), char).toBeCloseTo(g.width, 9);
      for (const [, y] of points) {
        expect(y, char).toBeGreaterThanOrEqual(METRICS.descender - EPS);
        expect(y, char).toBeLessThanOrEqual(METRICS.ascender + EPS);
      }
    }
  });

  it("keeps every glyph's stroked ink inside its box at every weight", () => {
    for (const w of WEIGHTS) {
      for (const char of ALPHABET) {
        const g = GLYPHS[char];
        const { placements } = layoutWord(char, 1, [w], 0);
        const p = placements[0];
        const box = { left: p.boxX, right: p.boxX + boxWidth(char, w), bottom: METRICS.descender - w / 2, top: METRICS.ascender + w / 2 };
        const points = [...g.strokes.flatMap((s) => sampleStroke(s, 64)), ...g.dots];
        for (const [x, y] of points) {
          const ix = p.inkX + x;
          expect(ix - w / 2, `${char} at ${w}`).toBeGreaterThanOrEqual(box.left - EPS);
          expect(ix + w / 2, `${char} at ${w}`).toBeLessThanOrEqual(box.right + EPS);
          expect(y - w / 2, `${char} at ${w}`).toBeGreaterThanOrEqual(box.bottom - EPS);
          expect(y + w / 2, `${char} at ${w}`).toBeLessThanOrEqual(box.top + EPS);
        }
      }
    }
  });

  it("changes only the stroke width with the weight", () => {
    for (const char of ALPHABET) {
      const thin = renderGlyph(char, 100, WEIGHTS[0]);
      for (const w of WEIGHTS.slice(1)) {
        const r = renderGlyph(char, 100, w);
        expect(r.d, char).toBe(thin.d);
        expect(r.dots, char).toBe(thin.dots);
        expect(r.strokeWidth, char).toBeCloseTo(w * 100, 9);
      }
    }
  });

  it("writes finite path data, every arc with sweep 0 and no large-arc flag", () => {
    for (const char of ALPHABET) {
      const { d, dots } = glyphPaths(char, 240);
      expect(d + dots, char).not.toMatch(/NaN|Infinity/);
      for (const m of d.matchAll(/A([-\d.]+) ([-\d.]+) 0 (\d) (\d)/g)) {
        expect(m[3], char).toBe("0");
        expect(m[4], char).toBe("0");
      }
    }
  });

  it("draws the i and the period with dots, and the space with nothing", () => {
    expect(glyphPaths("i", 10).dots).not.toBe("");
    expect(glyphPaths(".", 10).d).toBe("");
    expect(glyphPaths(" ", 10)).toEqual({ d: "", dots: "" });
  });
});

describe("the layout", () => {
  it("moves each skeleton by half the weight change and keeps its shape", () => {
    const a = layoutWord("build.stuff", 100, [0.1], 0.05);
    const b = layoutWord("build.stuff", 100, [0.2], 0.05);
    a.placements.forEach((p, i) => {
      const q = b.placements[i];
      expect(q.inkX - q.boxX - (p.inkX - p.boxX)).toBeCloseTo(5, 9);
    });
    expect(b.width - a.width).toBeCloseTo(11 * 10, 6);
  });

  it("finds the size that spans a share of the stage", () => {
    const size = sizeForWidth("build.stuff", 0.17, 0.06, 1200, 0.9);
    expect(layoutWord("build.stuff", size, [0.17], 0.06).width).toBeCloseTo(1080, 6);
  });
});
