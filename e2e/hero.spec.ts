import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { COIL } from "@/lib/coil/constants";
import { downFirstQuick } from "@/lib/coil/capture.fixtures";
import { coilPoints, nextFrames, openHome, silhouetteDistance, type Point } from "./support/coil";
import { frames, offsetTravel, pageTravel } from "./support/frames";
import type { HookWindow } from "./support/hooks";
import { approach, firstPixels, pointerTo, trackpad } from "./support/input";

// The Coil's hero behaviour: page scroll never turns it, and the first-visit
// hints ("Open me" on the cursor over a card until the first open, "Keep
// exploring" once after that card lands home). The name is page 1's own canvas
// now (e2e/intro.spec.ts): the scene draws none, so the lit-surface and wake
// specs that read the scene's name went with it.

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

// Aaron, 2026-10-06: page scroll never turns the coil. A page gesture off
// the helix, then a jump like a scrollbar drag, move the page while the coil
// keeps its idle pace (0.09 cards a second) and nothing more.
test("hero: page scroll leaves the coil at its idle pace", async ({ page, cdp }) => {
  await openHome(page);
  const gutter = { x: 8, y: 120 };
  expect(await silhouetteDistance(page, gutter), "gutter to silhouette, px").toBeGreaterThan(20);
  await approach(cdp, gutter);

  const recording = await frames(page, async () => {
    await trackpad(cdp, firstPixels(downFirstQuick, 320), { at: gutter });
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "instant" }));
    await nextFrames(page, 30);
  });

  expect(recording.wheels.some((wheel) => wheel.prevented), "wheel events the coil took").toBe(false);
  expect(pageTravel(recording), "page movement, px").toBeGreaterThan(300);
  const { rows } = recording;
  const seconds = (rows.at(-1)!.t - rows[0].t) / 1000;
  expect(Math.abs(offsetTravel(recording)), "coil travel, cards").toBeLessThan(COIL.idleCardsPerSecond * seconds + 0.02);
  const steps = rows.slice(1).map((row, i) => Math.abs(row.offset - rows[i].offset));
  // The idle is 0.0015 cards a frame at 60fps.
  expect(Math.max(...steps), "largest step in a frame, cards").toBeLessThan(0.005);
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
