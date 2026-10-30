import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { decodePng, type Image } from "./support/pixels";

// The loader's landing, frame by frame (Aaron's recording, 2026-10-30: "hi, i'm
// Aaron" jumped 1 to 2 px in the frame it came to rest, the loader's DOM
// lockup giving way to the name's canvas). The page runs on Playwright's clock,
// so its frames (rAF, GSAP's ticker, the canvas's loop) step one 60 fps frame
// at a time, and each frame is a screenshot of the name's crop at the screen's
// own pixels. The name's drawn geometry, the greeting's ink and the name's
// each slid onto the frame before, may not step by more than half a px from
// the last frames of the travel through the handoff and on into the rest (the
// fill's own sheen, growing in over the letters after the handoff, is not a
// step), and the handoff frame draws the same ink as the frame before it.

const FRAME = 1000 / 60;
const STEP_PX = 0.5;

type Row = { i: number; state: string | null; frame: Frame };

// How far one frame's ink sits from another's, per part, in CSS px: the ink is
// how far each pixel is from the page as a share of the ink's own level
// nearby (so the fill's sheen inside the letters is not a move), both frames
// are blurred alike (so a softer raster is not a move either), and the second
// is slid onto the first (Lucas-Kanade, translation only). Pixels are a frame's
// own (device px); `split` is the row between the greeting and the name.
type Plane = { w: number; h: number; v: Float64Array };

function coverage(img: Image, y0: number, y1: number): Plane {
  const w = img.width;
  const h = y1 - y0;
  const lum = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return 0.2126 * img.rgba[i] + 0.7152 * img.rgba[i + 1] + 0.0722 * img.rgba[i + 2];
  };
  const corners = [lum(0, 0), lum(w - 1, 0), lum(0, img.height - 1), lum(w - 1, img.height - 1)].sort((a, b) => a - b);
  const bg = (corners[1] + corners[2]) / 2;
  const d = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = Math.abs(lum(x, y + y0) - bg);
  // The ink's level nearby: the most within 4 px (a 9 by 9 max, rows then columns).
  const across = new Float64Array(w * h);
  const level = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, x - 4); k <= Math.min(w - 1, x + 4); k++) m = Math.max(m, d[y * w + k]);
    across[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, y - 4); k <= Math.min(h - 1, y + 4); k++) m = Math.max(m, across[k * w + x]);
    level[y * w + x] = m;
  }
  const v = new Float64Array(w * h);
  for (let i = 0; i < v.length; i++) v[i] = level[i] > 12 ? Math.min(1, d[i] / level[i]) : 0;
  return { w, h, v };
}

function blur({ w, h, v }: Plane, sigma: number): Plane {
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  const pass = (src: Float64Array, dx: number, dy: number) => {
    const out = new Float64Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const xx = Math.min(w - 1, Math.max(0, x + i * dx));
        const yy = Math.min(h - 1, Math.max(0, y + i * dy));
        acc += k[i + r] * src[yy * w + xx];
      }
      out[y * w + x] = acc / sum;
    }
    return out;
  };
  return { w, h, v: pass(pass(v, 1, 0), 0, 1) };
}

// How far b's ink sits right of and below a's (device px).
function slide(a: Plane, b: Plane): { dx: number; dy: number } {
  const { w, h } = a;
  const at = (p: Plane, x: number, y: number) => {
    const cx = Math.min(w - 1, Math.max(0, x));
    const cy = Math.min(h - 1, Math.max(0, y));
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const fx = cx - x0;
    const fy = cy - y0;
    return (p.v[y0 * w + x0] * (1 - fx) + p.v[y0 * w + x1] * fx) * (1 - fy) + (p.v[y1 * w + x0] * (1 - fx) + p.v[y1 * w + x1] * fx) * fy;
  };
  let dx = 0;
  let dy = 0;
  for (let n = 0; n < 8; n++) {
    let gxx = 0;
    let gxy = 0;
    let gyy = 0;
    let rx = 0;
    let ry = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const bs = at(b, x + dx, y + dy);
      const gx = (at(b, x + 1 + dx, y + dy) - at(b, x - 1 + dx, y + dy)) / 2;
      const gy = (at(b, x + dx, y + 1 + dy) - at(b, x + dx, y - 1 + dy)) / 2;
      const e = a.v[y * w + x] - bs;
      gxx += gx * gx;
      gxy += gx * gy;
      gyy += gy * gy;
      rx += gx * e;
      ry += gy * e;
    }
    const det = gxx * gyy - gxy * gxy;
    if (!(Math.abs(det) > 1e-9)) break;
    const sx = (gyy * rx - gxy * ry) / det;
    const sy = (gxx * ry - gxy * rx) / det;
    dx += sx;
    dy += sy;
    if (Math.abs(sx) < 1e-3 && Math.abs(sy) < 1e-3) break;
  }
  return { dx, dy };
}

type Frame = { greet: Plane; name: Plane; ink: { greet: number; name: number } };

