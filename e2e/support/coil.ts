import type { Page } from "@playwright/test";
import type { HookWindow, SlotInfo } from "./hooks";

// Loading the home and reading the scene through its QA hooks. Every wait is
// on the page's own state (readiness, the entrance clock, the scene's first
// frame), never on a fixed time.

export type Point = { x: number; y: number };

// `debug` is the ?coildebug value: "1" for the scene and loader hooks,
// "flight" adds the flight probe (and still exposes window.__coil).
export async function openHome(page: Page, { debug = "1", path = "/" }: { debug?: string; path?: string } = {}) {
  const separator = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${separator}coildebug=${debug}`);
  await waitForCoil(page);
}

// The hero is interactive: readiness "ready", the entrance clock has ended,
// the scene draws (data-scene="on") and the body scroll lock is gone.
export async function waitForCoil(page: Page) {
  await page.waitForFunction(
    () => {
      const w = window as HookWindow;
      const hero = document.querySelector<HTMLElement>("section[data-scene]");
      return (
        !!w.__coil?.api &&
        document.documentElement.dataset.home === "ready" &&
        hero?.dataset.scene === "on" &&
        w.__coil.entrance().ended &&
        document.body.style.overflow !== "hidden"
      );
    },
    null,
    { timeout: 30_000 },
  );
}

export async function scrollToY(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForFunction((top) => Math.abs(window.scrollY - top) < 1, y);
  // Two frames, so the scene has drawn (and measured its silhouette) at the new position.
  await nextFrames(page, 2);
}

export async function nextFrames(page: Page, count = 1) {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    count,
  );
}

// Page scroll turns the coil through one smoothing stage, so a jump in scroll
// keeps it moving for a moment: waits until it is back to its idle pace
// (under `perFrame` cards a frame for `frames` frames in a row).
export async function waitForCoilSettled(page: Page, perFrame = 0.003, frames = 10) {
  await page.evaluate(
    ({ perFrame, frames }) =>
      new Promise<void>((resolve) => {
        const coil = (window as HookWindow).__coil!;
        let last = coil.offset();
        let calm = 0;
        const tick = () => {
          const now = coil.offset();
          calm = Math.abs(now - last) < perFrame ? calm + 1 : 0;
          last = now;
          if (calm >= frames) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { perFrame, frames },
  );
}

export async function heroVisible(page: Page) {
  return page.evaluate(() => {
    const rect = document.querySelector("section[data-scene]")!.getBoundingClientRect();
    const visible = Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top);
    return Math.min(1, Math.max(0, visible / rect.height));
  });
}

// Signed distance of a viewport point from the helix hull's axis, less the
// hull's half width: negative inside the silhouette, positive outside.
export async function silhouetteDistance(page: Page, point: Point) {
  return page.evaluate(({ x, y }) => {
    const w = window as HookWindow;
    const sil = w.__coil!.silhouette()!;
    const rect = document.querySelector("section[data-scene]")!.getBoundingClientRect();
    const lx = x - rect.left;
    const ly = y - rect.top;
    return Math.abs((lx - sil.ax) * -sil.dy + (ly - sil.ay) * sil.dx) - sil.half;
  }, point);
}

export type CoilPoints = {
  // A card near the hero's middle, well inside the silhouette.
  card: Point;
  // No card under it, in the narrow seam between two cards adjacent on the
  // strand: each side, 10px off, is one of them.
  seam: Point | null;
  // Empty background inside the silhouette (between turns of the helix): no
  // card within BACKGROUND_CLEAR_PX of it.
  background: Point | null;
  // Inside the hero, well outside the silhouette.
  outside: Point;
};

// Far beyond the seam margin, so a background point stays background while
// the coil drifts for the length of a test.
export const BACKGROUND_CLEAR_PX = 60;

// Sampled from the scene's own picking and hull at this moment.
export async function coilPoints(page: Page): Promise<CoilPoints> {
  return page.evaluate((clearPx) => {
    const w = window as HookWindow;
    const coil = w.__coil!;
    // Builds before the ownership rule had no hull: cards only, then.
    const sil = coil.silhouette?.() ?? null;
    const slotCount = Number(coil.budget().slots);
    const rect = document.querySelector("section[data-scene]")!.getBoundingClientRect();
    const top = Math.max(rect.top, 0) + 80;
    const bottom = Math.min(rect.bottom, window.innerHeight) - 40;
    const distance = (x: number, y: number) =>
      sil ? Math.abs((x - rect.left - sil.ax) * -sil.dy + (y - rect.top - sil.ay) * sil.dx) - sil.half : Number.NaN;
    const middle = { x: rect.left + rect.width / 2, y: (top + bottom) / 2 };
    const near = (p: { x: number; y: number }) => Math.hypot(p.x - middle.x, p.y - middle.y);
    const cards: { x: number; y: number }[] = [];
    const gaps: { x: number; y: number }[] = [];
    const outside: { x: number; y: number }[] = [];
    for (let y = top; y < bottom; y += 10) {
      for (let x = 100; x < window.innerWidth - 100; x += 10) {
        const d = distance(x, y);
        const hit = coil.api.cardAt(x, y);
        // A card point with cards all around it (it stays a card for a while).
        if (hit && !(d >= -120) && [[-24, 0], [24, 0], [0, -24], [0, 24]].every(([dx, dy]) => coil.api.cardAt(x + dx, y + dy)?.slot === hit.slot))
          cards.push({ x, y });
        else if (!hit && d < -40) gaps.push({ x, y });
        else if (!hit && d > 80) outside.push({ x, y });
      }
    }
    cards.sort((a, b) => near(a) - near(b));
    gaps.sort((a, b) => near(a) - near(b));
    outside.sort((a, b) => near(a) - near(b));
    const directions = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);
    const adjacent = (a: number, b: number) => Math.abs(a - b) === 1 || Math.abs(a - b) === slotCount - 1;
    const inSeam = ({ x, y }: { x: number; y: number }) =>
      directions.slice(0, 8).some(([ux, uy]) => {
        const a = coil.api.cardAt(x + ux * 10, y + uy * 10);
        const b = coil.api.cardAt(x - ux * 10, y - uy * 10);
        return !!a && !!b && adjacent(a.slot, b.slot);
      });
    const clear = ({ x, y }: { x: number; y: number }) =>
      [0.25, 0.5, 0.75, 1].every((f) => directions.every(([ux, uy]) => !coil.api.cardAt(x + ux * clearPx * f, y + uy * clearPx * f)));
    return { card: cards[0], seam: gaps.find(inSeam) ?? null, background: gaps.find(clear) ?? null, outside: outside[0] };
  }, BACKGROUND_CLEAR_PX);
}

// The card the scene picks at a viewport point, or null.
export async function cardAt(page: Page, point: Point) {
  return page.evaluate(({ x, y }) => (window as HookWindow).__coil!.api.cardAt(x, y), point);
}

// The capture probe at a viewport point (null on builds without it).
export async function captureAt(page: Page, point: Point) {
  return page.evaluate(({ x, y }) => (window as HookWindow).__coil!.captureAt?.(x, y) ?? null, point);
}

// The stretch envelope has relaxed (a page scroll feeds the coil, which
// stretches the helix for a moment).
export async function waitForEnvelopeRest(page: Page, below = 0.005) {
  await page.waitForFunction((limit) => {
    const envelope = (window as HookWindow).__coil!.envelope;
    return envelope.length > 0 && envelope[envelope.length - 1] < limit;
  }, below);
}

// The on-screen slots (alpha over a half) with their projected geometry; needs ?coildebug=flight.
export async function visibleSlots(page: Page): Promise<SlotInfo[]> {
  return page.evaluate(() => (window as HookWindow).__coilFlight!.scene.slots());
}

export async function offset(page: Page) {
  return page.evaluate(() => (window as HookWindow).__coil!.offset());
}

export async function owner(page: Page) {
  return page.evaluate(() => (window as HookWindow).__coil!.owner());
}

// Waits until no wheel gesture is live (the gesture gap has passed).
export async function waitForGestureEnd(page: Page) {
  await page.waitForFunction(() => (window as HookWindow).__coil!.owner() === "none");
}
