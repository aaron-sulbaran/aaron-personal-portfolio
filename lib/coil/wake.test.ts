import { describe, expect, it } from "vitest";
import {
  WAKE,
  blurDirection,
  clearWake,
  createWake,
  encodeWake,
  injectStroke,
  maxWake,
  stepWake,
  strokeAmount,
  wakeRectOf,
  type Wake,
  type WakeRect,
} from "@/lib/coil/wake";

// The name's lockup at 1440x900 (greeting included) and the wake grid over it.
const nameRect: WakeRect = { x: 196, y: 214, w: 1048, h: 398 };
const rect = wakeRectOf(nameRect, { x: 0, y: 0, w: 0, h: 0 });
const FRAME = 1 / 60;

type Trace = { t: number; peak: number }[];

// A straight pointer path at `speed` px/s from a to b, one segment a frame,
// then `after` seconds with the pointer gone. Returns the wake's peak per frame.
function pass(wake: Wake, a: { x: number; y: number }, b: { x: number; y: number }, speed: number, after = 6) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const frames = Math.max(1, Math.round(length / speed / FRAME));
  const trace: Trace = [];
  let t = 0;
  for (let i = 1; i <= frames; i++) {
    const u0 = (i - 1) / frames;
    const u1 = i / frames;
    injectStroke(wake, rect, a.x + (b.x - a.x) * u0, a.y + (b.y - a.y) * u0, a.x + (b.x - a.x) * u1, a.y + (b.y - a.y) * u1, FRAME);
    stepWake(wake, FRAME);
    t += FRAME;
    trace.push({ t, peak: maxWake(wake) });
  }
  const end = t;
  for (let i = 0; i < Math.round(after / FRAME); i++) {
    stepWake(wake, FRAME);
    t += FRAME;
    trace.push({ t, peak: maxWake(wake) });
  }
  return { trace, end };
}

const middle = nameRect.y + nameRect.h * 0.55;
const left = { x: nameRect.x + 40, y: middle };
const right = { x: nameRect.x + nameRect.w - 40, y: middle };

function peakOf(trace: Trace) {
  return trace.reduce((best, s) => (s.peak > best.peak ? s : best), trace[0]);
}

describe("strokeAmount", () => {
  it("is nothing for a still pointer and full for a fast swipe", () => {
    expect(strokeAmount(0).amount).toBe(0);
    expect(strokeAmount(WAKE.fast.speed).amount).toBeCloseTo(1, 6);
    expect(strokeAmount(WAKE.fast.speed).radius).toBeCloseTo(WAKE.fast.radius, 6);
  });

  it("grows with speed, in amount and radius", () => {
    let last = { amount: 0, radius: 0 };
    for (let speed = 0; speed < 4000; speed += 20) {
      const next = { ...strokeAmount(speed) };
      expect(next.amount).toBeGreaterThanOrEqual(last.amount - 1e-9);
      expect(next.radius).toBeGreaterThanOrEqual(last.radius - 1e-9);
      last = next;
    }
  });
});

