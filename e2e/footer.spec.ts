import { siteContent } from "@/lib/content";
import { FOOTER as F } from "@/lib/footer/constants";
import { eggTotalMs } from "@/lib/footer/egg";
import { bandShare } from "@/lib/footer/geometry";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import {
  FOOTER,
  countFooterContexts,
  footerBoxes,
  footerContexts,
  parsePose,
  readWord,
  recordWord,
  toFooter,
  waitForField,
  waitForWord,
  watchFieldChunks,
} from "./support/footer";
import { shoot, type Box, type Image } from "./support/pixels";

// The footer (slice C6): the server's small lines and reserved band, the
// wordmark at rest and its egg, the field's chunk and its fallbacks.

const C = siteContent.footer;
const SHARE = bandShare(C.wordmark);
const LINES_ROW = 180; // the small lines' row from md: the footer lab's Connect row (pt-20 plus 100px)
const PERIOD = [...C.wordmark].indexOf(".");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Task 7: the shell ----

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("footer: the server reserves the word's band under the small lines", async ({ page }) => {
    await page.goto("/");
    const b = await footerBoxes(page);
    expect(b.band.height).toBeCloseTo(SHARE * b.width, 0);
    expect(b.lines.height).toBeCloseTo(LINES_ROW, 0);
    expect(b.height).toBeCloseTo(LINES_ROW + SHARE * b.width, 0);
    const footer = page.locator(FOOTER);
    await expect(footer.getByText(C.tagline(""), { exact: false })).toBeVisible();
    await expect(footer.getByText(C.copyright, { exact: true })).toBeVisible();
    await expect(footer.getByText(C.wordmark, { exact: true })).toBeAttached();
  });
});

test("footer: the word mounts into its band, so nothing below Connect moves", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const b = await footerBoxes(page);
  expect(b.band.height).toBeCloseTo(SHARE * b.width, 0);
  expect(b.height).toBeCloseTo(LINES_ROW + SHARE * b.width, 0);
  expect(b.lines.top).toBeCloseTo(0, 0);
});

test("footer: from its first layout to the word at rest, the footer never changes height", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __footerHeights: number[] };
    w.__footerHeights = [];
    const watch = () => {
      const footer = document.querySelector("footer[data-footer]");
      if (!footer) return false;
      new ResizeObserver((entries) => entries.forEach((e) => w.__footerHeights.push(e.borderBoxSize[0].blockSize))).observe(footer);
      return true;
    };
    if (!watch()) {
      const mo = new MutationObserver(() => watch() && mo.disconnect());
      mo.observe(document, { childList: true, subtree: true });
    }
  });
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const heights = await page.evaluate(() => (window as unknown as { __footerHeights: number[] }).__footerHeights);
  expect(heights.length).toBeGreaterThan(0);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.5);
});

// ---- Task 8: the wordmark ----

test("footer: at rest the word sits whole on its baseline inside the footer, the period button over the period", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const w = await readWord(page);
  expect(w.chars.join("")).toBe(C.wordmark);
  for (const t of w.transforms) {
    const p = parsePose(t);
    expect(p.y).toBeCloseTo(w.baseline, 1);
    expect(p.squash).toBe(1);
    expect(p.angle).toBe(0);
  }
  const rects = await page.evaluate(() => {
    const r = (el: Element) => el.getBoundingClientRect();
    return { footer: r(document.querySelector("footer[data-footer]")!), tint: r(document.querySelector("[data-footer-tint]")!), button: r(document.querySelector("[data-egg]")!) };
  });
  expect(rects.tint.left).toBeGreaterThanOrEqual(rects.footer.left);
  expect(rects.tint.right).toBeLessThanOrEqual(rects.footer.right);
  expect(rects.tint.bottom).toBeLessThanOrEqual(rects.footer.bottom);
  // The ink spans the word's 92 percent less its first and last letters' outer gaps.
  expect(rects.tint.width / rects.footer.width).toBeGreaterThan(0.9);
  expect(rects.tint.width / rects.footer.width).toBeLessThanOrEqual(F.fitShare);
  const period = parsePose(w.transforms[PERIOD]);
  expect(rects.button.left + rects.button.width / 2 - rects.footer.left).toBeCloseTo(period.x, 0);
  expect(rects.button.width).toBeGreaterThanOrEqual(F.hitPx.min);
  // The footer clips its overflow: the button and its focus ring end inside it.
  expect(rects.button.bottom + F.hitPx.ring).toBeLessThanOrEqual(rects.footer.bottom);
  await expect(page.getByRole("button", { name: C.dropPeriod })).toBeVisible();
  await expect(page.locator("svg[data-wordmark]")).toHaveAttribute("aria-hidden", "true");
  // Seen once: away and back, the word does not rise again.
  await scrollToY(page, 0);
  await toFooter(page);
  await nextFrames(page, 5);
  expect((await readWord(page)).transforms).toEqual(w.transforms);
});

