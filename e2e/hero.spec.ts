import type { CDPSession, Page } from "@playwright/test";
import { NAME_FILLS } from "@/lib/coil/field.glsl";
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

test("name: every fill draws a name that stands out from the field", async ({ page }) => {
  // The field alone at one held moment, then each fill over the same moment.
  await openHome(page, { debug: "nocards,noname,at=4" });
  await hideCursor(page);
  const region = await nameRegion(page);
  const field = await shoot(page, region.box);

  await openHome(page, { debug: "name,nocards,at=4" });
  await hideCursor(page);
  const switcher = page.getByRole("group", { name: "Hero options" });
  for (const fill of NAME_FILLS) {
    await switcher.getByRole("button", { name: fill, exact: true }).click();
    await expect(switcher.getByRole("button", { name: fill, exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(4, 4);
    await nextFrames(page, 3);
    const drawn = await shoot(page, region.box);
    const diff = pixelDiff(field, drawn, field, region);
    test.info().annotations.push({ type: "measure", description: `${fill}: ${diff.insideMean.toFixed(2)} of 255 from the field` });
    expect.soft(diff.insideMean, `${fill}: mean difference from the field inside the name box, of 255`).toBeGreaterThan(6);
  }
});

test("name: a fast swipe parts the fill, and it closes back to rest after the pointer leaves", async ({ page, cdp }) => {
  await openHome(page, { debug: "nocards,at=4" });
  await hideCursor(page);
  const region = await nameRegion(page);
  const away = { x: 6, y: page.viewportSize()!.height - 6 };
  await pointerTo(cdp, away);
  await nextFrames(page, 3);
  const rest = await shoot(page, region.box);

  // Left to right through the name's middle in ten frames.
  const { box } = region;
  const y = box.y + box.height * 0.55;
  for (let i = 0; i <= 10; i++) {
    await pointerTo(cdp, { x: box.x + (box.width * i) / 10, y });
    await nextFrames(page, 1);
  }
  const parted = await shoot(page, region.box);
  const fx = await page.evaluate(() => (window as HookWindow & { __coil: { nameFx: () => { repelActive: boolean; repelMax: number } } }).__coil.nameFx());
  expect(fx.repelActive).toBe(true);
  const partedBy = pixelDiff(rest, parted, rest, region).insideMean;
  test.info().annotations.push({ type: "measure", description: `parted: ${partedBy.toFixed(2)} of 255, repel ${fx.repelMax}` });
  expect(partedBy, "change inside the name while parted, of 255").toBeGreaterThan(2);

  await pointerTo(cdp, away);
  const left = Date.now();
  await page.waitForFunction(() => !(window as unknown as { __coil: { nameFx: () => { repelActive: boolean } } }).__coil.nameFx().repelActive, null, {
    timeout: 5000,
  });
  const settleMs = Date.now() - left;
  const closed = await shoot(page, region.box);
  const closedBy = pixelDiff(rest, closed, rest, region).insideMean;
  test.info().annotations.push({ type: "measure", description: `closed in ${settleMs}ms, ${closedBy.toFixed(2)} of 255 from rest` });
  expect(settleMs, "ms from leaving to rest").toBeLessThan(2500);
  expect(closedBy, "difference from the rest frame, of 255").toBeLessThan(2);
});