describe("the wake's rhythm", () => {
  it("a fast swipe swells after the pointer has passed: peak about 0.38, about 0.75s after the pass ends", () => {
    const wake = createWake();
    const { trace, end } = pass(wake, right, left, 2300);
    const peak = peakOf(trace);
    expect(peak.peak).toBeGreaterThan(0.33);
    expect(peak.peak).toBeLessThan(0.43);
    expect(peak.t - end).toBeGreaterThan(0.55);
    expect(peak.t - end).toBeLessThan(0.95);
  });

  it("a slow pass (300 px/s) stirs just noticeably, well under the fast swipe", () => {
    const wake = createWake();
    const { trace } = pass(wake, left, right, 300, 4);
    const peak = peakOf(trace).peak;
    expect(peak).toBeGreaterThan(WAKE.slowPeak[0]);
    expect(peak).toBeLessThan(WAKE.slowPeak[1]);
  });

  it("never overshoots: one rise, one fall, and no cell passes the most its stir ever asked", () => {
    const wake = createWake();
    const most = new Float32Array(wake.E.length);
    const trace: number[] = [];
    let overshoots = 0;
    const length = Math.hypot(right.x - left.x, right.y - left.y);
    const frames = Math.round(length / 2300 / FRAME);
    for (let i = 0; i < frames + 400; i++) {
      if (i < frames) {
        const u0 = i / frames;
        const u1 = (i + 1) / frames;
        injectStroke(wake, rect, right.x + (left.x - right.x) * u0, middle, right.x + (left.x - right.x) * u1, middle, FRAME);
      }
      for (let c = 0; c < most.length; c++) most[c] = Math.max(most[c], wake.S[c]);
      stepWake(wake, FRAME);
      for (let c = 0; c < most.length; c++) if (wake.E[c] > most[c] + 1e-6) overshoots++;
      trace.push(maxWake(wake));
    }
    expect(overshoots, "cells above the most their stir asked").toBe(0);
    // Within a thousandth: while the swell widens at its crest, a neighbouring
    // cell can take the top a hair below the last one before the fall.
    const top = trace.indexOf(Math.max(...trace));
    for (let i = 1; i <= top; i++) expect(trace[i]).toBeGreaterThanOrEqual(trace[i - 1] - 1e-3);
    for (let i = top + 1; i < trace.length; i++) expect(trace[i]).toBeLessThanOrEqual(trace[i - 1] + 1e-3);
  });

  it("is never negative, and every value stays finite", () => {
    const wake = createWake();
    pass(wake, right, left, 2300);
    pass(wake, left, { x: left.x + 5, y: left.y + 3 }, 40);
    for (let i = 0; i < wake.E.length; i++) {
      expect(wake.E[i]).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(wake.V[i])).toBe(true);
    }
  });

  it("settles: under a tenth of its peak about 2.5s after the peak, fully at rest within 6.5s of the pass", () => {
    const wake = createWake();
    const { trace, end } = pass(wake, right, left, 2300, 7);
    const peak = peakOf(trace);
    const tenth = trace.find((s) => s.t > peak.t && s.peak <= peak.peak * 0.1)!;
    expect(tenth.t - peak.t).toBeGreaterThan(2);
    expect(tenth.t - peak.t).toBeLessThan(3);
    const still = trace.find((s) => s.t > end && s.peak === 0);
    expect(still).toBeDefined();
    expect(still!.t - end).toBeLessThan(6.5);
    expect(wake.active).toBe(false);
  });

  it("widens as it settles: the swell covers more of the grid after its peak than at the pass's end", () => {
    const wake = createWake();
    const touched = () => wake.E.reduce((n, e) => n + (e > 0.02 ? 1 : 0), 0);
    const length = Math.hypot(right.x - left.x, right.y - left.y);
    const frames = Math.round(length / 2300 / FRAME);
    for (let i = 0; i < frames; i++) {
      const u0 = i / frames;
      const u1 = (i + 1) / frames;
      injectStroke(wake, rect, right.x + (left.x - right.x) * u0, middle, right.x + (left.x - right.x) * u1, middle, FRAME);
      stepWake(wake, FRAME);
    }
    const atEnd = touched();
    for (let i = 0; i < 45; i++) stepWake(wake, FRAME);
    expect(touched()).toBeGreaterThan(atEnd);
  });
});

describe("injectStroke", () => {
  it("a teleport (a jump longer than a hand moves in a frame) injects nothing", () => {
    const wake = createWake();
    injectStroke(wake, rect, left.x, left.y, left.x + WAKE.teleportPx + 1, left.y, FRAME);
    expect(wake.active).toBe(false);
    expect(maxWake(wake)).toBe(0);
    expect(wake.S.every((s) => s === 0)).toBe(true);
  });

  it("a stroke outside the grid, or with no time, injects nothing", () => {
    const wake = createWake();
    injectStroke(wake, rect, -2000, -2000, -1980, -1998, FRAME);
    injectStroke(wake, rect, left.x, left.y, left.x + 20, left.y, 0);
    expect(wake.active).toBe(false);
  });

  it("points the cells along the stroke, world y up", () => {
    const wake = createWake();
    injectStroke(wake, rect, left.x, left.y, left.x + 30, left.y - 30, FRAME);
    const c = Math.floor(((left.x + 15 - rect.x) / rect.w) * WAKE.cols);
    const r = Math.floor(((left.y - 15 - rect.y) / rect.h) * WAKE.rows);
    const i = r * WAKE.cols + c;
    expect(wake.DX[i]).toBeGreaterThan(0);
    expect(wake.DY[i]).toBeGreaterThan(0);
  });
});

