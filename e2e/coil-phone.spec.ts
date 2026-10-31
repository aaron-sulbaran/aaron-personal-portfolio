import type { CDPSession, Page } from "@playwright/test";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { coilPoints, nextFrames, openHome, scrollToCards, waitForCoil, waitForCoilSettled, waitForScene, type Point } from "./support/coil";
import type { HookWindow } from "./support/hooks";

// Page 2 on a phone (Aaron, 2026-10-30): the Coil's band is most of the screen
// and its cards read as photos, the titles under it are the index, and the
// Coil moves under every input that reaches it: a finger's drag on a phone, a
// mouse's wheel and drag in a phone-width window, a tablet's trackpad, and
// Chrome's device toolbar switched on after the page loaded (a coarse pointer
// with no hover, whose touches arrive as pointer events only; the drag used to
// listen for touch events the page had decided at load it would never get, and
// the wheel was the fine pointer's alone). A clearly vertical swipe still
// scrolls the page; a desktop is unchanged.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const offset = (page: Page) => page.evaluate(() => (window as HookWindow).__coil!.offset());
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

// One finger from `from` to `to` in `steps` moves a frame apart, as a hand swipes.
async function swipe(cdp: CDPSession, from: Point, to: Point, steps = 12) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

// A mouse press dragged sideways across the Coil and let go.
async function mouseDrag(page: Page, from: Point, dx: number, steps = 10) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await sleep(16);
    await page.mouse.move(from.x + (dx * i) / steps, from.y + i * 0.3);
  }
  await page.mouse.up();
}

// Wheel notches at a point, sent straight through DevTools input (no mouse move
// first: the device toolbar sends no hover moves).
async function wheelAt(cdp: CDPSession, at: Point, notches = 6, deltaY = 40) {
  for (let i = 0; i < notches; i++) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: Math.round(at.x), y: Math.round(at.y), deltaX: 0, deltaY });
    await sleep(30);
  }
}

// A card point, or the middle of the band's visible part when the sampler finds
// none clear of its neighbors (the cards are large on a phone).
async function cardPoint(page: Page): Promise<Point> {
  const points = await coilPoints(page);
  if (points.card) return points.card;
  return page.locator("#work [data-coil-stage]").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: (Math.max(0, r.top) + Math.min(r.bottom, window.innerHeight)) / 2 };
  });
}

