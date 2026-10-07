import { FACE_X, FACE_Y } from "@/lib/metrics/skyline/maths";
import type { Scene } from "./draw";
import { alphaCss, quadPath, rgbString } from "./paint";

// The flat view's depth (lift, bevel, inset), painted per cell while the real
// faces have not yet arrived. draw() calls flatCell inside its cell loop.

// One flat cell with depth, at strength fd (1 flat, 0 gone). An empty day
// stands half as high (its slab in 3D is half the lowest active bar), so its
// edge is half as wide and it carries no highlight.
export const flatCell = (s: Scene, o: number, radius: number, r: number, g: number, b: number, fd: number, empty: boolean) => {
  const { ctx, depth } = s;
  const L = depth.lift * fd * (empty ? 0.5 : 1);
  const hiA = empty ? 0 : (depth.hi / 100) * s.hiA * fd;
  const top = rgbString(r, g, b);
  if (depth.mode === "lift") {
    if (L > 0.05) {
      cellPath(s, o, radius, L, L);
      ctx.fillStyle = s.shadeCss;
      ctx.fill();
    }
    cellPath(s, o, radius, 0, 0);
    ctx.fillStyle = top;
    ctx.fill();
    if (hiA > 0.004) {
      ctx.save();
      ctx.clip();
      innerLine(s, o, radius, 0, 0, top, hiA, 1);
      ctx.restore();
    }
    return;
  }
  // bevel: the cell is the right face's shade, the bottom face's shade over
  // all but its right edge, the top over all but both edges. inset mirrors
  // it: the walls on the top and left, the floor shifted down-right.
  const dir = depth.mode === "bevel" ? -1 : 1;
  const lip = depth.mode === "bevel" ? 1 : -1;
  cellPath(s, o, radius, 0, 0);
  ctx.save();
  ctx.clip();
  if (L > 0.05) {
    ctx.fillStyle = rgbString(r * FACE_X, g * FACE_X, b * FACE_X);
    ctx.fill();
    cellPath(s, o, radius, dir * L, 0);
    ctx.fillStyle = rgbString(r * FACE_Y, g * FACE_Y, b * FACE_Y);
    ctx.fill();
    cellPath(s, o, radius, dir * L, dir * L);
  }
  ctx.fillStyle = top;
  ctx.fill();
  if (hiA > 0.004) innerLine(s, o, radius, dir * Math.max(L, 0), dir * Math.max(L, 0), top, hiA, lip);
  ctx.restore();
};

// One cell's top quad as the current path, shifted by (dx, dy).
const cellPath = (s: Scene, o: number, radius: number, dx: number, dy: number) => {
  s.ctx.beginPath();
  quadPath(s.ctx, s.polys, o, radius, dx, dy);
};

// The Coil's flat 1px inner highlight along two edges of the face at
// (dx, dy): the top and left when side is 1, the bottom and right when -1.
// Called inside the cell's clip, so the face's clip intersects it.
const innerLine = (s: Scene, o: number, radius: number, dx: number, dy: number, base: string, alpha: number, side: 1 | -1) => {
  const { ctx, polys } = s;
  ctx.save();
  ctx.beginPath();
  quadPath(ctx, polys, o, radius, dx, dy);
  ctx.clip();
  ctx.fillStyle = alphaCss(s.hiCss, s.hi, alpha);
  ctx.fill();
  ctx.beginPath();
  quadPath(ctx, polys, o, radius, dx + side, dy + side);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.restore();
};
