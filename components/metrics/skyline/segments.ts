import { FACE_X, FACE_Y, switchAt } from "@/lib/metrics/skyline/maths";
import { frontChain, frontEdgeX, OUTLINE_LEN, prismSilhouette } from "@/lib/metrics/skyline/prism";
import { rgbCss } from "@/lib/metrics/skyline/cssCache";
import type { Scene } from "./draw";
import { polyPath, SLOT_FACE_X, SLOT_FACE_Y, SLOT_TOP, SLOT_UPPER } from "./paint";

// A bar in two segments: the lower tool from the base, the upper tool on top,
// and the switch between two series. draw() calls these inside its cell loop;
// nothing here allocates.

// Scene point to canvas pixels under the frame's camera and transform.
export const px = (s: Scene, x: number, y: number) => s.ox + (x * s.cam.cs - y * s.cam.sn) * s.sc;
export const py = (s: Scene, x: number, y: number, z: number) =>
  s.oy + ((x * s.cam.sn + y * s.cam.cs) * s.cam.se - z * s.cam.ce) * s.sc;

// Every bar's shown height, lower share and two colours: the last series'
// (captured when the switch began) mixed into the current one's, bar by bar
// on the staggered switch clock. The current colours come from the eased
// palettes by level: the lower tool's ramp in col, the upper's in col2.
export const blend = (s: Scene) => {
  const { n, col, col2, cFrom, low, up, hFrom, hTo, hgt, shFrom, shTo, shr, lv, wk, dy } = s;
  const done = s.sw >= 1;
  for (let i = 0; i < n; i++) {
    const p = done ? 1 : switchAt(s.sw, wk[i], s.weeks, dy[i], s.swStagger, s.swReverse);
    const q = 1 - p;
    hgt[i] = hFrom[i] * q + hTo[i] * p;
    shr[i] = shFrom[i] * q + shTo[i] * p;
    const L = lv[i] * 3;
    const U = lv[i] >= 1 && lv[i] <= 4 ? (lv[i] - 1) * 3 : -1;
    const o = i * 6;
    const o3 = i * 3;
    for (let ch = 0; ch < 3; ch++) {
      low[o3 + ch] = cFrom[o + ch] * q + col[L + ch] * p;
      up[o3 + ch] = cFrom[o + 3 + ch] * q + (U >= 0 ? col2[U + ch] : col[L + ch]) * p;
    }
  }
};

// A bar's two colours after the legend's dim and the hover's lift, into s.tone
// (lower r, g, b, then upper r, g, b).
export const tone = (s: Scene, i: number) => {
  const { tone: t, col, fg } = s;
  const d = s.dim[i];
  const hv = s.hover[i];
  for (let k = 0; k < 2; k++) {
    const src = k ? s.up : s.low;
    let r = src[i * 3];
    let g = src[i * 3 + 1];
    let b = src[i * 3 + 2];
    if (d > 0.002) {
      r += (col[0] - r) * 0.72 * d;
      g += (col[1] - g) * 0.72 * d;
      b += (col[2] - b) * 0.72 * d;
    }
    if (hv > 0.002) {
      const m = 0.16 * hv;
      r += (fg[0] - r) * m;
      g += (fg[1] - g) * m;
      b += (fg[2] - b) * m;
    }
    t[k * 3] = r;
    t[k * 3 + 1] = g;
    t[k * 3 + 2] = b;
  }
};

// One segment's two visible faces inside its own silhouette.
const faces = (s: Scene, slot: number, n: number, front: number, r: number, g: number, b: number) => {
  const { ctx } = s;
  ctx.save();
  ctx.beginPath();
  polyPath(ctx, s.sil, n);
  ctx.clip();
  ctx.fillStyle = rgbCss(s.cellCss, slot + SLOT_FACE_Y, r * FACE_Y, g * FACE_Y, b * FACE_Y);
  ctx.fillRect(0, 0, front, s.Hmax);
  ctx.fillStyle = rgbCss(s.cellCss, slot + SLOT_FACE_X, r * FACE_X, g * FACE_X, b * FACE_X);
  ctx.fillRect(front, 0, s.W - front, s.Hmax);
  ctx.restore();
};