test.describe("page 2 on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test("the Coil's band is most of the screen, its cards are the band's share, and the titles under it step down", async ({ page }) => {
    await openHome(page);
    const stage = await page.locator("#work [data-coil-stage]").evaluate((el) => el.getBoundingClientRect().toJSON());
    expect(stage.height, "the band's height").toBeGreaterThanOrEqual((844 * COIL.phone.bandSvh) / 100 - 1);
    const budget = await page.evaluate(() => (window as HookWindow).__coil!.budget());
    expect(budget.phone).toBe(true);
    expect(budget.narrow, "a phone's band composes wide").toBe(false);
    expect(Number(budget.cardPx)).toBeGreaterThan(stage.height * COIL.cardHeightFrac);
    expect(Number(budget.cardPx)).toBeLessThanOrEqual(stage.height * COIL.phone.cardHeightFrac + 0.01);
    const sizes = await page.evaluate(() => {
      const px = (selector: string) => parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize);
      return { title: px('#work button[data-card="capital-one"]'), page: px("#work [data-page-title]"), label: px("#work h3") };
    });
    expect(sizes.title).toBe(15);
    expect(sizes.title).toBeLessThan(sizes.page);
    expect(sizes.label, "the column labels stay legible").toBeGreaterThanOrEqual(12);
    // Every title sits under the band, a full-width row a finger can hit.
    for (const button of await page.locator("#work button[data-card]").all()) {
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(stage.bottom - 1);
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });

  test("a finger's sideways drag spins the Coil and the release coasts onto a card; the page holds", async ({ page, cdp }) => {
    await openHome(page);
    const card = await cardPoint(page);
    const start = await offset(page);
    const pageY = await scrollY(page);
    await swipe(cdp, card, { x: card.x - 200, y: card.y + 4 }, 10);
    const released = await page.evaluate(() => (window as HookWindow).__coil!.drag());
    expect(released.coast, "a coast target after the release").not.toBeNull();
    expect(Math.abs(released.target - start), "cards moved by the drag").toBeGreaterThan(0.5);
    expect(await scrollY(page), "page scroll").toBe(pageY);
    await page.waitForFunction(() => (window as HookWindow).__coil!.drag().coast === null, null, { timeout: 5000 });
    const rest = await page.evaluate(() => (window as HookWindow).__coil!.drag());
    expect(Math.abs(rest.offset - Math.round(rest.offset))).toBeLessThan(0.01);
  });

  test("a clearly vertical swipe that starts on a card scrolls the page down past the Coil to the list", async ({ page, cdp }) => {
    await openHome(page);
    const card = await cardPoint(page);
    const pageY = await scrollY(page);
    const before = await page.evaluate(() => ({ offset: (window as HookWindow).__coil!.offset(), t: performance.now() }));
    await swipe(cdp, card, { x: card.x + 6, y: card.y - 320 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(pageY + 150);
    expect(await page.evaluate(() => (window as HookWindow).__coil!.drag().dragging)).toBe(false);
    const after = await page.evaluate(() => ({ offset: (window as HookWindow).__coil!.offset(), t: performance.now() }));
    const idleTravel = (COIL.idleCardsPerSecond * (after.t - before.t)) / 1000;
    expect(Math.abs(after.offset - before.offset), "coil travel, cards").toBeLessThan(idleTravel + 0.02);
    // The list has come up into view.
    await expect(page.locator('#work button[data-card="travel"]')).toBeInViewport();
  });

  test("a tap on a card opens its modal, and each title still opens its card", async ({ page }) => {
    await openHome(page);
    const card = await cardPoint(page);
    await page.touchscreen.tap(card.x, card.y);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: siteContent.modals.closeAriaLabel }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const title = page.locator('#work button[data-card="misuki"]');
    await title.scrollIntoViewIfNeeded();
    await title.tap();
    await expect(page.locator('[role="dialog"][data-card-modal="misuki"]')).toBeVisible({ timeout: 8000 });
  });
});

test.describe("Chrome's device toolbar switched on after the page loaded (a coarse pointer, no hover)", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

  test("a drag and a wheel over a card both move the Coil, and after the page scrolls, a wheel moved onto a card is the Coil's again", async ({ page, cdp }) => {
    await page.goto("/?coildebug=1");
    await waitForScene(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await scrollToCards(page);
    await waitForCoil(page);
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-input", "coarse");
    expect(await page.evaluate(() => "ontouchstart" in document.documentElement), "the page decided at load it has no touch").toBe(false);

    // The drag: the toolbar's touches reach the page as pointer events.
    let card = await cardPoint(page);
    let start = await offset(page);
    const pageY = await scrollY(page);
    await swipe(cdp, card, { x: card.x - 200, y: card.y + 4 }, 10);
    await page.waitForFunction(() => (window as HookWindow).__coil!.drag().coast === null, null, { timeout: 5000 });
    expect(Math.abs((await offset(page)) - start), "cards moved by the drag").toBeGreaterThan(0.5);
    expect(await scrollY(page)).toBe(pageY);

    // The wheel over a card: the Coil's, the page holds.
    await waitForCoilSettled(page);
    card = await cardPoint(page);
    start = await offset(page);
    await wheelAt(cdp, card);
    await sleep(300);
    expect(Math.abs((await offset(page)) - start), "cards moved by the wheel").toBeGreaterThan(0.3);
    expect(await scrollY(page), "the page under a coil gesture").toBe(pageY);

    // The wheel over the list scrolls the page, which disarms the Coil's
    // capture; with no hover moves, the next gesture's own position is the
    // pointer's: moved onto a card, the wheel is the Coil's again.
    await sleep(400);
    const list = await page.locator('#work button[data-card="capital-one"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + 40, y: r.top + r.height / 2 };
    });
    await wheelAt(cdp, list, 3);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(pageY + 40);
    await sleep(400);
    const scrolled = await scrollY(page);
    card = await cardPoint(page);
    start = await offset(page);
    await wheelAt(cdp, card);
    await sleep(300);
    expect(Math.abs((await offset(page)) - start), "cards moved by the wheel after the page scrolled").toBeGreaterThan(0.3);
    expect(await scrollY(page)).toBe(scrolled);
  });
});

