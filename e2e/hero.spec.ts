import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { coilPoints, nextFrames, openHome, type Point } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { pointerTo } from "./support/input";
import { cardRegion, pixelDiff, shoot, type CardRegion } from "./support/pixels";

// The hero slice: the greeting drawn with the name in the canvas (no DOM
// control beside it any more), the name as a lit surface with the pointer's
// wake (the design review's verdict and Aaron's answers, 2026-09-30), and the
// first-visit hints ("Open me" on the cursor over a card until the first
// open, "Keep exploring" once after that card lands home).

async function clickAt(cdp: CDPSession, { x, y }: Point) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

const openMe = (page: Page) => page.locator('div[aria-hidden="true"] span', { hasText: "Open me" });
const opacity = (page: Page, selector: ReturnType<typeof openMe>) => selector.evaluate((el) => Number(getComputedStyle(el).opacity));
const keepExploring = (page: Page) => page.locator("section[data-scene] p[aria-hidden='true']", { hasText: "Keep exploring" });

// Hovers a card until the scene picks it; returns the point.
async function hoverCard(page: Page, cdp: CDPSession) {
  const { card } = await coilPoints(page);
  await pointerTo(cdp, { x: card.x - 20, y: card.y + 10 });
  await pointerTo(cdp, card);
  await page.waitForFunction(() => (window as HookWindow).__coil!.hovered() >= 0);
  return card;
}

// Click the hovered card, close its modal with one Escape, and wait for the landing.
async function openAndClose(page: Page, cdp: CDPSession, card: Point) {
  await clickAt(cdp, card);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-tile-slot]")).toBeVisible();
  await page.waitForTimeout(700); // the flight out (520ms) before the close, as a visitor looks
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
}

test("hero: the greeting is drawn with the name, and no DOM control sits beside it", async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole("button", { name: "Work and photos" })).toHaveCount(0);
  // The h1 stays for assistive tech but is visually hidden while the scene draws.
  const h1 = page.getByRole("heading", { level: 1, name: "Hi, I'm Aaron." });
  await expect(h1).toBeAttached();
  expect(await h1.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  const visibleGreeting = await page.evaluate(() =>
    [...document.querySelectorAll("section[data-scene] *")].some(
      (el) => el.children.length === 0 && el.textContent?.trim() === "Hi, I'm" && el.getBoundingClientRect().width > 1 && getComputedStyle(el).opacity !== "0",
    ),
  );
  expect(visibleGreeting, "a visible DOM greeting over the canvas").toBe(false);
});

test("hint: \"Open me\" shows over a card until the first open, \"Keep exploring\" once after it lands, never again", async ({ page, context, cdp }) => {
  await openHome(page);
  const card = await hoverCard(page, cdp);
  await expect.poll(() => opacity(page, openMe(page)), { message: "the Open me pill" }).toBe(1);

  await openAndClose(page, cdp, card);
  await expect(keepExploring(page)).toHaveCount(1);
  await expect.poll(() => keepExploring(page).evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  expect(await page.evaluate(() => localStorage.getItem("aaron-hint-opened"))).toBe("1");

  // Wait out the line, then a second card: no line, no pill.
  await expect.poll(() => keepExploring(page).evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 8000 }).toBe(0);
  await page.evaluate(() => {
    const line = [...document.querySelectorAll<HTMLElement>("section[data-scene] p[aria-hidden='true']")].find((el) => el.textContent === "Keep exploring")!;
    const seen: string[] = [];
    new MutationObserver(() => seen.push(line.style.opacity)).observe(line, { attributes: true, attributeFilter: ["style"] });
    Object.assign(window, { __e2eLine: seen });
  });
  const again = await hoverCard(page, cdp);
  expect(await opacity(page, openMe(page))).toBe(0);
  await openAndClose(page, cdp, again);
  await nextFrames(page, 30);
  expect(await page.evaluate(() => (window as unknown as { __e2eLine: string[] }).__e2eLine), "the line's opacity writes").not.toContain("1");

  // A new page in the same browser profile: the pill never returns.
  const next = await context.newPage();
  const nextCdp = await context.newCDPSession(next);
  await openHome(next);
  await hoverCard(next, nextCdp);
  await nextFrames(next, 20);
  expect(await opacity(next, openMe(next))).toBe(0);
});

test("hint: with storage blocked the page does not error and the pill still shows", async ({ page, cdp }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await openHome(page);
  await hoverCard(page, cdp);
  await expect.poll(() => opacity(page, openMe(page))).toBe(1);
  expect(errors).toEqual([]);
});

async function nameRegion(page: Page): Promise<CardRegion> {
  await page.waitForFunction(() => !!(window as HookWindow).__coil?.api.nameRect());
  const name = (await page.evaluate(() => (window as HookWindow).__coil!.api.nameRect()))!;
  const outline = [
    { x: name.left, y: name.gradient.top },
    { x: name.left + name.width, y: name.gradient.top },
    { x: name.left + name.width, y: name.gradient.top + name.gradient.height },
    { x: name.left, y: name.gradient.top + name.gradient.height },
  ];
  return cardRegion(outline, page.viewportSize()!, 0);
}

async function hideCursor(page: Page) {
  await page.addStyleTag({ content: ".z-\\[100\\]{visibility:hidden!important}" });
}

// ---- the name: a lit surface and the pointer's wake ----
// Lightness is OKLab L, read back by the scene's own probe (the composite
// without the cards, window.__coil.nameProbe); every case holds the surface's
// clock (at=4), so what changes inside the letters is the wake alone.

const away = { x: 6, y: 894 };

