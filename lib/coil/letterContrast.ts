// How each letter of the name stands off the field: the design review's
// measure (2026-09-30, /private/tmp/dr-name/letters.py), for the QA readout
// behind ?coildebug=name, the e2e suite and the PR's numbers. Pure; the scene
// hands it a frame's OKLab lightness and the mask's coverage on one pixel
// grid.
//
// Per letter: the mean L inside the letter (the mask eroded 2 CSS px) minus
// the mean L of the field around it (a ring 6 to 26 CSS px out from the name,
// in the letter's columns widened 30 px, below the greeting). Spread is the
// strongest letter's |dL| over the weakest's. Range is the 5th to 95th
// percentile of L inside the letters after a light blur (so it reads the
// surface, not the grain).

export type LetterContrastInput = {
  L: Float32Array; // OKLab L per pixel, row 0 at the top
  cover: Float32Array; // the mask's coverage 0..1 on the same grid
  width: number;
  height: number;
  split: number; // the first row of the name (above it, the greeting)
  glyphs: readonly { x0: number; x1: number }[]; // the name's letters, pixel columns
  scale: number; // pixels per CSS px
};

export type LetterContrast = {
  letters: number[]; // dL per letter, signed (negative: darker than the field)
  spread: number;
  meanDL: number;
  rangeP5P95: number;
  greetDL: number;
};

function srgbToLinear(byte: number) {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// OKLab lightness of an sRGB byte triple.
export function oklabL(r: number, g: number, b: number) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

// The 4-connected (city block) distance from every pixel to the nearest set
// one: what repeated binary dilation with a cross measures. Two passes.
export function cityBlockDistance(mask: Uint8Array, width: number, height: number) {
  const far = width + height;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : far;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) d[i] = Math.min(d[i], d[i - width] + 1);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < height - 1) d[i] = Math.min(d[i], d[i + width] + 1);
    }
  }
  return d;
}

function boxBlur(src: Float32Array, width: number, height: number) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = src[x > 0 ? i - 1 : i];
      const b = src[x < width - 1 ? i + 1 : i];
      tmp[i] = (a + src[i] + b) / 3;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = tmp[y > 0 ? i - width : i];
      const b = tmp[y < height - 1 ? i + width : i];
      out[i] = (a + tmp[i] + b) / 3;
    }
  }
  return out;
}

function percentile(sorted: Float32Array, p: number) {
  if (sorted.length === 0) return Number.NaN;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))];
}

export function letterContrast(input: LetterContrastInput): LetterContrast {
  const { L, cover, width, height, split, glyphs, scale } = input;
  const n = width * height;
  const all = new Uint8Array(n);
  const name = new Uint8Array(n);
  const greet = new Uint8Array(n);
  const outside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const on = cover[i] > 0.98;
    all[i] = cover[i] > 0.02 ? 1 : 0;
    const row = Math.floor(i / width);
    name[i] = on && row >= split ? 1 : 0;
    greet[i] = on && row < split ? 1 : 0;
  }
  // Erosion by 2 CSS px: the distance to the nearest pixel outside the region.
  for (let i = 0; i < n; i++) outside[i] = name[i] ? 0 : 1;
  const inName = cityBlockDistance(outside, width, height);
  for (let i = 0; i < n; i++) outside[i] = greet[i] ? 0 : 1;
  const inGreet = cityBlockDistance(outside, width, height);
  const fromName = cityBlockDistance(name, width, height);
  const fromGreet = cityBlockDistance(greet, width, height);
  const fromAll = cityBlockDistance(all, width, height);
  const erode = 2 * scale;
  const near = 6 * scale;
  const far = 26 * scale;
  const below = split + 10 * scale;
  const widen = 30 * scale;

  const letters = glyphs.map(({ x0, x1 }) => {
    let inSum = 0;
    let inCount = 0;
    let ringSum = 0;
    let ringCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = Math.max(0, Math.floor(x0 - widen)); x < Math.min(width, Math.ceil(x1 + widen)); x++) {
        const i = y * width + x;
        if (x >= x0 && x < x1 && name[i] && inName[i] > erode) {
          inSum += L[i];
          inCount++;
        } else if (y > below && fromName[i] <= far && fromAll[i] > near) {
          ringSum += L[i];
          ringCount++;
        }
      }
    }
    return inCount && ringCount ? inSum / inCount - ringSum / ringCount : Number.NaN;
  });

  let inSum = 0;
  let inCount = 0;
  let ringSum = 0;
  let ringCount = 0;
  let gIn = 0;
  let gInCount = 0;
  let gRing = 0;
  let gRingCount = 0;
  const smooth = boxBlur(boxBlur(L, width, height), width, height);
  const inside: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = Math.floor(i / width);
    if (name[i] && inName[i] > erode) {
      inSum += L[i];
      inCount++;
      inside.push(smooth[i]);
    } else if (y > below && fromName[i] <= far && fromAll[i] > near) {
      ringSum += L[i];
      ringCount++;
    }
    if (greet[i] && inGreet[i] > erode) {
      gIn += L[i];
      gInCount++;
    } else if (fromGreet[i] <= far && fromAll[i] > near) {
      gRing += L[i];
      gRingCount++;
    }
  }
  const sorted = Float32Array.from(inside).sort();
  const magnitudes = letters.map(Math.abs).filter(Number.isFinite);
  return {
    letters,
    spread: magnitudes.length ? Math.max(...magnitudes) / Math.min(...magnitudes) : Number.NaN,
    meanDL: inCount && ringCount ? inSum / inCount - ringSum / ringCount : Number.NaN,
    rangeP5P95: percentile(sorted, 0.95) - percentile(sorted, 0.05),
    greetDL: gInCount && gRingCount ? gIn / gInCount - gRing / gRingCount : Number.NaN,
  };
}
