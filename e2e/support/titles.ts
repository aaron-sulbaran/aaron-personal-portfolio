import type { Page } from "@playwright/test";
import { relativeLuminance, titleContrast, type TitleContrast } from "@/lib/coil/letterContrast";
import { decodePng, type Image } from "./pixels";

// The numbered pages' titles in page 1's name's fill (components/sections/
// TitleFill.tsx): their state, the fill's QA hooks (?coildebug: the wrapper
// carries its runtime) and their contrast against what is behind them.

export const TITLE_KEYS = ["work", "numbers", "connect"] as const;
export type TitleKey = (typeof TITLE_KEYS)[number];

export async function titleState(page: Page, key: string) {
  return page.evaluate((k) => [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((el) => el.getClientRects().length)?.getAttribute("data-title-fill") ?? null, key);
}

// Brings the title to the middle of the viewport and waits for its fill to draw.
export async function showTitle(page: Page, key: string, state = "on") {
  await page.evaluate((k) => {
    const el = [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length)!;
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY - (window.innerHeight - r.height) / 2, behavior: "instant" });
  }, key);
  await page.waitForFunction(
    ([k, s]) => [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((el) => el.getClientRects().length)?.getAttribute("data-title-fill") === s,
    [key, state] as const,
    { timeout: 15_000 },
  );
}

export type FillStats = { frames: number; running: boolean; paused: boolean; surfaceIn: number; size: [number, number] };

export async function titleStats(page: Page, key: string): Promise<FillStats | null> {
  return page.evaluate((k) => {
    const el = [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length) as (Element & { __titleFill?: { runtime: () => { stats: () => FillStats } | null } }) | undefined;
    return el?.__titleFill?.runtime()?.stats() ?? null;
  }, key);
}

type Clip = { x: number; y: number; width: number; height: number };

// The title's mask on a clip around it (viewport px at 1x): its coverage and
// its glyphs' boxes, as the fill laid them out from the DOM.
async function maskOn(page: Page, key: string) {
  return page.evaluate((k) => {
    type Mask = { canvas: HTMLCanvasElement; rect: { x: number; y: number; w: number; h: number }; layout: { glyphs: { x0: number; x1: number; y0: number; y1: number }[] }; origin: { left: number; top: number } };
    const el = [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length) as (Element & { __titleFill?: { runtime: () => { mask: () => Mask | null } | null } }) | undefined;
    const mask = el?.__titleFill?.runtime()?.mask();
    if (!mask) return null;
    const pad = 40;
    const x = Math.max(0, Math.floor(mask.rect.x - pad));
    const y = Math.max(0, Math.floor(mask.rect.y - pad));
    const clip = { x, y, width: Math.min(window.innerWidth, Math.ceil(mask.rect.x + mask.rect.w + pad)) - x, height: Math.min(window.innerHeight, Math.ceil(mask.rect.y + mask.rect.h + pad)) - y };
    const canvas = document.createElement("canvas");
    canvas.width = clip.width;
    canvas.height = clip.height;
    const g = canvas.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(mask.canvas, mask.rect.x - x, mask.rect.y - y, mask.rect.w, mask.rect.h);
    const alpha = g.getImageData(0, 0, clip.width, clip.height).data;
    const cover: number[] = [];
    for (let i = 3; i < alpha.length; i += 4) cover.push(alpha[i] / 255);
    const glyphs = mask.layout.glyphs.map((gl) => ({ x0: gl.x0 + mask.origin.left - x, x1: gl.x1 + mask.origin.left - x, y0: gl.y0 + mask.origin.top - y, y1: gl.y1 + mask.origin.top - y }));
    return { clip, cover, glyphs, fontPx: parseFloat(getComputedStyle(el!.firstElementChild!).fontSize) };
  }, key);
}

const luminanceOf = (image: Image) => {
  const out = new Float32Array(image.width * image.height);
  for (let i = 0; i < out.length; i++) out[i] = relativeLuminance(image.rgba[i * 4], image.rgba[i * 4 + 1], image.rgba[i * 4 + 2]);
  return out;
};

const shot = async (page: Page, clip: Clip) => decodePng(await page.screenshot({ clip, scale: "css", caret: "initial" }));

// The title's contrast against its backdrop (lib/coil/letterContrast.ts
// titleContrast): the letters as the page shows them, the backdrop with the
// title and its page's number hidden.
export async function titleContrastNow(page: Page, key: string): Promise<TitleContrast & { clip: Clip } | null> {
  const mask = await maskOn(page, key);
  if (!mask) return null;
  const letters = await shot(page, mask.clip);
  await page.evaluate((k) => {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length)!;
    for (const hide of [el, ...el.parentElement!.querySelectorAll<HTMLElement>("[data-section-number]")]) hide.style.setProperty("visibility", "hidden", "important");
  }, key);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const behind = await shot(page, mask.clip);
  await page.evaluate((k) => {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length)!;
    for (const hide of [el, ...el.parentElement!.querySelectorAll<HTMLElement>("[data-section-number]")]) hide.style.removeProperty("visibility");
  }, key);
  const read = titleContrast({
    letters: luminanceOf(letters),
    behind: luminanceOf(behind),
    cover: Float32Array.from(mask.cover),
    width: letters.width,
    height: letters.height,
    glyphs: mask.glyphs,
    scale: 1,
    // The name's 2 px, but 1 for a title under 30 px (page 2's), whose strokes would have no core left.
    erode: mask.fontPx < 30 ? 1 : 2,
  });
  return { ...read, clip: mask.clip };
}

// How much the fill moved inside the letters between two frames `ms` apart: the mean change of a channel, 0 to 255.
export async function fillMotion(page: Page, key: string, ms = 700) {
  const mask = await maskOn(page, key);
  if (!mask) return null;
  const a = await shot(page, mask.clip);
  await page.waitForTimeout(ms);
  const b = await shot(page, mask.clip);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < mask.cover.length; i++) {
    if (mask.cover[i] < 0.98) continue;
    for (let c = 0; c < 3; c++) sum += Math.abs(a.rgba[i * 4 + c] - b.rgba[i * 4 + c]);
    count += 3;
  }
  return { mean: count ? sum / count : 0, pixels: count / 3 };
}
