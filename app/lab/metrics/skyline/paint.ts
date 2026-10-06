import type { RGB } from "./maths";

// Canvas helpers: colour resolution and the two quad routines.

// The canvas fill parser never resolves var(), so a token string is first
// handed to a probe element inside the chart (custom properties resolve
// there), and the computed colour, plain rgb() or color(srgb ...) from a
// color-mix, is read back. A 1px canvas paints anything the regexes miss.
let pixel: CanvasRenderingContext2D | null = null;

const paintedRGB = (css: string): RGB | null => {
  if (!pixel) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    pixel = c.getContext("2d", { willReadFrequently: true });
  }
  if (!pixel) return null;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = "rgba(0,0,0,0)";
  pixel.fillStyle = css;
  pixel.fillRect(0, 0, 1, 1);
  const d = pixel.getImageData(0, 0, 1, 1).data;
  return d[3] < 8 ? null : [d[0], d[1], d[2]];
};

export const parseComputed = (computed: string): RGB | null => {
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(computed);
  if (rgb) {
    if (rgb[4] !== undefined && parseFloat(rgb[4]) < 0.03) return null;
    return [+rgb[1], +rgb[2], +rgb[3]];
  }
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(computed);
  if (srgb) {
    if (srgb[4] !== undefined && parseFloat(srgb[4]) < 0.03) return null;
    return [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255];
  }
  return paintedRGB(computed);
};

export const resolveColor = (probe: HTMLElement, css: string, fallback: RGB): RGB => {
  probe.style.color = "";
  probe.style.color = css;
  return parseComputed(getComputedStyle(probe).color) ?? fallback;
};

export const rgbString = (r: number, g: number, b: number) =>
  "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";

export const rgbaString = (c: RGB, a: number) =>
  "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a.toFixed(3) + ")";

export const pointInQuad = (p: Float32Array, o: number, x: number, y: number): boolean => {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const ax = p[o + k * 2];
    const ay = p[o + k * 2 + 1];
    const bx = p[o + ((k + 1) % 4) * 2];
    const by = p[o + ((k + 1) % 4) * 2 + 1];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
};

export const quadPath = (ctx: CanvasRenderingContext2D, p: Float32Array, o: number, r: number) => {
  if (r < 0.3) {
    ctx.moveTo(p[o], p[o + 1]);
    ctx.lineTo(p[o + 2], p[o + 3]);
    ctx.lineTo(p[o + 4], p[o + 5]);
    ctx.lineTo(p[o + 6], p[o + 7]);
    ctx.closePath();
    return;
  }
  ctx.moveTo((p[o + 6] + p[o]) / 2, (p[o + 7] + p[o + 1]) / 2);
  for (let k = 0; k < 4; k++) {
    const b = (k + 1) % 4;
    ctx.arcTo(p[o + k * 2], p[o + k * 2 + 1], p[o + b * 2], p[o + b * 2 + 1], r);
  }
  ctx.closePath();
};
