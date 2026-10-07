import type { Cam } from "./maths";

// A bar is a rounded square extruded upward. The camera is orthographic, so
// the top face is the base shifted straight up the screen by the bar's
// projected height, and the outline of the whole bar is the top over the
// base joined along their leftmost and rightmost points. The flat cell and
// the skyline bar are the same shape at different heights.

export const ARC_STEPS = 4;
export const OUTLINE_LEN = 4 * (ARC_STEPS + 1);
export const SILHOUETTE_LEN = OUTLINE_LEN + 2;

// Corners clockwise on screen (x right, y down): [far x?, far y?, first quarter turn].
const CORNERS = [[0, 0, 2], [1, 0, 3], [1, 1, 0], [0, 1, 1]] as const;
const UNIT = Float64Array.from({ length: OUTLINE_LEN * 2 }, (_, k) => {
  const i = k >> 1;
  const angle = (CORNERS[Math.floor(i / (ARC_STEPS + 1))][2] + (i % (ARC_STEPS + 1)) / ARC_STEPS) * (Math.PI / 2);
  return k & 1 ? Math.sin(angle) : Math.cos(angle);
});

export function roundedCell(out: Float32Array, cam: Cam, x0: number, y0: number, w: number, r: number, z: number, sc: number, ox: number, oy: number) {
  const { cs, sn, se, ce } = cam;
  const rr = Math.max(0, Math.min(r, w / 2));
  for (let i = 0; i < OUTLINE_LEN; i++) {
    const c = CORNERS[Math.floor(i / (ARC_STEPS + 1))];
    const x = (c[0] ? x0 + w - rr : x0 + rr) + rr * UNIT[i * 2];
    const y = (c[1] ? y0 + w - rr : y0 + rr) + rr * UNIT[i * 2 + 1];
    out[i * 2] = ox + (x * cs - y * sn) * sc;
    out[i * 2 + 1] = oy + ((x * sn + y * cs) * se - z * ce) * sc;
  }
}

// The top chain (lifted) from the leftmost point to the rightmost, then the
// base's bottom chain back. `base` is clockwise on screen, as roundedCell
// writes it (the projection keeps orientation: its determinant is sin(elev)).
export function prismSilhouette(out: Float32Array, base: Float32Array, n: number, lift: number): number {
  let left = 0;
  let right = 0;
  for (let i = 1; i < n; i++) {
    if (base[i * 2] < base[left * 2]) left = i;
    if (base[i * 2] > base[right * 2]) right = i;
  }
  let o = 0;
  for (let i = left; ; i = (i + 1) % n) {
    out[o++] = base[i * 2];
    out[o++] = base[i * 2 + 1] - lift;
    if (i === right) break;
  }
  for (let i = right; ; i = (i + 1) % n) {
    out[o++] = base[i * 2];
    out[o++] = base[i * 2 + 1];
    if (i === left) break;
  }
  return o / 2;
}

// The front vertical edge: the base point lowest on screen splits the two visible side faces.
export function frontEdgeX(base: Float32Array, n: number): number {
  let f = 0;
  for (let i = 1; i < n; i++) if (base[i * 2 + 1] > base[f * 2 + 1]) f = i;
  return base[f * 2];
}