test.describe("a phone-width desktop window (a mouse)", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

  test("the wheel over a card and a mouse drag both move the Coil", async ({ page }) => {
    await openHome(page);
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-input", "fine");
    let card = await cardPoint(page);
    await page.mouse.move(card.x - 20, card.y);
    await page.mouse.move(card.x, card.y);
    await nextFrames(page, 2);
    let start = await offset(page);
    const pageY = await scrollY(page);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 40);
      await sleep(30);
    }
    await sleep(300);
    expect(Math.abs((await offset(page)) - start), "cards moved by the wheel").toBeGreaterThan(0.3);
    expect(await scrollY(page)).toBe(pageY);

    await sleep(400);
    await waitForCoilSettled(page);
    card = await cardPoint(page);
    start = await offset(page);
    await mouseDrag(page, card, -200);
    await page.waitForFunction(() => (window as HookWindow).__coil!.drag().coast === null, null, { timeout: 5000 });
    expect(Math.abs((await offset(page)) - start), "cards moved by the drag").toBeGreaterThan(0.5);
    // A drag is no click: no card opened.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("a tablet with a trackpad (a coarse pointer whose press is a mouse's)", () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  test("the trackpad's wheel and its press-drag both move the Coil", async ({ page }) => {
    await openHome(page);
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-input", "coarse");
    let card = await cardPoint(page);
    await page.mouse.move(card.x - 20, card.y);
    await page.mouse.move(card.x, card.y);
    let start = await offset(page);
    const pageY = await scrollY(page);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 40);
      await sleep(30);
    }
    await sleep(300);
    expect(Math.abs((await offset(page)) - start), "cards moved by the wheel").toBeGreaterThan(0.3);
    expect(await scrollY(page)).toBe(pageY);

    await sleep(400);
    await waitForCoilSettled(page);
    card = await cardPoint(page);
    start = await offset(page);
    await mouseDrag(page, card, -220);
    await page.waitForFunction(() => (window as HookWindow).__coil!.drag().coast === null, null, { timeout: 5000 });
    expect(Math.abs((await offset(page)) - start), "cards moved by the drag").toBeGreaterThan(0.5);
  });
});

test.describe("a desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  test("is unchanged: a fine pointer's drag across the Coil does not spin it, and the band fills the section", async ({ page }) => {
    await openHome(page);
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-input", "fine");
    expect((await page.evaluate(() => (window as HookWindow).__coil!.budget())).phone).toBe(false);
    const sizes = await page.evaluate(() => ({
      stage: document.querySelector("#work [data-coil-stage]")!.getBoundingClientRect().height,
      section: document.getElementById("work")!.getBoundingClientRect().height,
    }));
    expect(Math.abs(sizes.stage - sizes.section)).toBeLessThan(1);
    const { background, card } = await coilPoints(page);
    const from = background ?? card;
    await page.mouse.move(from.x, from.y);
    await nextFrames(page, 2);
    const before = await page.evaluate(() => ({ offset: (window as HookWindow).__coil!.offset(), t: performance.now() }));
    await mouseDrag(page, from, -200);
    await sleep(300);
    const after = await page.evaluate(() => ({ offset: (window as HookWindow).__coil!.offset(), t: performance.now(), drag: (window as HookWindow).__coil!.drag() }));
    expect(after.drag.coast).toBeNull();
    expect(after.drag.dragging).toBe(false);
    const idleTravel = (COIL.idleCardsPerSecond * (after.t - before.t)) / 1000;
    expect(Math.abs(after.offset - before.offset), "coil travel, cards").toBeLessThan(idleTravel + 0.05);
  });
});