// The bar's side faces, `rise` screen pixels tall, the lower segment the
// bottom `share` of it. The upper segment is painted over the lower one's top,
// so only the lower's front edges show where they meet. A one-tool bar is one
// segment, as before.
export const segmentSides = (s: Scene, slot: number, rise: number, share: number) => {
  const t = s.tone;
  const front = frontEdgeX(s.outline, OUTLINE_LEN);
  const lower = share >= 0.9995 ? rise : rise * share;
  if (lower > 0.05) faces(s, slot, prismSilhouette(s.sil, s.outline, OUTLINE_LEN, lower), front, t[0], t[1], t[2]);
  if (rise - lower > 0.05) faces(s, slot + SLOT_UPPER, prismSilhouette(s.sil, s.outline, OUTLINE_LEN, rise - lower, lower), front, t[3], t[4], t[5]);
  if (s.gap > 0 && lower > 0.05 && rise - lower > 0.05) {
    const { ctx } = s;
    const m = frontChain(s.sil, s.outline, OUTLINE_LEN, lower);
    ctx.beginPath();
    ctx.moveTo(s.sil[0], s.sil[1]);
    for (let k = 1; k < m; k++) ctx.lineTo(s.sil[k * 2], s.sil[k * 2 + 1]);
    seam(s);
  }
};

// The current path stroked in the page colour, s.gap pixels wide.
const seam = (s: Scene) => {
  const { ctx } = s;
  ctx.strokeStyle = s.bgCss;
  ctx.lineWidth = s.gap;
  ctx.lineCap = "butt";
  ctx.stroke();
};

// The seam across the top face (and the flat cell) where the upper tool's
// rows meet the lower's, kept inside the cell's own outline.
export const topSeam = (s: Scene, x0: number, w: number, split: number, rise: number) => {
  if (s.gap <= 0) return;
  const { ctx } = s;
  const xa = x0 - 0.5;
  const xb = x0 + w + 0.5;
  ctx.save();
  ctx.beginPath();
  polyPath(ctx, s.outline, OUTLINE_LEN, 0, -rise);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(px(s, xa, split), py(s, xa, split, 0) - rise);
  ctx.lineTo(px(s, xb, split), py(s, xb, split, 0) - rise);
  seam(s);
  ctx.restore();
};

// Clips to the upper tool's part of the cell's top face: its rows above
// `split` (grid units), raised `rise` pixels. The quad overhangs the cell on
// three sides, so the cell's own outline is what bounds it there.
export const clipUpper = (s: Scene, x0: number, y0: number, w: number, split: number, rise: number) => {
  const { ctx } = s;
  const xa = x0 - 0.5;
  const xb = x0 + w + 0.5;
  const ya = y0 - 0.5;
  ctx.beginPath();
  ctx.moveTo(px(s, xa, ya), py(s, xa, ya, 0) - rise);
  ctx.lineTo(px(s, xb, ya), py(s, xb, ya, 0) - rise);
  ctx.lineTo(px(s, xb, split), py(s, xb, split, 0) - rise);
  ctx.lineTo(px(s, xa, split), py(s, xa, split, 0) - rise);
  ctx.closePath();
  ctx.clip();
};

// The top face with no flat depth: the lower tool's colour, then the upper's
// over its rows.
export const splitTop = (s: Scene, slot: number, x0: number, y0: number, w: number, split: number | null, rise: number) => {
  const { ctx, tone: t } = s;
  ctx.beginPath();
  polyPath(ctx, s.outline, OUTLINE_LEN, 0, -rise);
  ctx.fillStyle = rgbCss(s.cellCss, slot + SLOT_TOP, t[0], t[1], t[2]);
  ctx.fill();
  if (split === null) return;
  ctx.save();
  clipUpper(s, x0, y0, w, split, rise);
  ctx.beginPath();
  polyPath(ctx, s.outline, OUTLINE_LEN, 0, -rise);
  ctx.fillStyle = rgbCss(s.cellCss, slot + SLOT_UPPER + SLOT_TOP, t[3], t[4], t[5]);
  ctx.fill();
  ctx.restore();
};