test("footer: the letters swell toward the pointer and spring back after a press", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const before = await readWord(page);
  const l = parsePose(before.transforms[3]);
  const box = (await page.locator(FOOTER).boundingBox())!;
  await page.mouse.move(box.x + l.x, box.y + before.baseline - before.size / 2);
  await sleep(600);
  const swelled = await page.evaluate(() => document.querySelectorAll<SVGPathElement>("svg[data-wordmark] defs path")[3].getAttribute("d"));
  await page.mouse.down();
  const pressed = recordWord(page, 400);
  const frames = await pressed;
  await page.mouse.up();
  expect(Math.min(...frames.map((f) => parsePose(f[3]).squash))).toBeLessThan(0.8);
  await page.mouse.move(2, 2);
  await waitForWord(page);
  const after = await readWord(page);
  expect(after.transforms).toEqual(before.transforms);
  expect(swelled).not.toBe(await page.evaluate(() => document.querySelectorAll<SVGPathElement>("svg[data-wordmark] defs path")[3].getAttribute("d")));
});

test("footer: the period drops, hops a quarter turn, lands, and the ripple runs through the letters", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const rest = await readWord(page);
  const recording = recordWord(page, eggTotalMs(F.egg) + 900);
  await page.getByRole("button", { name: C.dropPeriod }).click();
  const frames = await recording;
  await page.mouse.move(2, 2); // off the button: the letters near it swell while it hovers
  const period = frames.map((f) => parsePose(f[PERIOD]));
  expect(Math.min(...period.map((p) => p.y)), "the hop's apex").toBeLessThan(rest.baseline - 0.3 * rest.size);
  expect(period.some((p) => p.angle > 30 && p.angle < 60), "half turned in the air").toBe(true);
  expect(Math.max(...period.map((p) => p.angle)), "past the turn on landing").toBeGreaterThan(F.egg.turnDeg);
  for (const i of [PERIOD - 1, PERIOD + 1]) expect(Math.min(...frames.map((f) => parsePose(f[i]).squash)), `letter ${i} dips`).toBeLessThan(0.97);
  await waitForWord(page);
  expect((await readWord(page)).transforms).toEqual(rest.transforms);
});

test("footer: Enter and Space drop the period; five quick clicks make two hops", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const { baseline, size } = await readWord(page);
  const lifted = (frames: string[][]) => {
    let hops = 0;
    let up = false;
    for (const f of frames) {
      const high = parsePose(f[PERIOD]).y < baseline - 0.2 * size;
      if (high && !up) hops++;
      up = high;
    }
    return hops;
  };
  const button = page.getByRole("button", { name: C.dropPeriod });
  await button.focus();
  for (const key of ["Enter", "Space"]) {
    const rec = recordWord(page, eggTotalMs(F.egg) + 200);
    await page.keyboard.press(key);
    expect(lifted(await rec), key).toBe(1);
    await waitForWord(page);
  }
  const rec = recordWord(page, 2 * eggTotalMs(F.egg) + 600);
  for (let i = 0; i < 5; i++) await button.click({ delay: 10 });
  expect(lifted(await rec)).toBe(2);
});

test("footer: a resize mid-hop lands the word at rest at the new size", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  await page.getByRole("button", { name: C.dropPeriod }).click();
  await page.mouse.move(2, 2);
  await sleep(300);
  await page.setViewportSize({ width: 1024, height: 768 });
  await toFooter(page);
  await waitForWord(page);
  const w = await readWord(page);
  const footer = (await page.locator(FOOTER).boundingBox())!;
  expect(w.size).toBeCloseTo(footer.width * (SHARE / 1.4), 0);
  for (const t of w.transforms) {
    const p = parsePose(t);
    expect(p.y).toBeCloseTo(w.baseline, 1);
    expect(p.squash).toBe(1);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(footer.width);
  }
});

