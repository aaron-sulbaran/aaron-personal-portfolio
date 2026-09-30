// The name's wake: what a pointer leaves in the lit surface behind "Aaron".
// Ported from the winning name lab (Opus "Tide", labs/name-lab-opus-build/
// name-surface.js), with the design review's changes.
//
// A low resolution grid laid over the name's lockup (greeting included) plus
// a margin. A pointer stroke raises each nearby cell's STIR toward an amount
// that grows with the stroke's speed, over a radius that widens with speed;
// the stir decays (stirTau) and diffuses to its neighbours, so the swell
// widens as it settles. Each cell's WAKE follows its stir with the coil's own
// stretch envelope (critically damped, rise 2.6/s, relax 1.6/s, never past
// its target, never below zero), so a fast swipe keeps swelling for about
// three quarters of a second after the pointer has passed, then settles over
// a few more: it never snaps and never trails the cursor. Each cell also
// remembers the strokes' direction; the upload low-passes it over dirBlur
// cells, so a fast turn shows no crease in the surface it drags.
//
// Pure, no DOM, no allocation per frame: the scene owns one wake and one
// byte array and reuses both.

export const WAKE = {
  cols: 72,
  rows: 26,
  margin: 0.12, // the grid reaches past the lockup by this fraction of its size on every side
  stirTau: 0.5, // s: the stir decays; this sets how long a swipe keeps feeding the swell
  rise: 2.6, // 1/s: the coil's envelopeRise
  relax: 1.6, // 1/s: and its envelopeRelax
  spread: 0.9, // 1/s: the stir diffuses, so the swell widens as it settles (water, not a halo)
  slow: { speed: 120, radius: 140 }, // CSS px/s and px: a slow pass stirs a band about a letter's height
  fast: { speed: 2200, radius: 440 }, // a fast swipe stirs fully, wide and soft (the lab's 320 widened so one swipe reaches the whole name)
  // The stir a pass at the slow speed leaves. Raised from the lab's 0.05 and
  // the slow radius from 80 (Aaron, 2026-09-30: a slow pass should give a
  // faint but visible stir, about 0.02 to 0.03 of lightness in the letters).
  creep: 0.36,
  teleportPx: 320, // a segment longer than this in one frame is a jump, not a stroke
  // s: the stroke's speed is smoothed over about this, so a frame that saw no
  // pointer event and the next that saw two do not read as a stop and a dash.
  speedTau: 0.07,
  rest: 0.002,
  dirBlur: 2, // cells: the direction's low-pass radius at upload
  // The peak a 300 px/s pass reaches (the unit test's window; the e2e suite
  // holds the lightness it makes inside the letters).
  slowPeak: [0.15, 0.25] as const,
} as const;

export type WakeRect = { x: number; y: number; w: number; h: number };

export type Wake = {
  readonly cols: number;
  readonly rows: number;
  readonly S: Float32Array; // stir, the target; row 0 at the grid's top
  readonly E: Float32Array; // wake, what the surface shows
  readonly V: Float32Array; // the wake's velocity
  readonly DX: Float32Array; // the strokes' direction, screen x
  readonly DY: Float32Array; // and world y (up)
  readonly BX: Float32Array; // the direction low-passed for upload
  readonly BY: Float32Array;
  readonly tmp: Float32Array;
  active: boolean; // any cell away from rest
  speed: number; // the pointer's smoothed speed, CSS px/s
};

export function createWake(cols: number = WAKE.cols, rows: number = WAKE.rows): Wake {
  const n = cols * rows;
  const f = () => new Float32Array(n);
  return { cols, rows, S: f(), E: f(), V: f(), DX: f(), DY: f(), BX: f(), BY: f(), tmp: f(), active: false, speed: 0 };
}