function framePlanes(img: Image, dpr: number, split: number): Frame {
  const row = Math.round(split * dpr);
  const greet = coverage(img, 0, row);
  const name = coverage(img, row, img.height);
  const ink = (p: Plane) => p.v.reduce((a, b) => a + b, 0) / dpr / dpr;
  return { greet: blur(greet, 1.2 * dpr), name: blur(name, 1.2 * dpr), ink: { greet: ink(greet), name: ink(name) } };
}

async function stepLanding(page: Page): Promise<{ rows: Row[]; handoff: number }> {
  const t0 = Date.parse("2026-10-30T12:00:00Z");
  await page.clock.install({ time: t0 });
  await page.clock.pauseAt(t0 + 1);
  await page.goto("/?coildebug=1", { waitUntil: "commit" });
  const loader = () => page.evaluate(() => document.documentElement.dataset.introLoader ?? null).catch(() => null);
  // Up to the shrink: the network and the face load in real time, the page's clock a frame at a time.
  for (let i = 0; i < 1500 && (await loader()) !== "shrink"; i++) {
    await page.clock.runFor(FRAME);
    await page.waitForTimeout(8);
  }
  expect(await loader(), "the loader's shrink began").toBe("shrink");
  // The crop: the heading (where the name lands) and a margin; the split: just above the name's cap top.
  const at = await page.evaluate(() => {
    const h1 = document.getElementById("intro-heading")!.getBoundingClientRect();
    const line = document.querySelector("#intro-heading [data-lockup-name]")!;
    const size = parseFloat(getComputedStyle(line).fontSize);
    const capTop = line.getBoundingClientRect().top + (0.75 - 0.63636) * size;
    return { left: h1.left, top: h1.top, width: h1.width, height: h1.height, capTop, dpr: window.devicePixelRatio };
  });
  const clip = { x: Math.floor(at.left - 24), y: Math.floor(at.top - 16), width: Math.ceil(at.width + 48), height: Math.ceil(at.height + 32) };
  const split = at.capTop - 3 - clip.y;
  const rows: Row[] = [];
  let handoff = -1;
  // QA: E2E_LANDING_DUMP=<dir> keeps every frame's crop.
  if (process.env.E2E_LANDING_DUMP) mkdirSync(process.env.E2E_LANDING_DUMP, { recursive: true });
  for (let i = 0; i < 150; i++) {
    const png = await page.screenshot({ clip });
    if (process.env.E2E_LANDING_DUMP) writeFileSync(join(process.env.E2E_LANDING_DUMP, `f${String(i).padStart(3, "0")}.png`), png);
    const shot = decodePng(png);
    const state = await loader();
    rows.push({ i, state, frame: framePlanes(shot, at.dpr, split) });
    if (state === "done" && handoff < 0) handoff = i;
    if (handoff >= 0 && i >= handoff + 8) break;
    await page.clock.runFor(FRAME);
    await page.waitForTimeout(15);
  }
  return { rows, handoff };
}

for (const { width, height, dpr, colorScheme } of [
  { width: 1280, height: 800, dpr: 2, colorScheme: "dark" as const },
  { width: 1440, height: 900, dpr: 1, colorScheme: "light" as const },
]) {
  test.describe(`${width} by ${height} at ${dpr}x, ${colorScheme}`, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor: dpr, colorScheme });

    test("landing: the name comes to rest without a step: the travel's last frames, the handoff to the canvas and the rest move it by no more than half a px, and the handoff draws the same ink", async ({ page }) => {
      test.setTimeout(150_000);
      const { rows, handoff } = await stepLanding(page);
      expect(handoff, "the loader handed the name over").toBeGreaterThan(3);
      // The handoff went to the canvas name.
      expect(await page.evaluate(() => (window as unknown as { __nameCanvas: { stats: () => { landed: boolean } } }).__nameCanvas.stats().landed)).toBe(true);
      const steps: string[] = [];
      for (let i = handoff - 3; i <= Math.min(rows.length - 1, handoff + 8); i++) {
        const a = rows[i - 1].frame;
        const b = rows[i].frame;
        for (const key of ["greet", "name"] as const) {
          const { dx, dy } = slide(a[key], b[key]);
          const [x, y] = [dx / dpr, dy / dpr];
          steps.push(`${i === handoff ? "handoff " : ""}f${i} ${key} ${x.toFixed(2)},${y.toFixed(2)}`);
          expect.soft(Math.abs(x), `${key} x step into frame ${i} (handoff ${handoff})`).toBeLessThanOrEqual(STEP_PX);
          expect.soft(Math.abs(y), `${key} y step into frame ${i} (handoff ${handoff})`).toBeLessThanOrEqual(STEP_PX);
        }
      }
      // The same rendering: the canvas's first frame draws the loader's last frame's ink.
      for (const key of ["greet", "name"] as const) {
        const before = rows[handoff - 1].frame.ink[key];
        const after = rows[handoff].frame.ink[key];
        expect.soft(Math.abs(after - before) / before, `${key}'s ink across the handoff (${before.toFixed(0)} to ${after.toFixed(0)})`).toBeLessThan(0.015);
      }
      test.info().annotations.push({ type: "steps", description: steps.join("; ") });
    });
  });
}