// ---- Task 9: the field ----

function paperDistance(image: Image, paper: [number, number, number]) {
  let sum = 0;
  for (let i = 0; i < image.rgba.length; i += 4) {
    sum += Math.abs(image.rgba[i] - paper[0]) + Math.abs(image.rgba[i + 1] - paper[1]) + Math.abs(image.rgba[i + 2] - paper[2]);
  }
  return sum / (image.rgba.length / 4);
}

async function paperRgb(page: import("@playwright/test").Page): Promise<[number, number, number]> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-background)";
    document.body.append(probe);
    const rgb = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
    probe.remove();
    return rgb;
  });
}

// Boxes in page px: inside the l's stem, in the gap after it (paper), and in the field's hold above the word.
async function probes(page: import("@playwright/test").Page): Promise<{ stem: Box; gap: Box; above: Box }> {
  const w = await readWord(page);
  const footer = (await page.locator(FOOTER).boundingBox())!;
  const l = parsePose(w.transforms[3]);
  const d = parsePose(w.transforms[4]);
  const stemHalf = (F.face.stem * w.size) / 2;
  const top = footer.y + w.baseline - 0.8 * w.size;
  const gapX = (l.x + stemHalf + d.x - (2 * F.face.stem * w.size + 0.25 * w.size) / 2) / 2;
  return {
    stem: { x: Math.round(footer.x + l.x - 2), y: Math.round(top), width: 4, height: Math.round(0.6 * w.size) },
    gap: { x: Math.round(footer.x + gapX - 1), y: Math.round(top), width: 2, height: Math.round(0.6 * w.size) },
    above: { x: Math.round(footer.x + 0.2 * footer.width), y: Math.round(footer.y + 40), width: 40, height: 20 },
  };
}

test("footer: the hero's field ends in the word: the letters are windows onto it, the gaps paper", async ({ page }) => {
  await page.addInitScript(countFooterContexts);
  await openHome(page);
  await toFooter(page);
  await waitForField(page, "gl");
  await waitForWord(page);
  await page.mouse.move(2, 2);
  const paper = await paperRgb(page);
  const p = await probes(page);
  expect(paperDistance(await shoot(page, p.stem), paper), "inside the l").toBeGreaterThan(20);
  expect(paperDistance(await shoot(page, p.gap), paper), "between the l and the d").toBeLessThan(4);
  expect(paperDistance(await shoot(page, p.above), paper), "the field over the word").toBeGreaterThan(4);
  expect(await footerContexts(page)).toBe(1);
  await expect(page.locator("footer canvas[data-footer-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-footer-field]")).toHaveAttribute("aria-hidden", "true");
});

test("footer: the field's chunk loads only near the footer, once, without three", async ({ page }) => {
  await page.addInitScript(countFooterContexts);
  const scripts = watchFieldChunks(page);
  await openHome(page);
  await page.waitForLoadState("networkidle");
  expect(await scripts.fieldChunks(), "at the top of the page").toEqual([]);
  await toFooter(page);
  await waitForField(page, "gl");
  await scrollToY(page, 0);
  await toFooter(page);
  await nextFrames(page, 10);
  const chunks = await scripts.fieldChunks();
  expect(chunks).toHaveLength(1);
  expect(chunks[0].three, "three in the footer's chunk").toBe(false);
  expect(await footerContexts(page)).toBe(1);
});

test("footer: a theme switch recolors the live field without a new context", async ({ page }) => {
  await page.addInitScript(countFooterContexts);
  await openHome(page);
  await toFooter(page);
  await waitForField(page, "gl");
  const { above } = await probes(page);
  const light = await shoot(page, above);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await nextFrames(page, 4);
  const dark = await shoot(page, above);
  expect(paperDistance(dark, [light.rgba[0], light.rgba[1], light.rgba[2]])).toBeGreaterThan(40);
  expect(await footerContexts(page)).toBe(1);
});