// The grid's rect over the name's lockup rect (CSS px), written into `out`.
export function wakeRectOf(name: WakeRect, out: WakeRect): WakeRect {
  const m = WAKE.margin;
  out.x = name.x - name.w * m;
  out.y = name.y - name.h * m;
  out.w = name.w * (1 + 2 * m);
  out.h = name.h * (1 + 2 * m);
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

const stroke = { amount: 0, radius: 0 };

// The stir and radius of a pointer moving at `speed` CSS px/s. Returns a
// shared record (read it before the next call).
export function strokeAmount(speed: number): { readonly amount: number; readonly radius: number } {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const t = smooth(clamp01((s - WAKE.slow.speed) / (WAKE.fast.speed - WAKE.slow.speed)));
  stroke.amount = WAKE.creep * clamp01(s / WAKE.slow.speed) + (1 - WAKE.creep) * t;
  stroke.radius = WAKE.slow.radius + (WAKE.fast.radius - WAKE.slow.radius) * t;
  return stroke;
}

// One frame's pointer segment (x0, y0) to (x1, y1) over `dt` seconds (a
// still pointer is a segment of length 0), in the same CSS px space as `rect`
// (the grid's). Raises each cell's stir toward the stroke's amount (never
// lowers it) with a soft bell over the radius, and turns the cells' direction
// toward the stroke's, weighted the same.
export function injectStroke(wake: Wake, rect: WakeRect, x0: number, y0: number, x1: number, y1: number, dt: number) {
  const sx = x1 - x0;
  const sy = y1 - y0;
  const len = Math.hypot(sx, sy);
  // A jump longer than any hand makes in one frame is the pointer re-entering
  // or teleporting: no stroke, and it says nothing about the hand's speed.
  if (!(dt > 0) || !Number.isFinite(len) || len > WAKE.teleportPx) return;
  wake.speed += (len / dt - wake.speed) * (1 - Math.exp(-dt / WAKE.speedTau));
  if (!(len >= 0.5) || !(rect.w > 0) || !(rect.h > 0)) return;
  const { amount, radius } = strokeAmount(wake.speed);
  if (amount <= 0.001) return;
  const { cols, rows, S, DX, DY } = wake;
  const cw = rect.w / cols;
  const ch = rect.h / rows;
  const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - radius - rect.x) / cw));
  const c1 = Math.min(cols - 1, Math.ceil((Math.max(x0, x1) + radius - rect.x) / cw));
  const r0 = Math.max(0, Math.floor((Math.min(y0, y1) - radius - rect.y) / ch));
  const r1 = Math.min(rows - 1, Math.ceil((Math.max(y0, y1) + radius - rect.y) / ch));
  if (c0 > c1 || r0 > r1) return;
  const ux = sx / len;
  const uy = sy / len;
  for (let row = r0; row <= r1; row++) {
    const py = rect.y + (row + 0.5) * ch;
    for (let col = c0; col <= c1; col++) {
      const px = rect.x + (col + 0.5) * cw;
      const along = Math.min(len, Math.max(0, (px - x0) * ux + (py - y0) * uy));
      const d = Math.hypot(px - (x0 + ux * along), py - (y0 + uy * along));
      if (d >= radius) continue;
      const f = 1 - smooth(d / radius);
      const i = row * cols + col;
      const target = amount * f;
      if (target > S[i]) S[i] = target;
      const w = Math.min(1, f * amount * 1.5);
      DX[i] += (ux - DX[i]) * w;
      DY[i] += (-uy - DY[i]) * w; // world y is up
      wake.active = true;
    }
  }
}

