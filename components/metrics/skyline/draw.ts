import {
  cameraInto,
  easeInOutCubic,
  FACE_X,
  FACE_Y,
  lerp,
  riseAt,
  smoothstep,
  type Cam,
  type DepthSpec,
  type RGB,
} from "@/lib/metrics/skyline/maths";
import { SKYLINE } from "@/lib/metrics/settings";
import { frontEdgeX, OUTLINE_LEN, prismSilhouette, roundedCell } from "@/lib/metrics/skyline/prism";
import { alphaCss, polyPath, rgbString, rgbaString, type AlphaCss } from "./paint";
import { flatCell } from "./flat";

// The scene's mutable state and the one function that paints it. The engine
// owns the state and calls draw() from its loop; nothing here schedules.

export type { DepthSpec };

// The flat view's depth when none is asked for (the depth modes and the face
// shades live with the maths).
export const NO_DEPTH: DepthSpec = { mode: "none", lift: 0, edge: 0.07, hi: 0, paper: 0 };

export type Scene = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  stage: HTMLDivElement;
  tip: HTMLDivElement;
  // morph: t is linear time 0 (2D) to 1 (3D); the camera eases it, the bars wave it
  t: number;
  yaw: number;
  elev: number;
  W: number;
  H2: number;
  H3: number;
  Hmax: number;
  lastH: number;
  dpr: number;
  gutter: number;
  labelW: number;
  font: string;
  // [empty, l1, l2, l3, l4, future] x rgb, eased toward the goal
  col: Float32Array;
  fg: RGB;
  bg: RGB;
  muted: RGB;
  n: number;
  weeks: number;
  wk: Float32Array;
  dy: Float32Array;
  lv: Uint8Array; // 0 to 4 the level, 5 a future day
  skip: Uint8Array; // 1 for an "outside" pad day: kept in the geometry, never drawn or hit
  hgt: Float32Array;
  zs: Float32Array;
  hover: Float32Array;
  dim: Float32Array;
  polys: Float32Array;
  faces: Uint8Array;
  // The bar's rounded outline at height zero and its prism silhouette, rewritten per bar.
  outline: Float32Array;
  sil: Float32Array;
  // Paint order, back to front, and its keys; re-sorted only when the camera turns.
  order: number[];
  sortKey: Float64Array;
  sortCs: number;
  sortSn: number;
  months: { week: number; label: string }[];
  weekdayRows: { day: number; label: string }[];
  activeIdx: number;
  tipW: number;
  depth: DepthSpec;
  hi: RGB; // the Coil's inner highlight colour and alpha (--card-hi)
  hiA: number;
  shade: RGB; // lift's cast shadow: the page's ink over paper, or deeper than the page in dark
  // Reused every frame so the paint allocates nothing: the camera, the screen
  // transform (px, py), the bounds, the month label widths in s.font (measured
  // on retheme), the steady colour strings and the tooltip's last placement.
  cam: Cam;
  ox: number;
  oy: number;
  sc: number;
  ext: Bounds;
  monthW: Float64Array;
  shadeCss: string;
  outlineCss: AlphaCss;
  label2Css: AlphaCss;
  label3Css: AlphaCss;
  hiCss: AlphaCss;
  tipAt: Float64Array;
};

export type Bounds = { minx: number; maxx: number; miny: number; maxy: number };

// Scene point to canvas pixels under the frame's camera and transform.
const px = (s: Scene, x: number, y: number) => s.ox + (x * s.cam.cs - y * s.cam.sn) * s.sc;
const py = (s: Scene, x: number, y: number, z: number) =>
  s.oy + ((x * s.cam.sn + y * s.cam.cs) * s.cam.se - z * s.cam.ce) * s.sc;

// One point, projected as maths' project() does (inlined: no tuple), into the bounds.
const grow = (b: Bounds, c: Cam, x: number, y: number, z: number) => {
  const sx = x * c.cs - y * c.sn;
  const sy = (x * c.sn + y * c.cs) * c.se - z * c.ce;
  if (sx < b.minx) b.minx = sx;
  if (sx > b.maxx) b.maxx = sx;
  if (sy < b.miny) b.miny = sy;
  if (sy > b.maxy) b.maxy = sy;
};

// Projected extent of the scene for camera e, with each bar at its full
// height times e (`full`) or at its current rise. Written into s.ext, which
// the next call overwrites.
export const extent = (s: Scene, cam: Cam, e: number, full: boolean): Bounds => {
  const w = lerp(0.78, 0.9, e);
  const off = (1 - w) / 2;
  const b = s.ext;
  b.minx = Infinity;
  b.maxx = -Infinity;
  b.miny = Infinity;
  b.maxy = -Infinity;
  for (let i = 0; i < s.n; i++) {
    const x0 = s.wk[i] + off;
    const y0 = s.dy[i] + off;
    const z = full ? s.hgt[i] * e : s.zs[i];
    grow(b, cam, x0, y0, z);
    grow(b, cam, x0 + w, y0, z);
    grow(b, cam, x0, y0 + w, z);
    grow(b, cam, x0 + w, y0 + w, 0);
    grow(b, cam, x0, y0 + w, 0);
    grow(b, cam, x0 + w, y0, 0);
  }
  // room for the month labels that run along the front edge in 3D
  grow(b, cam, 0, 7 + 1.5 * e, 0);
  grow(b, cam, s.weeks, 7 + 1.5 * e, 0);
  return b;
};

