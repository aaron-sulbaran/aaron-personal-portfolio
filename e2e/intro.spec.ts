import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { INTRO_LOADING, nextFrames, openHome, scrollToY } from "./support/coil";
import { CAPSULE, PILL, armDock, readDock } from "./support/dock";
import { bubble } from "./support/inline";
import { shoot } from "./support/pixels";
import { documentTop } from "./support/wave";
import { siteContent } from "@/lib/content";

// Page 1, "who I am" (hero rework, slice 3): the loader that becomes the name,
// the field behind it, the staggered paragraphs with the six pops, the quiet
// music line, and the lab page that stays out of production.

const L = siteContent.listen;
const { intro, hero } = siteContent;
const HEADING = "#intro-heading";
const SIX_POPS = ["sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag", "3d-printing"];

type Box = { left: number; top: number; width: number; height: number };
const boxOf = (page: Page, selector: string): Promise<Box> =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, selector);
const loaderState = (page: Page) => page.evaluate(() => document.documentElement.dataset.introLoader ?? null);

test("intro: the loader covers the page from first paint, then the name lands on the heading, which never moved", async ({ page }) => {
  await page.addInitScript(() => {
    // The page's own clock when the loader says it is done.
    new MutationObserver(() => {
      if (document.documentElement.dataset.introLoader === "done") (window as unknown as { __loaderDoneAt?: number }).__loaderDoneAt ??= performance.now();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-intro-loader"] });
  });
  await page.goto("/?coildebug=1");
  // Armed before any script of the page runs: the heading waits under the loader, its place kept.
  expect(INTRO_LOADING).toContain(await loaderState(page));
  await expect(page.locator(".intro-loader")).toBeVisible();
  await expect(page.locator(HEADING)).toHaveCSS("visibility", "hidden");
  const before = await boxOf(page, HEADING);
  await page.waitForFunction(() => document.documentElement.dataset.introLoader === "done", null, { timeout: 15_000 });
  const after = await boxOf(page, HEADING);
  // No layout shift: the server's heading is where the loader lands.
  for (const key of ["left", "top", "width", "height"] as const) expect(Math.abs(after[key] - before[key]), key).toBeLessThan(0.5);
  await expect(page.locator(HEADING)).toBeVisible();
  await expect(page.locator(HEADING)).toHaveCSS("visibility", "visible");
  await expect(page.locator(".intro-loader")).toBeHidden();
  // The lockup's last frame is the heading's rect: no visible double name, no jump at the hand-off.
  const landed = await page.evaluate(() => (window as unknown as { __introLoader: { landed: Box } }).__introLoader.landed);
  for (const key of ["left", "top", "width", "height"] as const) expect(Math.abs(landed[key] - after[key]), `landed ${key}`).toBeLessThan(1.5);
  // The heading's name is the page's one h1, read as "Hi, I'm Aaron."
  await expect(page.getByRole("heading", { level: 1, name: hero.heading })).toHaveCount(1);
  // It is quick on a local build: well inside the budget (about 1.6 s on a fast connection) with room for a busy machine.
  const doneAt = await page.evaluate(() => (window as unknown as { __loaderDoneAt: number }).__loaderDoneAt);
  expect(doneAt, "ms from navigation to the loader's end").toBeLessThan(2000);
});

test("intro: the field sits behind the name, never behind the first paragraph", async ({ page }) => {
  await openHome(page, { at: "top" });
  const field = page.locator("[data-name-field]");
  await expect(field).toHaveAttribute("data-name-field", "live");
  const stage = await boxOf(page, "[data-intro-stage]");
  const first = await boxOf(page, '[data-block-text]');
  expect(stage.top + stage.height).toBeLessThanOrEqual(first.top + 0.5);
  const canvas = await boxOf(page, "[data-name-canvas]");
  expect(canvas.top + canvas.height).toBeLessThanOrEqual(first.top + 0.5);
  // The field is on the page: beside the name, inside the glow, the paper is tinted; far from it, it is the paper.
  const heading = await boxOf(page, HEADING);
  const y = Math.round(stage.top + stage.height / 2);
  const red = async (x: number, at: number) => (await shoot(page, { x: Math.round(x), y: at, width: 8, height: 8 })).rgba[0];
  const paper = await red(8, y);
  // Beside the name's letters, in the glow's middle, the paper is tinted blue (the red channel drops).
  const beside = await Promise.all([red(heading.left - 30, y), red(heading.left + heading.width + 30, y), red(heading.left + heading.width / 2, Math.round(heading.top - 24))]);
  expect(paper - Math.min(...beside), "red channel, paper minus the deepest glow").toBeGreaterThanOrEqual(8);
});

test("intro: four blocks of two to three sentences, composed at first paint and staggered across the column", async ({ page }) => {
  await openHome(page, { at: "top" });
  const blocks = page.locator("[data-block]");
  await expect(blocks).toHaveCount(4);
  const text = page.locator("[data-block-text]");
  for (let i = 0; i < 4; i++) {
    await expect(text.nth(i)).toBeVisible();
    // No staging: nothing is hidden, shifted or fading in.
    expect(await text.nth(i).evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await text.nth(i).evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  }
  const xs = await Promise.all([0, 1, 2, 3].map((i) => text.nth(i).evaluate((el) => el.getBoundingClientRect().left)));
  expect(xs[1], "block 2 leans right of block 1").toBeGreaterThan(xs[0] + 100);
  expect(xs[3], "block 4 leans right of block 3").toBeGreaterThan(xs[2] + 100);
  expect(Math.abs(xs[0] - xs[2])).toBeLessThan(1);
  expect(Math.abs(xs[1] - xs[3])).toBeLessThan(1);
  const widths = await Promise.all([0, 1].map((i) => text.nth(i).evaluate((el) => el.getBoundingClientRect().width / parseFloat(getComputedStyle(el).fontSize))));
  // About 60 characters: 60ch is a little over 30 em in this face.
  for (const width of widths) expect(width).toBeLessThan(45);
});

test("intro: the six pops that slice 1 cut are on the page and open on hover", async ({ page }) => {
  await openHome(page, { at: "top" });
  for (const key of SIX_POPS) {
    const link = page.locator(`#about [data-inline="pop"][data-inline-key="${key}"]`);
    await expect(link, key).toHaveCount(1);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await link.hover();
    await expect(bubble(page), key).toContainText(siteContent.register.pop[key as keyof typeof siteContent.register.pop].caption!);
    await page.mouse.move(2, 2);
  }
});

test("intro: the music is one quiet line, and freeze it is the toggle inside it", async ({ page }) => {
  await openHome(page, { at: "top" });
  const band = page.locator("#listen");
  await expect(band.getByRole("heading", { name: L.line })).toBeVisible();
  await expect(band.getByRole("button", { name: L.accept, exact: true })).toBeVisible();
  await expect(band.getByRole("button", { name: L.decline, exact: true })).toBeVisible();
  // The standalone link is gone: the toggle is two words in the line under the question.
  await expect(band.getByRole("button", { name: L.freeze, exact: true })).toHaveCount(0);
  const line = band.locator("[data-band-subline] p");
  await expect(line).toHaveText("It moves with you, or freeze it.");
  const toggle = line.getByRole("button", { name: L.subline.freeze, exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(line.getByRole("button", { name: L.unfreeze, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(line).toHaveText(L.unfreeze);
  // One flag for the whole wave: the decline note's toggle reads it as frozen.
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  await expect(band.getByRole("button", { name: L.unfreeze, exact: true })).toHaveAttribute("aria-pressed", "true");
  await band.getByRole("button", { name: L.unfreeze, exact: true }).click();
  await expect(band.getByRole("button", { name: L.freeze, exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("intro: the Music? pill stays hidden while the prompt is on screen, and shows once it has scrolled away unanswered", async ({ page }) => {
  await armDock(page);
  await openHome(page, { at: "top" });
  const hidden = async () => (await readDock(page))?.inert === true;
  const promptTop = await documentTop(page, "[data-band-prompt]");
  const promptBottom = promptTop + (await boxOf(page, "[data-band-prompt]")).height;
  const height = page.viewportSize()!.height;
  // Before the reader reaches it, and while any of it shows: no pill.
  expect(await hidden()).toBe(true);
  for (const y of [promptTop - height + 80, promptTop - height / 2, promptTop - 40, promptBottom - 60]) {
    await scrollToY(page, Math.max(0, Math.round(y)));
    await nextFrames(page, 4);
    expect(await hidden(), `prompt in view at scroll ${Math.round(y)}`).toBe(true);
  }
  // Scrolled away above the top of the screen, unanswered: the pill arrives as "Music?".
  await scrollToY(page, Math.round(promptBottom + 80));
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill after the prompt has gone" }).toBe(false);
  await expect(page.locator(CAPSULE)).toHaveAttribute("aria-label", /^Music\?/);
  // Back up to the prompt: it steps away again.
  await scrollToY(page, Math.max(0, Math.round(promptTop - height / 2)));
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill with the prompt back on screen" }).toBe(true);
  await expect(page.locator(PILL)).toHaveCount(1);
});

test("intro: the teaser asks, deals, links to the quick version, and keeps the wheel's slot, with no empty band after it", async ({ page }) => {
  await openHome(page, { at: "top" });
  const teaser = page.locator("[data-teaser]");
  await expect(teaser.getByText(intro.teaser.line)).toBeVisible();
  await expect(teaser.getByRole("button", { name: intro.teaser.deal })).toBeVisible();
  await expect(teaser.getByRole("link", { name: intro.teaser.quick })).toHaveAttribute("href", "/quick");
  // The 30-second link is one small muted line under the button: no underline at rest, no button or pill look.
  const dealBox = await boxOf(page, "[data-teaser] button");
  const quickBox = await boxOf(page, '[data-teaser] a[href="/quick"]');
  expect(quickBox.top).toBeGreaterThanOrEqual(dealBox.top + dealBox.height - 1);
  const quick = await teaser.getByRole("link", { name: intro.teaser.quick }).evaluate((el) => {
    const style = getComputedStyle(el);
    return { decoration: style.textDecorationLine, background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderTopLeftRadius };
  });
  expect(quick).toMatchObject({ decoration: "none", background: "rgba(0, 0, 0, 0)", border: "0px" });
  const slot = page.locator("[data-coil-wheel]");
  await expect(slot).toBeVisible();
  const box = await slot.boundingBox();
  expect(box!.width).toBeGreaterThan(200);
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
  expect(await teaser.evaluate((el) => el.contains(document.querySelector("[data-coil-wheel]")))).toBe(true);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("intro: one column, every block stacked, the teaser right after, and nothing wider than the screen", async ({ page }) => {
    await openHome(page, { at: "top" });
    const text = page.locator("[data-block-text]");
    const lefts = await Promise.all([0, 1, 2, 3].map((i) => text.nth(i).evaluate((el) => Math.round(el.getBoundingClientRect().left))));
    expect(new Set(lefts).size).toBe(1);
    for (let i = 0; i < 4; i++) await expect(text.nth(i)).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.locator("[data-more]")).toBeHidden();
    // The wheel's slot ends the teaser, and the teaser ends where the cards section begins.
    const slot = await boxOf(page, "[data-coil-wheel]");
    const work = await boxOf(page, "#work");
    expect(work.top - (slot.top + slot.height)).toBeLessThan(96);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("intro: no loader runs, the name is simply in place, and the field is its poster", async ({ page }) => {
    await page.goto("/?coildebug=1");
    await expect(page.locator(HEADING)).toBeVisible();
    expect(await loaderState(page)).toBeNull();
    await expect(page.locator(".intro-loader")).toBeHidden();
    const first = await boxOf(page, HEADING);
    await page.waitForTimeout(1200);
    const later = await boxOf(page, HEADING);
    expect(later).toEqual(first);
    await expect(page.locator("[data-name-field]")).toHaveAttribute("data-name-field", "poster");
    await expect(page.locator("[data-name-canvas]")).toHaveCount(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("intro: the heading is visible, and no loader hides it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(HEADING)).toBeVisible();
    await expect(page.locator(HEADING)).toHaveCSS("visibility", "visible");
    await expect(page.locator(".intro-loader")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: hero.heading })).toBeVisible();
  });
});

test("intro: a deep load skips the loader", async ({ page }) => {
  await page.goto("/?coildebug=1#work");
  await expect(page.locator(HEADING)).toHaveCount(1);
  expect(await loaderState(page)).toBeNull();
  await expect(page.locator(".intro-loader")).toBeHidden();
});

test("intro: the hero lab page is not in a production build", async ({ page }) => {
  const response = await page.goto("/lab/hero");
  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-frame]")).toHaveCount(0);
});

test("intro: the lab's bridge and panel are not in a production build's scripts", async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (/\.js(\?|$)/.test(response.url()) && response.status() < 400) scripts.push(response.text().catch(() => ""));
  });
  await openHome(page, { at: "top" });
  const bodies = await Promise.all(scripts);
  expect(bodies.length).toBeGreaterThan(0);
  expect(bodies.filter((body) => body.includes("hero-lab-replay-v1") || body.includes("hero-lab-v1"))).toEqual([]);
  expect(bodies.filter((body) => body.includes("Reload frames"))).toEqual([]);
});