// Every cell's stir decays and spreads; every cell's wake follows its stir
// with the analytic critically damped step (exact for any dt), rise or relax,
// never through its target, never below zero. Returns whether the texture
// needs an upload (true on every live frame and the one it comes to rest).
export function stepWake(wake: Wake, dt: number): boolean {
  if (!wake.active) return false;
  const { cols, rows, S, E, V, DX, DY, tmp } = wake;
  const h = Math.min(Math.max(0, dt), 0.1);
  const decay = Math.exp(-h / WAKE.stirTau);
  const k = Math.min(0.5, WAKE.spread * h);
  tmp.set(S);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const avg =
        (tmp[c > 0 ? i - 1 : i] + tmp[c < cols - 1 ? i + 1 : i] + tmp[r > 0 ? i - cols : i] + tmp[r < rows - 1 ? i + cols : i]) * 0.25;
      S[i] = (tmp[i] + (avg - tmp[i]) * k) * decay;
    }
  }
  let live = false;
  for (let i = 0; i < S.length; i++) {
    const target = S[i];
    const w = target > E[i] ? WAKE.rise : WAKE.relax;
    const x = E[i] - target;
    const v = V[i];
    const c = v + w * x;
    const ew = Math.exp(-w * h);
    let nx = (x + c * h) * ew;
    let nv = (v - w * c * h) * ew;
    if (x !== 0 && Math.sign(nx) !== Math.sign(x)) {
      nx = 0;
      nv = 0;
    }
    let e = target + nx;
    if (e < 0) {
      e = 0;
      nv = Math.max(0, nv);
    }
    if (e > WAKE.rest || target > WAKE.rest) {
      E[i] = e;
      V[i] = nv;
      live = true;
    } else {
      E[i] = 0;
      V[i] = 0;
      S[i] = 0;
    }
  }
  if (!live) {
    DX.fill(0);
    DY.fill(0);
  }
  wake.active = live;
  return true;
}

// One separable box pass of radius `r` over `src` into `dst` along x (dx 1)
// or y (dx cols), with half-sample symmetric edges: the operator is doubly
// stochastic, so the sum (and the mean) of the field is kept exactly.
function boxPass(src: Float32Array, dst: Float32Array, cols: number, rows: number, alongX: boolean, r: number) {
  const n = alongX ? cols : rows;
  const lines = alongX ? rows : cols;
  const inv = 1 / (2 * r + 1);
  for (let line = 0; line < lines; line++) {
    for (let at = 0; at < n; at++) {
      let sum = 0;
      for (let o = -r; o <= r; o++) {
        let j = at + o;
        if (j < 0) j = -j - 1;
        else if (j >= n) j = 2 * n - j - 1;
        sum += alongX ? src[line * cols + j] : src[j * cols + line];
      }
      if (alongX) dst[line * cols + at] = sum * inv;
      else dst[at * cols + line] = sum * inv;
    }
  }
}

// The direction low-passed over dirBlur cells into BX, BY.
export function blurDirection(wake: Wake) {
  const { cols, rows, DX, DY, BX, BY, tmp } = wake;
  const r = WAKE.dirBlur;
  boxPass(DX, tmp, cols, rows, true, r);
  boxPass(tmp, BX, cols, rows, false, r);
  boxPass(DY, tmp, cols, rows, true, r);
  boxPass(tmp, BY, cols, rows, false, r);
}

// r: the wake (0..1); g, b: the low-passed direction (0.5 is zero; world y
// up). Texture rows run bottom up, so the grid's top row is the last.
export function encodeWake(wake: Wake, bytes: Uint8Array) {
  const { cols, rows, E, BX, BY } = wake;
  for (let r = 0; r < rows; r++) {
    const tr = rows - 1 - r;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const j = (tr * cols + c) * 4;
      bytes[j] = Math.round(clamp01(E[i]) * 255);
      const m = Math.hypot(BX[i], BY[i]);
      const s = m > 1 ? 1 / m : 1;
      bytes[j + 1] = Math.round(128 + 127 * BX[i] * s);
      bytes[j + 2] = Math.round(128 + 127 * BY[i] * s);
      bytes[j + 3] = 255;
    }
  }
}

export function maxWake(wake: Wake) {
  let m = 0;
  for (let i = 0; i < wake.E.length; i++) if (wake.E[i] > m) m = wake.E[i];
  return m;
}

export function clearWake(wake: Wake) {
  wake.S.fill(0);
  wake.E.fill(0);
  wake.V.fill(0);
  wake.DX.fill(0);
  wake.DY.fill(0);
  wake.BX.fill(0);
  wake.BY.fill(0);
  wake.active = false;
  wake.speed = 0;
}
