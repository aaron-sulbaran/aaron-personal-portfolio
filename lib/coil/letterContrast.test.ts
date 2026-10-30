import { describe, expect, it } from "vitest";
import { cityBlockDistance, contrastRatio, letterContrast, oklabL, relativeLuminance, titleContrast, type LetterContrastInput } from "@/lib/coil/letterContrast";

describe("oklabL", () => {
  it("is 0 for black, 1 for white, and rises with gray", () => {
    expect(oklabL(0, 0, 0)).toBeCloseTo(0, 6);
    expect(oklabL(255, 255, 255)).toBeCloseTo(1, 3);
    expect(oklabL(128, 128, 128)).toBeGreaterThan(oklabL(100, 100, 100));
    // L 0.5 is linear 0.125, sRGB 99
    expect(oklabL(99, 99, 99)).toBeCloseTo(0.5, 2);
  });
});

describe("cityBlockDistance", () => {
  it("counts 4-connected steps to the nearest set pixel, 0 on it", () => {
    const w = 7;
    const h = 5;
    const mask = new Uint8Array(w * h);
    mask[2 * w + 3] = 1;
    const d = cityBlockDistance(mask, w, h);
    expect(d[2 * w + 3]).toBe(0);
    expect(d[2 * w + 4]).toBe(1);
    expect(d[3 * w + 4]).toBe(2);
    expect(d[0]).toBe(5);
  });
});

// A synthetic lockup: a field of L 0.8, a greeting band on top, and five
// block "letters" in the name band, each with its own lightness.
function lockup(letterL: number[], fieldL = 0.8, greetL = 0.7): LetterContrastInput {
  const width = 400;
  const height = 160;
  const split = 40;
  const L = new Float32Array(width * height).fill(fieldL);
  const cover = new Float32Array(width * height);
  const glyphs: { x0: number; x1: number }[] = [];
  letterL.forEach((value, index) => {
    const x0 = 20 + index * 75;
    const x1 = x0 + 40;
    glyphs.push({ x0, x1 });
    for (let y = 70; y < 130; y++) {
      for (let x = x0; x < x1; x++) {
        L[y * width + x] = value;
        cover[y * width + x] = 1;
      }
    }
  });
  for (let y = 10; y < 26; y++) {
    for (let x = 20; x < 120; x++) {
      L[y * width + x] = greetL;
      cover[y * width + x] = 1;
    }
  }
  return { L, cover, width, height, split, glyphs, scale: 1 };
}

describe("letterContrast", () => {
  it("reads each letter against the field around it", () => {
    const out = letterContrast(lockup([0.6, 0.6, 0.6, 0.6, 0.6]));
    for (const dL of out.letters) expect(dL).toBeCloseTo(-0.2, 5);
    expect(out.spread).toBeCloseTo(1, 5);
    expect(out.meanDL).toBeCloseTo(-0.2, 5);
    expect(out.greetDL).toBeCloseTo(-0.1, 5);
  });

  it("spreads as the weakest letter fades: strongest over weakest", () => {
    const out = letterContrast(lockup([0.7, 0.6, 0.6, 0.6, 0.5]));
    expect(out.letters[0]).toBeCloseTo(-0.1, 5);
    expect(out.letters[4]).toBeCloseTo(-0.3, 5);
    expect(out.spread).toBeCloseTo(3, 5);
  });

  it("measures the tonal range inside the letters (5th to 95th percentile)", () => {
    const flat = letterContrast(lockup([0.6, 0.6, 0.6, 0.6, 0.6]));
    expect(flat.rangeP5P95).toBeCloseTo(0, 5);
    const varied = letterContrast(lockup([0.5, 0.55, 0.6, 0.65, 0.7]));
    expect(varied.rangeP5P95).toBeGreaterThan(0.15);
  });

  it("reads lighter letters as positive (dark theme)", () => {
    const out = letterContrast(lockup([0.4, 0.4, 0.4, 0.4, 0.4], 0.26, 0.4));
    expect(out.meanDL).toBeCloseTo(0.14, 5);
  });
});

describe("a page title's letters against what is behind them", () => {
  // Two 10 by 20 px glyphs on one line of a 120 by 80 grid, at 1 px a CSS px.
  const width = 120;
  const height = 80;
  const glyphs = [
    { x0: 40, x1: 50, y0: 30, y1: 50 },
    { x0: 60, x1: 70, y0: 30, y1: 50 },
  ];
  const grid = (inside: number, outside: number) => {
    const out = new Float32Array(width * height).fill(outside);
    for (const g of glyphs) for (let y = g.y0; y < g.y1; y++) for (let x = g.x0; x < g.x1; x++) out[y * width + x] = inside;
    return out;
  };
  const cover = grid(1, 0);

  it("reads each glyph's inside against the backdrop's ring, as a WCAG ratio", () => {
    const paper = relativeLuminance(250, 250, 247);
    const ink = relativeLuminance(10, 10, 10);
    const read = titleContrast({ letters: grid(ink, paper), behind: grid(paper, paper), cover, width, height, glyphs, scale: 1 });
    expect(read.glyphs).toHaveLength(2);
    for (const ratio of read.glyphs) expect(ratio).toBeCloseTo(contrastRatio(ink, paper), 5);
    expect(read.min).toBeCloseTo(contrastRatio(ink, paper), 5);
  });

  it("takes the backdrop from the frame with the title hidden: a dark field behind lowers it", () => {
    const fill = relativeLuminance(80, 110, 150);
    const field = relativeLuminance(190, 210, 230);
    const read = titleContrast({ letters: grid(fill, 0.9), behind: grid(field, field), cover, width, height, glyphs, scale: 1 });
    expect(read.min).toBeCloseTo(contrastRatio(fill, field), 5);
    expect(read.min).toBeLessThan(contrastRatio(fill, 0.9));
  });
});
