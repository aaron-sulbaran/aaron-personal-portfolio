import { describe, expect, it } from "vitest";
import {
  REPEL,
  createRepelField,
  encodeRepel,
  injectStroke,
  maxOffset,
  stepRepel,
  strokeStrength,
  type RepelField,
  type RepelRect,
} from "@/lib/coil/repel";

// The name's rect at 1440x900: 70 percent of the width, the greeting on top.
const rect: RepelRect = { x: 216, y: 250, w: 1008, h: 420 };
const FRAME = 1 / 60;

const affectedCells = (field: RepelField) => {
  let count = 0;
  for (let i = 0; i < field.cols * field.rows; i++) {
    if (Math.hypot(field.d[2 * i], field.d[2 * i + 1]) > 0.05) count += 1;
  }
  return count;
};

// One frame's pointer segment across the middle of the name at `speed` px/s.
function strokeAt(speed: number) {
  const field = createRepelField();
  const length = speed * FRAME;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  injectStroke(field, rect, { x: cx - length / 2, y: cy }, { x: cx + length / 2, y: cy }, FRAME);
  return field;
}

const allFinite = (field: RepelField) => field.d.every(Number.isFinite) && field.v.every(Number.isFinite);

describe("strokeStrength", () => {
  it("grows radius and push with pointer speed, from a small nudge to a wide swipe", () => {
    const slow = strokeStrength(150);
    const fast = strokeStrength(4000);
    expect(slow.radius).toBeCloseTo(REPEL.slow.radius, 5);
    expect(slow.push).toBeLessThanOrEqual(REPEL.slow.push + 1e-9);
    expect(fast.radius).toBeCloseTo(REPEL.fast.radius, 5);
    expect(fast.push).toBeCloseTo(REPEL.fast.push, 5);
    let last = strokeStrength(0);
    for (let speed = 10; speed < 6000; speed += 10) {
      const next = strokeStrength(speed);
      expect(next.radius).toBeGreaterThanOrEqual(last.radius - 1e-9);
      expect(next.push).toBeGreaterThanOrEqual(last.push - 1e-9);
      last = next;
    }
  });

  it("is still for a still pointer", () => {
    expect(strokeStrength(0).push).toBe(0);
  });
});

describe("injectStroke", () => {
  it("scales with speed: a fast swipe pushes further and reaches more cells than a slow drift", () => {
    const slow = strokeAt(120);
    const fast = strokeAt(3200);
    expect(maxOffset(slow)).toBeGreaterThan(0.5);
    expect(maxOffset(slow)).toBeLessThanOrEqual(REPEL.slow.push + 1e-6);
    expect(maxOffset(fast)).toBeGreaterThan(maxOffset(slow) * 4);
    expect(affectedCells(fast)).toBeGreaterThan(affectedCells(slow) * 8);
  });

  it("points every offset away from the pointer's path", () => {
    const field = strokeAt(2000);
    const cy = rect.y + rect.h / 2;
    for (let row = 0; row < field.rows; row++) {
      for (let col = 0; col < field.cols; col++) {
        const i = row * field.cols + col;
        const dy = field.d[2 * i + 1];
        const cellY = rect.y + ((row + 0.5) / field.rows) * rect.h;
        if (Math.abs(dy) > 0.05) expect(Math.sign(dy)).toBe(Math.sign(cellY - cy));
      }
    }
  });

  it("holds the clamps however often the same swipe repeats", () => {
    const field = createRepelField();
    const cy = rect.y + rect.h / 2;
    for (let k = 0; k < 200; k++) {
      const x = rect.x + ((k * 37) % rect.w);
      injectStroke(field, rect, { x, y: cy - 30 }, { x: x + 90, y: cy + 30 }, FRAME);
      injectStroke(field, rect, { x: x + 90, y: cy + 30 }, { x, y: cy - 30 }, FRAME);
    }
    // Float32 storage: the clamp holds to its precision.
    expect(maxOffset(field)).toBeLessThanOrEqual(REPEL.maxPush + 1e-4);
    // Nothing lands farther than the widest radius from the name's rect.
    const far = createRepelField();
    injectStroke(far, rect, { x: rect.x - 400, y: rect.y - 400 }, { x: rect.x - 300, y: rect.y - 400 }, FRAME);
    expect(maxOffset(far)).toBe(0);
  });

  it("leaves the buffer at rest for zero input", () => {
    const field = createRepelField();
    const p = { x: rect.x + 300, y: rect.y + 200 };
    injectStroke(field, rect, p, p, FRAME);
    injectStroke(field, rect, p, { x: p.x + 5, y: p.y }, 0);
    for (let k = 0; k < 120; k++) stepRepel(field, FRAME);
    expect(maxOffset(field)).toBe(0);
    expect(field.active).toBe(false);
  });

  it("never writes NaN at the edges, corners or outside the rect", () => {
    const field = createRepelField();
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x, y: rect.y + rect.h },
      { x: rect.x + rect.w, y: rect.y + rect.h },
    ];
    for (const c of corners) {
      injectStroke(field, rect, c, { x: c.x + 0.6, y: c.y + 0.6 }, FRAME);
      injectStroke(field, rect, { x: c.x - 50, y: c.y - 50 }, { x: c.x + 50, y: c.y + 50 }, 1e-6);
    }
    // A stroke through a cell center exactly (distance 0 to the path).
    const col = 10;
    const row = 7;
    const cx = rect.x + ((col + 0.5) / REPEL.cols) * rect.w;
    const cy = rect.y + ((row + 0.5) / REPEL.rows) * rect.h;
    injectStroke(field, rect, { x: cx - 20, y: cy }, { x: cx + 20, y: cy }, FRAME);
    stepRepel(field, 0);
    stepRepel(field, 5);
    expect(allFinite(field)).toBe(true);
    const degenerate = createRepelField();
    injectStroke(degenerate, { x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0 }, { x: 40, y: 0 }, FRAME);
    expect(allFinite(degenerate)).toBe(true);
  });
});

