import { SCATTER_OFF, type ScatterSettings } from "./settings";

// Scatter: a layer over the pointer modes. A fast pointer throws the dots it
// passes: each gets its own velocity from the stroke (its speed and
// direction, bent away from the pointer, with a per-dot spread so every dot
// keeps its own path), flies with drag, and once it has slowed springs home,
// critically damped so it never overshoots. Only thrown dots carry state, in
// a fixed pool; nothing is allocated per frame. Positions are layer px.
//
// A dot is named by its column, its row and its side of the spine, so the
// field skips drawing a thrown dot in place and the pool draws it in flight,
// even if the field's own row thins under it (carve, music) meanwhile.

const CAP = 600;
const VMAX = 900; // px/s, the fastest any dot is thrown (with the default drag, about 250px of flight)
const LAND_SPEED = 40; // px/s: slower than this, a dot stops flying and heads home
const MAX_FLIGHT = 2; // s, a flight never lasts longer
const SETTLE = 6.6; // a critically damped spring is within 1 percent after 6.6 / omega

const hash = (k: number, salt: number) => {
  const h = Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

export const dotKey = (j: number, q: number, side: number) => (j * 16 + q) * 2 + side;

export function createScatter() {
  let settings: ScatterSettings = SCATTER_OFF;
  const key = new Int32Array(CAP);
  const col = new Int32Array(CAP);
  const homeX = new Float32Array(CAP);
  const homeY = new Float32Array(CAP);
  const offX = new Float32Array(CAP);
  const offY = new Float32Array(CAP);
  const velX = new Float32Array(CAP);
  const velY = new Float32Array(CAP);
  const age = new Float32Array(CAP);
  const radius = new Float32Array(CAP);
  const accent = new Uint8Array(CAP);
  const flying = new Uint8Array(CAP);
  const slot = new Map<number, number>();
  let colLive = new Uint16Array(0);
  let live = 0;
  let launched = 0;

  const release = (i: number) => {
    slot.delete(key[i]);
    colLive[col[i]]--;
    const last = --live;
    if (i !== last) {
      key[i] = key[last];
      col[i] = col[last];
      homeX[i] = homeX[last];
      homeY[i] = homeY[last];
      offX[i] = offX[last];
      offY[i] = offY[last];
      velX[i] = velX[last];
      velY[i] = velY[last];
      age[i] = age[last];
      radius[i] = radius[last];
      accent[i] = accent[last];
      flying[i] = flying[last];
      slot.set(key[i], i);
    }
  };

  const clear = () => {
    for (let i = 0; i < live; i++) colLive[col[i]] = 0;
    slot.clear();
    live = 0;
  };

  return {
    get on() {
      return settings.on;
    },
    get threshold() {
      return settings.threshold;
    },
    get live() {
      return live;
    },
    get launched() {
      return launched;
    },
    configure(next: ScatterSettings) {
      settings = next;
      if (!next.on) clear();
    },
    resize(columns: number) {
      colLive = new Uint16Array(columns);
      slot.clear();
      live = 0;
    },
    clear,
    columnLive: (j: number) => colLive[j] > 0,
    isLive: (k: number) => slot.has(k),
    // Throw one dot. (px, py) is the pointer, (dirX, dirY) its direction, speed its px/s.
    launch(k: number, j: number, x: number, y: number, r: number, isAccent: boolean, px: number, py: number, dirX: number, dirY: number, speed: number): boolean {
      if (live >= CAP || slot.has(k)) return false;
      const i = live++;
      slot.set(k, i);
      colLive[j]++;
      launched++;
      let rx = x - px;
      let ry = y - py;
      const d = Math.hypot(rx, ry) || 1;
      rx /= d;
      ry /= d;
      let bx = dirX * 0.65 + rx * 0.35;
      let by = dirY * 0.65 + ry * 0.35;
      const b = Math.hypot(bx, by) || 1;
      bx /= b;
      by /= b;
      const turn = (hash(k, 1) - 0.5) * settings.spread * Math.PI * 0.6;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      const v = Math.min(VMAX, speed * settings.launch) * (1 + (hash(k, 2) - 0.5) * settings.spread);
      key[i] = k;
      col[i] = j;
      homeX[i] = x;
      homeY[i] = y;
      offX[i] = 0;
      offY[i] = 0;
      velX[i] = (bx * c - by * s) * v;
      velY[i] = (bx * s + by * c) * v;
      age[i] = 0;
      radius[i] = r;
      accent[i] = isAccent ? 1 : 0;
      flying[i] = 1;
      return true;
    },
    // Advance every thrown dot; settled ones go home and leave the pool.
    step(dt: number) {
      const omega = SETTLE / Math.max(0.1, settings.returnS);
      const drag = Math.exp(-settings.drag * dt);
      for (let i = live - 1; i >= 0; i--) {
        age[i] += dt;
        if (flying[i]) {
          velX[i] *= drag;
          velY[i] *= drag;
          offX[i] += velX[i] * dt;
          offY[i] += velY[i] * dt;
          if (Math.hypot(velX[i], velY[i]) < LAND_SPEED || age[i] > MAX_FLIGHT) {
            flying[i] = 0;
            // No overshoot: a critically damped spring stays on its side of
            // home as long as the speed toward home is under omega x distance.
            const d = Math.hypot(offX[i], offY[i]);
            if (d > 1e-3) {
              const ux = -offX[i] / d;
              const uy = -offY[i] / d;
              const toward = velX[i] * ux + velY[i] * uy;
              if (toward > omega * d) {
                const cut = toward - omega * d;
                velX[i] -= ux * cut;
                velY[i] -= uy * cut;
              }
            }
          }
          continue;
        }
        const ax = -omega * omega * offX[i] - 2 * omega * velX[i];
        const ay = -omega * omega * offY[i] - 2 * omega * velY[i];
        velX[i] += ax * dt;
        velY[i] += ay * dt;
        offX[i] += velX[i] * dt;
        offY[i] += velY[i] * dt;
        if (Math.abs(offX[i]) + Math.abs(offY[i]) < 0.4 && Math.abs(velX[i]) + Math.abs(velY[i]) < 6) release(i);
      }
    },
    // The thrown dots inside a tile, as tile-local dots for the painter.
    paint(top: number, height: number, muted: number[], accentOut: number[]) {
      for (let i = 0; i < live; i++) {
        const y = homeY[i] + offY[i] - top;
        if (y < -4 || y > height + 4) continue;
        (accent[i] ? accentOut : muted).push(homeX[i] + offX[i], y, radius[i]);
      }
    },
    // The farthest any thrown dot is from home, px.
    spread(): number {
      let far = 0;
      for (let i = 0; i < live; i++) far = Math.max(far, Math.hypot(offX[i], offY[i]));
      return far;
    },
  };
}

export type Scatter = ReturnType<typeof createScatter>;
