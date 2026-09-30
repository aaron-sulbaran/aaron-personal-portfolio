import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { coilPoints, nextFrames, openHome, type Point } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { pointerTo } from "./support/input";
import { cardRegion, pixelDiff, shoot, type CardRegion } from "./support/pixels";

// The hero slice: the greeting drawn with the name in the canvas (no DOM
// control beside it any more), the name's fills and its cursor repel, and the
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