describe("stepRepel", () => {
  it("refills under 1 percent in the refill time, from a fast swipe", () => {
    const field = strokeAt(3200);
    const start = maxOffset(field);
    const frames = Math.round(REPEL.refillS / FRAME);
    for (let k = 0; k < frames; k++) stepRepel(field, FRAME);
    expect(maxOffset(field)).toBeLessThan(start * 0.01);
  });

  it("relaxes without overshoot or ringing: no offset changes sign, none grows back", () => {
    const field = strokeAt(3200);
    // A second, opposite stroke mid-relaxation is the worst case for ringing.
    for (let k = 0; k < 6; k++) stepRepel(field, FRAME);
    const cy = rect.y + rect.h / 2 + 40;
    injectStroke(field, rect, { x: rect.x + 700, y: cy }, { x: rect.x + 300, y: cy }, FRAME);
    const signs = Array.from(field.d, Math.sign);
    const previous = Float64Array.from(field.d, Math.abs);
    let flips = 0;
    let regrowths = 0;
    for (let k = 0; k < 240; k++) {
      stepRepel(field, k % 7 === 0 ? 0.1 : FRAME);
      for (let i = 0; i < field.d.length; i++) {
        const value = field.d[i];
        if (value !== 0 && Math.sign(value) !== signs[i]) flips += 1;
        if (Math.abs(value) > previous[i] + 1e-9) regrowths += 1;
        previous[i] = Math.abs(value);
      }
    }
    expect(flips).toBe(0);
    expect(regrowths).toBe(0);
  });

  it("never crosses zero even when a cell carries a fast return velocity into a smaller offset", () => {
    // A later stroke can shrink one component of a cell that is already
    // springing home fast; the spring must still land without crossing.
    const field = createRepelField(1, 1);
    field.d[0] = 2;
    field.v[0] = -400;
    field.d[1] = -2;
    field.v[1] = 400;
    field.active = true;
    for (let k = 0; k < 120; k++) {
      stepRepel(field, FRAME);
      expect(field.d[0]).toBeGreaterThanOrEqual(0);
      expect(field.d[1]).toBeLessThanOrEqual(0);
    }
  });

  it("settles to exact rest and reports it, so the scene can stop uploading", () => {
    const field = strokeAt(3200);
    expect(field.active).toBe(true);
    for (let k = 0; k < 240; k++) stepRepel(field, FRAME);
    expect(field.active).toBe(false);
    expect(maxOffset(field)).toBe(0);
  });
});

describe("encodeRepel", () => {
  it("maps an offset of 0 to the byte midpoint and the clamp to the ends", () => {
    const field = createRepelField();
    const bytes = new Uint8Array(field.cols * field.rows * 4);
    encodeRepel(field, bytes);
    expect(bytes[0]).toBe(128);
    expect(bytes[1]).toBe(128);
    field.d[0] = REPEL.maxPush;
    field.d[1] = -REPEL.maxPush;
    encodeRepel(field, bytes);
    expect(bytes[0]).toBe(255);
    expect(bytes[1]).toBe(1);
    expect(bytes[3]).toBe(255);
  });
});