// A pointer path on its own clock through DevTools input: one move every 8ms
// along a straight line, fired without waiting on each other, as a device does.
async function sweep(cdp: CDPSession, from: Point, to: Point, ms: number) {
  const start = performance.now();
  const sent: Promise<unknown>[] = [];
  for (;;) {
    const u = Math.min(1, (performance.now() - start) / ms);
    sent.push(pointerTo(cdp, { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }));
    if (u >= 1) break;
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
  await Promise.all(sent);
}

// The largest mean |dL| inside the letters against the "rest" snapshot over
// `ms`, sampled every 120ms.
async function peakChange(page: Page, ms: number) {
  return page.evaluate(async (ms) => {
    const probe = (window as HookWindow).__coil!.nameProbe;
    let peak = 0;
    const start = performance.now();
    for (let k = 0; performance.now() - start < ms; k++) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      probe.snap(`s${k}`);
      peak = Math.max(peak, probe.delta("rest", `s${k}`)!.mean);
      probe.drop(`s${k}`);
    }
    return peak;
  }, ms);
}

async function contrast(page: Page) {
  const read = await page.evaluate(() => (window as HookWindow).__coil!.nameProbe.contrast());
  expect(read, "the name's contrast readout").not.toBeNull();
  return read!;
}

test("name: the lit surface renders inside the letters, and the greeting sits in the same mask at 0.18 of the cap height", async ({ page }) => {
  await openHome(page, { debug: "nocards,at=4" });
  const fx = await page.evaluate(() => (window as HookWindow).__coil!.nameFx());
  expect(fx.surfIn, "the surface grown in").toBe(1);
  expect(fx.surf[0], "surface target width").toBeGreaterThan(100);
  expect(fx.greetingInMask, "the greeting inside the name's mask").toBe(true);
  expect(fx.greetCap / fx.nameCap, "greeting cap height over the name's").toBeCloseTo(0.18, 2);
  const read = await contrast(page);
  test.info().annotations.push({
    type: "measure",
    description: `letters ${read.letters.map((l) => l.toFixed(3)).join(" ")}, range ${read.rangeP5P95.toFixed(3)}, greeting ${read.greetDL.toFixed(3)}`,
  });
  // Darker than the field in light, and the surface's relief shows (a flat
  // gradient reads under 0.07 here).
  expect(read.meanDL, "letters against the field, L").toBeLessThan(-0.1);
  expect(read.rangeP5P95, "tonal range inside the letters, L").toBeGreaterThan(0.09);
  expect(read.greetDL, "the greeting against the field, L").toBeLessThan(-0.1);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`name (${colorScheme}): no letter falls under two thirds of the strongest (spread 1.5 or less)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const at of [4, 45]) {
      await openHome(page, { debug: `nocards,at=${at}` });
      const read = await contrast(page);
      test.info().annotations.push({ type: "measure", description: `at=${at}: ${read.letters.map((l) => l.toFixed(3)).join(" ")}, spread ${read.spread.toFixed(2)}` });
      expect(read.spread, `strongest over weakest letter at clock ${at}`).toBeLessThanOrEqual(1.5);
    }
  });
}

test("name (dark): the letters sit about +0.14 L over the night field at rest", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page, { debug: "nocards,at=4" });
  const read = await contrast(page);
  test.info().annotations.push({ type: "measure", description: `dark letters ${read.meanDL.toFixed(3)} L over the field` });
  expect(read.meanDL).toBeGreaterThan(0.11);
  expect(read.meanDL).toBeLessThan(0.2);
});

test("name: a fast swipe stirs the letters by 0.08 or more, and they return to rest within 2/255 about 4s after the pointer leaves", async ({ page, cdp }) => {
  await openHome(page, { debug: "nocards,at=4" });
  await hideCursor(page);
  const region = await nameRegion(page);
  await pointerTo(cdp, away);
  await nextFrames(page, 3);
  const rest = await shoot(page, region.box);
  await page.evaluate(() => (window as HookWindow).__coil!.nameProbe.snap("rest"));

  await sweep(cdp, { x: 1150, y: 480 }, { x: 270, y: 420 }, 380);
  await pointerTo(cdp, away);
  const left = Date.now();
  const peak = await peakChange(page, 1500);
  test.info().annotations.push({ type: "measure", description: `fast swipe: peak mean |dL| ${peak.toFixed(4)}` });
  expect(peak, "peak mean |dL| inside the letters").toBeGreaterThanOrEqual(0.08);

  await page.waitForTimeout(Math.max(0, 4000 - (Date.now() - left)));
  const back = await shoot(page, region.box);
  const settled = pixelDiff(rest, back, rest, region).insideMean;
  test.info().annotations.push({ type: "measure", description: `4s after leaving: ${settled.toFixed(2)} of 255 from rest` });
  expect(settled, "difference from the rest frame, of 255").toBeLessThan(2);
});

test("name: a slow pass (300 px/s) stirs the letters faintly, about 0.02", async ({ page, cdp }) => {
  await openHome(page, { debug: "nocards,at=4" });
  await hideCursor(page);
  await pointerTo(cdp, { x: 300, y: 460 });
  await nextFrames(page, 3);
  await page.evaluate(() => (window as HookWindow).__coil!.nameProbe.snap("rest"));
  await sweep(cdp, { x: 300, y: 460 }, { x: 1150, y: 440 }, 2833);
  const peak = await peakChange(page, 1200);
  test.info().annotations.push({ type: "measure", description: `slow pass: peak mean |dL| ${peak.toFixed(4)}` });
  expect(peak).toBeGreaterThan(0.012);
  expect(peak).toBeLessThan(0.035);
});