// Back to front along the view. A stable insertion sort over the last order,
// which is nearly sorted frame to frame; Array.prototype.sort would allocate.
// Same keys and same stability as the comparator sort, so the same order.
const sortOrder = (s: Scene) => {
  const { order, sortKey, wk, dy, n } = s;
  const { cs, sn } = s.cam;
  for (let i = 0; i < n; i++) sortKey[i] = (wk[i] + 0.5) * sn + (dy[i] + 0.5) * cs;
  for (let k = 1; k < n; k++) {
    const v = order[k];
    const kv = sortKey[v];
    let j = k - 1;
    while (j >= 0 && sortKey[order[j]] > kv) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = v;
  }
  s.sortCs = cs;
  s.sortSn = sn;
};

export const draw = (s: Scene) => {
  const { ctx, W, n } = s;
  if (!W || !n) return;
  const e = easeInOutCubic(s.t);
  const cam = cameraInto(s.cam, e, s.yaw, s.elev);
  const Hc = lerp(s.H2, s.H3, e);
  if (Math.abs(Hc - s.lastH) > 0.2) {
    s.stage.style.height = Hc.toFixed(1) + "px";
    s.lastH = Hc;
  }
  for (let i = 0; i < n; i++) s.zs[i] = riseAt(s.t, s.wk[i], s.weeks, s.dy[i]) * s.hgt[i];
  const b = extent(s, cam, e, false);
  const pad = lerp(2, 20, e);
  const left = pad + s.gutter * (1 - e);
  const top = pad + 20 * (1 - e);
  const aw = W - left - pad;
  const ah = Hc - top - pad;
  const bw = Math.max(1e-6, b.maxx - b.minx);
  const bh = Math.max(1e-6, b.maxy - b.miny);
  const sc = Math.min(aw / bw, ah / bh);
  s.ox = left + (aw - bw * sc) / 2 - b.minx * sc;
  s.oy = top + (ah - bh * sc) / 2 - b.miny * sc;
  s.sc = sc;
  const { cs, sn, ce } = cam;

  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, W, s.Hmax);

  const { wk, dy, lv, zs, hover, dim, polys, faces, col, fg } = s;
  if (cs !== s.sortCs || sn !== s.sortSn) sortOrder(s);

  const w = lerp(0.78, 0.9, e);
  const off = (1 - w) / 2;
  const depth = s.depth;
  const outline = (1 - e) * (depth.mode === "none" ? 0.07 : depth.edge);
  const hoverLift = 0.7 * e;
  // The flat depth gives way as the real faces arrive; by e = 0.3 they carry it.
  const fd = depth.mode === "none" ? 0 : 1 - smoothstep(0, 0.3, e);
  const outlineCss = outline > 0.004 ? alphaCss(s.outlineCss, fg, outline) : "";

  for (let k = 0; k < n; k++) {
    const i = s.order[k];
    if (s.skip[i]) continue;
    const x0 = wk[i] + off;
    const y0 = dy[i] + off;
    const x1 = x0 + w;
    const y1 = y0 + w;
    const z = zs[i] + hover[i] * hoverLift;
    const o = i * 24;
    // top
    polys[o] = px(s, x0, y0);
    polys[o + 1] = py(s, x0, y0, z);
    polys[o + 2] = px(s, x1, y0);
    polys[o + 3] = py(s, x1, y0, z);
    polys[o + 4] = px(s, x1, y1);
    polys[o + 5] = py(s, x1, y1, z);
    polys[o + 6] = px(s, x0, y1);
    polys[o + 7] = py(s, x0, y1, z);
    // +y face (left on screen)
    polys[o + 8] = px(s, x0, y1);
    polys[o + 9] = py(s, x0, y1, 0);
    polys[o + 10] = px(s, x1, y1);
    polys[o + 11] = py(s, x1, y1, 0);
    polys[o + 12] = polys[o + 4];
    polys[o + 13] = polys[o + 5];
    polys[o + 14] = polys[o + 6];
    polys[o + 15] = polys[o + 7];
    // +x face (right on screen)
    polys[o + 16] = px(s, x1, y0);
    polys[o + 17] = py(s, x1, y0, 0);
    polys[o + 18] = polys[o + 10];
    polys[o + 19] = polys[o + 11];
    polys[o + 20] = polys[o + 4];
    polys[o + 21] = polys[o + 5];
    polys[o + 22] = polys[o + 2];
    polys[o + 23] = polys[o + 3];

    const tall = z * ce * sc;
    let f = 0;
    if (tall > 0.35 && w * cs * sc > 0.35) f |= 1;
    if (tall > 0.35 && w * sn * sc > 0.35) f |= 2;
    faces[i] = f;

    const L = lv[i] * 3;
    let r = col[L];
    let g = col[L + 1];
    let bl = col[L + 2];
    const d = dim[i];
    if (d > 0.002) {
      r += (col[0] - r) * 0.72 * d;
      g += (col[1] - g) * 0.72 * d;
      bl += (col[2] - bl) * 0.72 * d;
    }
    const hv = hover[i];
    if (hv > 0.002) {
      const m = 0.16 * hv;
      r += (fg[0] - r) * m;
      g += (fg[1] - g) * m;
      bl += (fg[2] - bl) * m;
    }
    roundedCell(s.outline, cam, x0, y0, w, SKYLINE.prismRadius * w, 0, sc, s.ox, s.oy);
    const rise = z * ce * sc;
    if (f) {
      const m = prismSilhouette(s.sil, s.outline, OUTLINE_LEN, rise);
      const front = frontEdgeX(s.outline, OUTLINE_LEN);
      ctx.save();
      ctx.beginPath();
      polyPath(ctx, s.sil, m);
      ctx.clip();
      ctx.fillStyle = rgbString(r * FACE_Y, g * FACE_Y, bl * FACE_Y);
      ctx.fillRect(0, 0, front, s.Hmax);
      ctx.fillStyle = rgbString(r * FACE_X, g * FACE_X, bl * FACE_X);
      ctx.fillRect(front, 0, W - front, s.Hmax);
      ctx.restore();
    }
    if (fd > 0.004) flatCell(s, rise, r, g, bl, fd, lv[i] === 0 || lv[i] === 5);
    else {
      ctx.beginPath();
      polyPath(ctx, s.outline, OUTLINE_LEN, 0, -rise);
      ctx.fillStyle = rgbString(r, g, bl);
      ctx.fill();
    }
    if (outline > 0.004 || hv > 0.02) {
      ctx.beginPath();
      polyPath(ctx, s.outline, OUTLINE_LEN, 0, -rise);
    }
    if (outline > 0.004) {
      ctx.strokeStyle = outlineCss;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (hv > 0.02) {
      ctx.strokeStyle = rgbaString(fg, 0.85 * hv);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Labels: along the top and left in 2D, along the front edge in 3D. They fade, never pop.
  ctx.font = s.font;
  const a2 = 1 - smoothstep(0, 0.4, e);
  const a3 = smoothstep(0.62, 1, e);
  if (a2 > 0.004) {
    ctx.fillStyle = alphaCss(s.label2Css, s.muted, a2);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    let edge = -Infinity;
    // A fixed gap above the first row, not a share of a cell: a short range has
    // big cells, and a cell-relative offset pushed the labels off the canvas.
    for (let k = 0; k < s.months.length; k++) {
      const m = s.months[k];
      const x = px(s, m.week + off, off);
      const tw = s.monthW[k];
      if (x < edge || x + tw > W) continue;
      ctx.fillText(m.label, x, py(s, m.week + off, off, 0) - 6);
      edge = x + tw + 6;
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (s.gutter > 0) {
      for (let k = 0; k < s.weekdayRows.length; k++) {
        const r = s.weekdayRows[k];
        ctx.fillText(r.label, px(s, 0, r.day + 0.5) - 6, py(s, 0, r.day + 0.5, 0));
      }
    }
  }
  if (a3 > 0.004) {
    ctx.fillStyle = alphaCss(s.label3Css, s.muted, a3);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let edge = -Infinity;
    for (let k = 0; k < s.months.length; k++) {
      const m = s.months[k];
      const x = px(s, m.week + 0.5, 7.3);
      const tw = s.monthW[k];
      if (x < edge || x + tw > W) continue;
      ctx.fillText(m.label, x, py(s, m.week + 0.5, 7.3, 0) + 2);
      edge = x + tw + 10;
    }
  }

  // The tooltip rides the active cell through morphs and orbits.
  if (s.activeIdx >= 0 && s.activeIdx < n) {
    const i = s.activeIdx;
    const z = zs[i] + hover[i] * hoverLift;
    const tx = px(s, wk[i] + 0.5, dy[i] + 0.5);
    const ty = Math.min(
      py(s, wk[i] + off, dy[i] + off, z),
      py(s, wk[i] + off + w, dy[i] + off, z),
      py(s, wk[i] + off, dy[i] + off + w, z),
    );
    const half = s.tipW / 2;
    const cx = Math.min(W - half - 2, Math.max(half + 2, tx));
    const at = s.tipAt;
    if (cx - half !== at[0] || ty - 8 !== at[1]) {
      at[0] = cx - half;
      at[1] = ty - 8;
      s.tip.style.transform = "translate(" + (cx - half).toFixed(1) + "px," + (ty - 8).toFixed(1) + "px) translateY(-100%)";
    }
    if (tx - cx + half !== at[2]) {
      at[2] = tx - cx + half;
      s.tip.style.setProperty("--arrow", (tx - cx + half).toFixed(1) + "px");
    }
  }
};
