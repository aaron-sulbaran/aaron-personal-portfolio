import type { RGB } from "./maths";

// Colour strings for the canvas, one per slot, rebuilt only when the rounded
// colour changes: the skyline paints several hundred fills a frame through a
// morph, an orbit or a hover, and a string per fill was the frame's garbage.
// Each slot keeps the last rounded r, g, b (and alpha in thousandths for an
// rgba slot) beside its string. `built` counts the strings made, for the tests.
export type CssCache = { key: Int16Array; css: string[]; built: number };

const EMPTY = -32768;

export const newCssCache = (slots: number): CssCache => ({
  key: new Int16Array(slots * 4).fill(EMPTY),
  css: new Array<string>(slots).fill(""),
  built: 0,
});

const same = (c: CssCache, o: number, r: number, g: number, b: number, a: number) =>
  c.key[o] === r && c.key[o + 1] === g && c.key[o + 2] === b && c.key[o + 3] === a;

const store = (c: CssCache, o: number, r: number, g: number, b: number, a: number) => {
  c.key[o] = r;
  c.key[o + 1] = g;
  c.key[o + 2] = b;
  c.key[o + 3] = a;
  c.built++;
};

export const rgbCss = (c: CssCache, slot: number, r: number, g: number, b: number): string => {
  const R = Math.round(r);
  const G = Math.round(g);
  const B = Math.round(b);
  const o = slot * 4;
  if (!same(c, o, R, G, B, 0)) {
    store(c, o, R, G, B, 0);
    c.css[slot] = "rgb(" + R + "," + G + "," + B + ")";
  }
  return c.css[slot];
};

export const rgbaCss = (c: CssCache, slot: number, rgb: RGB, a: number): string => {
  const R = Math.round(rgb[0]);
  const G = Math.round(rgb[1]);
  const B = Math.round(rgb[2]);
  const A = Math.round(a * 1000);
  const o = slot * 4;
  if (!same(c, o, R, G, B, A)) {
    store(c, o, R, G, B, A);
    c.css[slot] = "rgba(" + R + "," + G + "," + B + "," + (A / 1000).toFixed(3) + ")";
  }
  return c.css[slot];
};
