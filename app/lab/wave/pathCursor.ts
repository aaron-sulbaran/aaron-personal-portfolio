import type { CursorSettings } from "./settings";

// The pointer's touch on the path's dots: per-column state the path engine
// steps only for the tiles the pointer's reach (or a still-settling column)
// touches, and reads while painting. Nothing here reads the DOM; the engine
// hands in the pointer in layer coordinates.
//
// The band's carve (lib/waveform/dots.ts, field.ts) is the reference for
// "carve": columns within 74px thin to a tenth of their fuzz (eased at 0.1
// per 45fps frame, about a 0.2s time constant), and dots within 92px are
// pushed straight away from the pointer by up to 26px. On a curved spine the
// distance is to the column's point on the spine, not along x.

const REPEL_FORCE = 26; // px, the band's
const CARVE_SHARE = 74 / 92; // the band's carve radius as a share of its repel radius
const SPEED_SLOW = 120; // px/s, the name wake's slow pass: below it the push does almost nothing
const PLUCK_SPEED = 700; // px of arc per second the ripple travels
const PLUCK_WIDTH = 70; // px, the ripple packet's half width
const PLUCK_WAVE = 60; // px, its carrier's wavelength
const PLUCKS = 4;
const REST = 1e-3;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createCursor() {
  let settings: CursorSettings = { mode: "none", radius: 92, strength: 1, recovery: 0.6, saturate: 1600, mix: { push: 1, carve: 0.6, swell: 0.5 } };
  // How stirred the water is: rises with pointer speed, relaxes over the recovery.
  let stir = 0;
  const pointer = { x: 0, y: 0, on: false, speed: 0, dirX: 0, dirY: 0, moved: false, lastT: 0 };
  let carve = new Float32Array(0);
  let swell = new Float32Array(0);
  let bright = new Float32Array(0);
  let offX = new Float32Array(0);
  let offY = new Float32Array(0);
  let velX = new Float32Array(0);
  let velY = new Float32Array(0);
  let stamp = new Int32Array(0);
  const pluckS = new Float32Array(PLUCKS);
  const pluckAge = new Float32Array(PLUCKS);
  const pluckAmp = new Float32Array(PLUCKS);
  let plucks = 0;
  let frame = 0;
  let unsettled = 0;
  // The last column the pointer was nearest, and which side of the spine it was on.
  let nearJ = -1;
  let nearSide = 0;

  const fastOf = (speed: number) => clamp01((speed - SPEED_SLOW) / Math.max(1, settings.saturate - SPEED_SLOW));
  const ease = (current: number, target: number, dt: number) => {
    const tau = Math.max(0.05, settings.recovery / 3);
    return target + (current - target) * Math.exp(-dt / tau);
  };

  return {
    pointer,
    get mode() {
      return settings.mode;
    },
    get radius() {
      return settings.mode === "push" || settings.mode === "blend" ? settings.radius * 2 : settings.radius;
    },
    configure(next: CursorSettings) {
      settings = next;
    },
    resize(columns: number) {
      carve = new Float32Array(columns);
      swell = new Float32Array(columns);
      bright = new Float32Array(columns);
      offX = new Float32Array(columns);
      offY = new Float32Array(columns);
      velX = new Float32Array(columns);
      velY = new Float32Array(columns);
      stamp = new Int32Array(columns);
      plucks = 0;
      nearJ = -1;
    },
    move(x: number, y: number, t: number) {
      const dt = pointer.lastT ? Math.max(1e-3, (t - pointer.lastT) / 1000) : 0;
      if (pointer.on && dt > 0) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 320) {
          const v = d / dt;
          const k = 1 - Math.exp(-dt / 0.07);
          pointer.speed += (v - pointer.speed) * k;
          if (d > 0.5) {
            pointer.dirX = dx / d;
            pointer.dirY = dy / d;
          }
        }
      }
      pointer.x = x;
      pointer.y = y;
      pointer.on = true;
      pointer.moved = true;
      pointer.lastT = t;
    },
    // The page scrolled under a resting pointer: it is somewhere new on the
    // spine, but it did not move, so no speed.
    place(x: number, y: number) {
      pointer.x = x;
      pointer.y = y;
    },
    unsettledCount: () => unsettled,
    leave() {
      pointer.on = false;
      pointer.speed = 0;
      nearJ = -1;
    },
    // Called with the column nearest the pointer (within reach) after a move:
    // a change of side across the spine is a pluck.
    crossing(j: number, side: number, s: number) {
      if (settings.mode !== "pluck") return;
      if (nearJ >= 0 && Math.abs(j - nearJ) <= 4 && side !== 0 && nearSide !== 0 && side !== nearSide) {
        const slot = plucks < PLUCKS ? plucks++ : 0;
        pluckS[slot] = s;
        pluckAge[slot] = 0;
        pluckAmp[slot] = 0.35 * settings.strength * clamp01(0.35 + pointer.speed / 1500);
      }
      nearJ = j;
      nearSide = side;
    },
    beginFrame(dt: number) {
      frame++;
      unsettled = 0;
      // Speed decays while the pointer rests, so a pause is not a swipe.
      if (!pointer.moved) pointer.speed *= Math.exp(-dt / 0.07);
      const target = fastOf(pointer.speed);
      // Rises in about 80ms, relaxes over the recovery: the ring outlives the stroke briefly.
      stir = target > stir ? target + (stir - target) * Math.exp(-dt / 0.08) : ease(stir, target, dt);
      if (stir > REST) unsettled++;
      for (let i = 0; i < plucks; i++) pluckAge[i] += dt;
      let k = 0;
      const life = Math.max(0.6, settings.recovery * 2);
      for (let i = 0; i < plucks; i++) {
        if (pluckAge[i] < life) {
          pluckS[k] = pluckS[i];
          pluckAge[k] = pluckAge[i];
          pluckAmp[k] = pluckAmp[i];
          k++;
        }
      }
      plucks = k;
    },
    endFrame() {
      pointer.moved = false;
    },
    // Step one column once per frame; tiles share columns, the stamp dedupes.
    step(j: number, cx: number, cy: number, dt: number) {
      if (stamp[j] === frame) return;
      stamp[j] = frame;
      const mode = settings.mode;
      const R = settings.radius;
      let near = 0;
      let dx = 0;
      let dy = 0;
      let d = Infinity;
      if (pointer.on) {
        dx = cx - pointer.x;
        dy = cy - pointer.y;
        d = Math.hypot(dx, dy);
        near = clamp01(1 - d / R);
      }
      const strength = settings.strength;
      if (mode === "carve") {
        const target = clamp01(1 - d / (R * CARVE_SHARE)) * Math.min(1, strength);
        carve[j] = ease(carve[j], target, dt);
        if (Math.abs(carve[j] - target) > REST) unsettled++;
      } else if (mode === "swell") {
        swell[j] = ease(swell[j], near * strength, dt);
        if (Math.abs(swell[j] - near * strength) > REST) unsettled++;
      } else if (mode === "brighten") {
        const target = near * Math.min(1, strength);
        bright[j] = ease(bright[j], target, dt);
        if (Math.abs(bright[j] - target) > REST) unsettled++;
      } else if (mode === "lean") {
        const pull = near * near * 0.3 * strength;
        offX[j] = ease(offX[j], -dx * pull, dt);
        offY[j] = ease(offY[j], -dy * pull, dt);
        if (Math.abs(offX[j] + dx * pull) + Math.abs(offY[j] + dy * pull) > 0.05) unsettled++;
      } else if (mode === "push" || mode === "blend") {
        const blend = mode === "blend";
        const mix = settings.mix;
        if (blend) {
          // The clearing: a small carve right under the pointer, at any speed,
          // so a resting pointer over a paragraph only ever removes dots.
          const clear = clamp01(1 - d / (R * 0.6)) * mix.carve;
          carve[j] = ease(carve[j], clear, dt);
          // The ring: just outside the clearing the wave lifts with the stir,
          // never at rest.
          const ring = Math.exp(-(((d - R * 0.85) / (R * 0.35)) ** 2));
          const lift = ring * stir * mix.swell;
          swell[j] = ease(swell[j], lift, dt);
          if (Math.abs(carve[j] - clear) > REST || Math.abs(swell[j] - lift) > REST) unsettled++;
        }
        // A kick away from the pointer (bent along the stroke) in proportion
        // to its speed, over a reach that widens with speed, then a critically
        // damped return: it never overshoots, never snaps.
        const fast = fastOf(pointer.speed);
        const reach = R * (1 + fast);
        const amount = strength * (blend ? mix.push : 1);
        if (pointer.moved && d < reach && d > 0.01 && amount > 0) {
          const f = (1 - d / reach) * (0.05 + fast) * amount * 900 * dt;
          velX[j] += ((dx / d) * 0.7 + pointer.dirX * 0.3) * f;
          velY[j] += ((dy / d) * 0.7 + pointer.dirY * 0.3) * f;
        }
        const w = 6 / Math.max(0.15, settings.recovery);
        velX[j] += (-w * w * offX[j] - 2 * w * velX[j]) * dt;
        velY[j] += (-w * w * offY[j] - 2 * w * velY[j]) * dt;
        offX[j] += velX[j] * dt;
        offY[j] += velY[j] * dt;
        if (Math.abs(offX[j]) + Math.abs(offY[j]) + Math.abs(velX[j]) * 0.05 + Math.abs(velY[j]) * 0.05 > 0.05) unsettled++;
      }
    },
    busy() {
      return unsettled > 0 || plucks > 0;
    },
    hasPlucks() {
      return plucks > 0;
    },
    carveScale: (j: number) => 1 - carve[j] * 0.9,
    swellScale: (j: number) => 1 + Math.min(0.8, swell[j] * 0.8),
    brightness: (j: number) => bright[j],
    offX: (j: number) => offX[j],
    offY: (j: number) => offY[j],
    // The ripples' displacement at arc length s, in max-amplitude units.
    pluck(s: number): number {
      let sum = 0;
      for (let i = 0; i < plucks; i++) {
        const age = pluckAge[i];
        const front = Math.abs(s - pluckS[i]) - PLUCK_SPEED * age;
        const env = Math.exp(-((front / PLUCK_WIDTH) ** 2));
        if (env < 1e-3) continue;
        sum += pluckAmp[i] * Math.exp(-age / Math.max(0.2, settings.recovery * 0.6)) * env * Math.sin((2 * Math.PI * front) / PLUCK_WAVE);
      }
      return sum;
    },
    // The band's repel, per dot, written into out: dots inside the radius
    // move straight away from the pointer.
    repel(x: number, y: number, out: { x: number; y: number }) {
      out.x = x;
      out.y = y;
      const blend = settings.mode === "blend";
      if ((settings.mode !== "carve" && !blend) || !pointer.on) return;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      const R = blend ? settings.radius * 0.6 : settings.radius;
      if (d2 < R * R && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const force = (1 - d / R) * REPEL_FORCE * settings.strength * (blend ? settings.mix.carve * 0.6 : 1);
        out.x += (dx / d) * force;
        out.y += (dy / d) * force;
      }
    },
  };
}

export type PathCursor = ReturnType<typeof createCursor>;