describe("uploads", () => {
  it("idle uploads nothing: an untouched wake steps without asking for an upload", () => {
    const wake = createWake();
    for (let i = 0; i < 10; i++) expect(stepWake(wake, FRAME)).toBe(false);
  });

  it("asks for one last upload on the frame it comes to rest, then none", () => {
    const wake = createWake();
    pass(wake, right, left, 2300, 0);
    let frames = 0;
    while (stepWake(wake, FRAME)) frames++;
    expect(frames).toBeGreaterThan(0);
    expect(wake.active).toBe(false);
    expect(stepWake(wake, FRAME)).toBe(false);
  });

  it("encodes the wake bottom-up with direction centered on 128, and rest as zero wake", () => {
    const wake = createWake();
    const bytes = new Uint8Array(WAKE.cols * WAKE.rows * 4);
    encodeWake(wake, bytes);
    expect(bytes[0]).toBe(0);
    expect(bytes[1]).toBe(128);
    expect(bytes[2]).toBe(128);
    expect(bytes[3]).toBe(255);
    pass(wake, right, left, 2300, 0.5);
    blurDirection(wake);
    encodeWake(wake, bytes);
    // Top row of the grid is the texture's last row.
    const r = Math.floor(((middle - rect.y) / rect.h) * WAKE.rows);
    const c = Math.floor(WAKE.cols / 2);
    const i = r * WAKE.cols + c;
    const j = ((WAKE.rows - 1 - r) * WAKE.cols + c) * 4;
    expect(bytes[j]).toBe(Math.round(Math.min(1, wake.E[i]) * 255));
    expect(bytes[j + 1]).toBeLessThan(128); // the swipe ran right to left
  });

  it("clearWake returns every cell to rest", () => {
    const wake = createWake();
    pass(wake, right, left, 2300, 0.2);
    clearWake(wake);
    expect(wake.active).toBe(false);
    expect(maxWake(wake)).toBe(0);
    expect(wake.DX.every((d) => d === 0)).toBe(true);
  });
});

describe("blurDirection", () => {
  it("preserves the mean of each direction component", () => {
    const wake = createWake();
    pass(wake, right, left, 2300, 0.2);
    pass(wake, { x: left.x, y: nameRect.y }, { x: right.x, y: nameRect.y + nameRect.h }, 1800, 0.1);
    blurDirection(wake);
    const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(wake.BX)).toBeCloseTo(mean(wake.DX), 6);
    expect(mean(wake.BY)).toBeCloseTo(mean(wake.DY), 6);
  });

  it("low-passes a hard turn: no neighbouring cells differ by more than the raw field's jump", () => {
    const wake = createWake();
    // Half the grid points left, half up: a crease down the middle.
    for (let r = 0; r < WAKE.rows; r++) {
      for (let c = 0; c < WAKE.cols; c++) {
        const i = r * WAKE.cols + c;
        wake.DX[i] = c < WAKE.cols / 2 ? -1 : 0;
        wake.DY[i] = c < WAKE.cols / 2 ? 0 : 1;
      }
    }
    blurDirection(wake);
    let worst = 0;
    for (let r = 0; r < WAKE.rows; r++) {
      for (let c = 1; c < WAKE.cols; c++) {
        const i = r * WAKE.cols + c;
        worst = Math.max(worst, Math.hypot(wake.BX[i] - wake.BX[i - 1], wake.BY[i] - wake.BY[i - 1]));
      }
    }
    // The raw jump is sqrt(2); spread over 2 * dirBlur + 1 cells.
    expect(worst).toBeLessThan(Math.SQRT2 / (2 * WAKE.dirBlur + 1) + 1e-6);
  });
});