// A new canvas size clears the drawing buffer, opaque black with no alpha. An observer made after
// the field's own runs right after it, in the same task: what the buffer holds there is what that
// frame paints. Read in light, where the field above the word is far from black.
test("footer: a resize redraws the live field before the paint, never a cleared buffer", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForField(page, "gl");
  const resized = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const canvas = document.querySelector<HTMLCanvasElement>("footer canvas[data-footer-canvas]")!;
        let start: number | null = null;
        const ro = new ResizeObserver(([entry]) => {
          const width = entry.contentRect.width;
          if (start === null) start = width;
          if (width === start) return;
          ro.disconnect();
          const gl = canvas.getContext("webgl2")!;
          const dpr = gl.drawingBufferWidth / width;
          const px = new Uint8Array(4 * 8 * 8);
          gl.readPixels(Math.round(0.2 * gl.drawingBufferWidth), gl.drawingBufferHeight - Math.round(40 * dpr) - 8, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
          resolve([...px]);
        });
        ro.observe(canvas);
      }),
  );
  await nextFrames(page, 3);
  await page.setViewportSize({ width: 1200, height: 900 });
  const px = await resized;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
  test.info().annotations.push({ type: "resize", description: `mean channel sum ${(sum / (px.length / 4)).toFixed(1)}` });
  expect(sum / (px.length / 4), "the field above the word in the resized frame").toBeGreaterThan(150);
});

test("footer: switching reduced motion on swaps the live field for the still poster, and back", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForField(page, "gl");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await waitForField(page, "poster");
  await expect(page.locator("footer canvas[data-footer-canvas]")).toHaveCount(0);
  await expect(page.locator("[data-footer-poster]")).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await waitForField(page, "gl");
  await expect(page.locator("footer canvas[data-footer-canvas]")).toHaveCount(1);
});

for (const theme of ["light", "dark"] as const) {
  test(`footer: the small lines meet 4.5:1 over the field in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await openHome(page);
    await toFooter(page);
    await waitForField(page, "gl");
    await waitForWord(page);
    const lines = page.locator("[data-footer-lines] p");
    const ink = await lines.first().evaluate((el) => (getComputedStyle(el).color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number));
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    await page.addStyleTag({ content: "[data-footer-lines] p { color: transparent !important; }" });
    await nextFrames(page, 2);
    for (let i = 0; i < (await lines.count()); i++) {
      const box = (await lines.nth(i).boundingBox())!;
      const image = await shoot(page, { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) });
      let worst = Infinity;
      for (let k = 0; k < image.rgba.length; k += 4) {
        const [hi, lo] = [lum(ink), lum([image.rgba[k], image.rgba[k + 1], image.rgba[k + 2]])].sort((a, b) => b - a);
        worst = Math.min(worst, (hi + 0.05) / (lo + 0.05));
      }
      test.info().annotations.push({ type: "contrast", description: `${theme} line ${i}: ${worst.toFixed(2)}` });
      expect(worst, `line ${i}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("footer: the still poster, no chunk, the word at rest at once, and the period only turns", async ({ page }) => {
    const scripts = watchFieldChunks(page);
    await page.goto("/");
    await settled(page);
    const arriving = recordWord(page, 400);
    await toFooter(page);
    const early = await arriving;
    await waitForWord(page);
    const rest = await readWord(page);
    // No rise: from the first frame the footer is in view, every letter is on its baseline.
    for (const f of early) for (const t of f) expect(parsePose(t).y).toBeCloseTo(rest.baseline, 1);
    await expect(page.locator("[data-footer-field]")).toHaveAttribute("data-footer-field", "poster");
    await expect(page.locator("[data-footer-poster]")).toHaveCSS("animation-play-state", "paused");
    const rec = recordWord(page, 600);
    await page.getByRole("button", { name: C.dropPeriod }).click();
    const frames = await rec;
    const side = F.face.stem * rest.size;
    const period = frames.map((f) => parsePose(f[PERIOD]));
    expect(period.some((p) => p.angle > 30)).toBe(true);
    expect(Math.min(...period.map((p) => p.y)), "no hop, only the turned square's corner").toBeGreaterThanOrEqual(rest.baseline - side * 0.21 - 0.5);
    for (const f of frames) for (let i = 0; i < f.length; i++) if (i !== PERIOD) expect(parsePose(f[i]).squash).toBe(1);
    expect(await scripts.fieldChunks()).toEqual([]);
  });
});
