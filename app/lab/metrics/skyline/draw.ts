import { camera, easeInOutCubic, lerp, project, riseAt, smoothstep, type Cam, type RGB } from "./maths";
import { quadPath, rgbString, rgbaString } from "./paint";

// The scene's mutable state and the one function that paints it. The engine
// owns the state and calls draw() from its loop; nothing here schedules.

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
  order: number[];
  months: { week: number; label: string }[];
  weekdayRows: { day: number; label: string }[];
  activeIdx: number;
  tipW: number;
};

// Projected extent of the scene for camera e, with each bar at its full
// height times e (`full`) or at its current rise.
export const extent = (s: Scene, cam: Cam, e: number, full: boolean) => {
  const w = lerp(0.78, 0.9, e);
  const off = (1 - w) / 2;
  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  const add = (x: number, y: number, z: number) => {
    const p = project(cam, x, y, z);
    if (p[0] < minx) minx = p[0];
    if (p[0] > maxx) maxx = p[0];
    if (p[1] < miny) miny = p[1];
    if (p[1] > maxy) maxy = p[1];
  };
  for (let i = 0; i < s.n; i++) {
    const x0 = s.wk[i] + off;
    const y0 = s.dy[i] + off;
    const z = full ? s.hgt[i] * e : s.zs[i];
    add(x0, y0, z);
    add(x0 + w, y0, z);
    add(x0, y0 + w, z);
    add(x0 + w, y0 + w, 0);
    add(x0, y0 + w, 0);
    add(x0 + w, y0, 0);
  }
  // room for the month labels that run along the front edge in 3D
  add(0, 7 + 1.5 * e, 0);
  add(s.weeks, 7 + 1.5 * e, 0);
  return { minx, maxx, miny, maxy };
};

export const draw = (s: Scene) => {
  const { ctx, W, n } = s;
  if (!W || !n) return;
  const e = easeInOutCubic(s.t);
  const cam = camera(e, s.yaw, s.elev);
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
  const ox = left + (aw - bw * sc) / 2 - b.minx * sc;
  const oy = top + (ah - bh * sc) / 2 - b.miny * sc;
  const { cs, sn, se, ce } = cam;
  const px = (x: number, y: number) => ox + (x * cs - y * sn) * sc;
  const py = (x: number, y: number, z: number) => oy + ((x * sn + y * cs) * se - z * ce) * sc;

  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, W, s.Hmax);

  const { wk, dy, lv, zs, hover, dim, polys, faces, col, fg } = s;
  s.order.sort((a, c) => (wk[a] + 0.5) * sn + (dy[a] + 0.5) * cs - ((wk[c] + 0.5) * sn + (dy[c] + 0.5) * cs));

  const w = lerp(0.78, 0.9, e);
  const off = (1 - w) / 2;
  const radius = lerp(0.17, 0.03, e) * sc;
  const outline = (1 - e) * 0.07;
  const lift = 0.7 * e;

  for (let k = 0; k < n; k++) {
    const i = s.order[k];
    if (s.skip[i]) continue;
    const x0 = wk[i] + off;
    const y0 = dy[i] + off;
    const x1 = x0 + w;
    const y1 = y0 + w;
    const z = zs[i] + hover[i] * lift;
    const o = i * 24;
    // top
    polys[o] = px(x0, y0);
    polys[o + 1] = py(x0, y0, z);
    polys[o + 2] = px(x1, y0);
    polys[o + 3] = py(x1, y0, z);
    polys[o + 4] = px(x1, y1);
    polys[o + 5] = py(x1, y1, z);
    polys[o + 6] = px(x0, y1);
    polys[o + 7] = py(x0, y1, z);
    // +y face (left on screen)
    polys[o + 8] = px(x0, y1);
    polys[o + 9] = py(x0, y1, 0);
    polys[o + 10] = px(x1, y1);
    polys[o + 11] = py(x1, y1, 0);
    polys[o + 12] = polys[o + 4];
    polys[o + 13] = polys[o + 5];
    polys[o + 14] = polys[o + 6];
    polys[o + 15] = polys[o + 7];
    // +x face (right on screen)
    polys[o + 16] = px(x1, y0);
    polys[o + 17] = py(x1, y0, 0);
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
    if (f & 1) {
      ctx.beginPath();
      quadPath(ctx, polys, o + 8, 0);
      ctx.fillStyle = rgbString(r * 0.84, g * 0.84, bl * 0.84);
      ctx.fill();
    }
    if (f & 2) {
      ctx.beginPath();
      quadPath(ctx, polys, o + 16, 0);
      ctx.fillStyle = rgbString(r * 0.68, g * 0.68, bl * 0.68);
      ctx.fill();
    }
    ctx.beginPath();
    quadPath(ctx, polys, o, radius);
    ctx.fillStyle = rgbString(r, g, bl);
    ctx.fill();
    if (outline > 0.004) {
      ctx.strokeStyle = rgbaString(fg, outline);
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
    ctx.fillStyle = rgbaString(s.muted, a2);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    let edge = -Infinity;
    // A fixed gap above the first row, not a share of a cell: a short range has
    // big cells, and a cell-relative offset pushed the labels off the canvas.
    for (const m of s.months) {
      const x = px(m.week + off, off);
      const tw = ctx.measureText(m.label).width;
      if (x < edge || x + tw > W) continue;
      ctx.fillText(m.label, x, py(m.week + off, off, 0) - 6);
      edge = x + tw + 6;
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (s.gutter > 0) for (const r of s.weekdayRows) ctx.fillText(r.label, px(0, r.day + 0.5) - 6, py(0, r.day + 0.5, 0));
  }
  if (a3 > 0.004) {
    ctx.fillStyle = rgbaString(s.muted, a3);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let edge = -Infinity;
    for (const m of s.months) {
      const x = px(m.week + 0.5, 7.3);
      const tw = ctx.measureText(m.label).width;
      if (x < edge || x + tw > W) continue;
      ctx.fillText(m.label, x, py(m.week + 0.5, 7.3, 0) + 2);
      edge = x + tw + 10;
    }
  }

  // The tooltip rides the active cell through morphs and orbits.
  if (s.activeIdx >= 0 && s.activeIdx < n) {
    const i = s.activeIdx;
    const z = zs[i] + hover[i] * lift;
    const tx = px(wk[i] + 0.5, dy[i] + 0.5);
    const ty = Math.min(
      py(wk[i] + off, dy[i] + off, z),
      py(wk[i] + off + w, dy[i] + off, z),
      py(wk[i] + off, dy[i] + off + w, z),
    );
    const half = s.tipW / 2;
    const cx = Math.min(W - half - 2, Math.max(half + 2, tx));
    s.tip.style.transform = "translate(" + (cx - half).toFixed(1) + "px," + (ty - 8).toFixed(1) + "px) translateY(-100%)";
    s.tip.style.setProperty("--arrow", (tx - cx + half).toFixed(1) + "px");
  }
};
