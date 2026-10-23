import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { INTRO_LOADING, nextFrames, openHome, scrollToY } from "./support/coil";
import { CAPSULE, PILL, armDock, readDock } from "./support/dock";
import { bubble } from "./support/inline";
import { shoot } from "./support/pixels";
import { documentTop } from "./support/wave";
import { siteContent } from "@/lib/content";

// The home's first screen (hero rework, slices 3 and 4c): the loader that becomes
// the name, the name drawn by the scene with the field behind it (faded away
// behind the text), blocks 1 and 2, the thin wave, the ribbon's slot, Deal me in;
// then, after the cards, More about me with blocks 3 and 4; and the lab page that
// stays out of production.

const L = siteContent.listen;
const { intro, hero } = siteContent;
const HEADING = "#intro-heading";
const SIX_POPS = ["sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag", "3d-printing"];
// Everything of the page hidden but the canvas, so a pixel read is the scene's own.
const HIDE_PAGE = "html,body{transition:none!important}body *{visibility:hidden!important}section[data-scene] canvas{visibility:visible!important}";

type Box = { left: number; top: number; width: number; height: number };
const boxOf = (page: Page, selector: string): Promise<Box> =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, selector);
const loaderState = (page: Page) => page.evaluate(() => document.documentElement.dataset.introLoader ?? null);
const dealLink = (page: Page) => page.locator("[data-first-cta] a").first();

// The vertical room left on the first screen: the viewport less the content's own
// height (the ribbon slot at its least, the screen's min-height off).
async function leftoverPx(page: Page) {
  return page.evaluate(() => {
    const first = document.querySelector<HTMLElement>("[data-first-screen]")!;
    const ribbon = document.querySelector<HTMLElement>(".first-ribbon")!;
    const before = [first.style.minHeight, ribbon.style.flex];
    first.style.minHeight = "0";
    ribbon.style.flex = "none";
    const natural = first.getBoundingClientRect().height;
    [first.style.minHeight, ribbon.style.flex] = before;
    return { natural, leftover: window.innerHeight - natural };
  });
}

test("intro: the loader covers the page from first paint, then the name lands on its place, which never moved", async ({ page }) => {
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
  await expect(page.locator(".intro-loader")).toBeHidden();
  // The lockup's last frame is the heading's rect: no visible double name, no jump at the hand-off.
  const landed = await page.evaluate(() => (window as unknown as { __introLoader: { landed: Box } }).__introLoader.landed);
  for (const key of ["left", "top", "width", "height"] as const) expect(Math.abs(landed[key] - after[key]), `landed ${key}`).toBeLessThan(1.5);
  // The scene drew the name on that same place, at the heading's own size, and the loader handed over to it.
  const target = await page.evaluate(() => (window as unknown as { __coil: { api: { nameRect: () => { left: number; baseline: number; fontPx: number } | null } } }).__coil.api.nameRect());
  const fontPx = await page.evaluate((selector) => parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize), HEADING);
  expect(target, "the scene's name").not.toBeNull();
  expect(Math.abs(target!.fontPx - fontPx), "the canvas name's size against the heading's").toBeLessThan(0.5);
  expect(Math.abs(target!.left - after.left), "the canvas name's ink against the heading's box").toBeLessThan(14);
  expect(target!.baseline).toBeGreaterThan(after.top);
  expect(target!.baseline).toBeLessThan(after.top + after.height);
  // The heading's name is the page's one h1, read as "Hi, I'm Aaron."
  await expect(page.getByRole("heading", { level: 1, name: hero.heading })).toHaveCount(1);
  // It is quick on a local build: well inside the budget (about 1.6 s on a fast connection) with room for a busy machine.
  const doneAt = await page.evaluate(() => (window as unknown as { __loaderDoneAt: number }).__loaderDoneAt);
  expect(doneAt, "ms from navigation to the loader's end").toBeLessThan(2000);
});

test("intro: the field is behind the name and the ribbon, faded away behind the text", async ({ page }) => {
  await openHome(page, { at: "top" });
  await page.addStyleTag({ content: HIDE_PAGE });
  await page.waitForTimeout(300);
  const name = await boxOf(page, HEADING);
  const blocks = await boxOf(page, "[data-first-blocks]");
  const red = async (x: number, y: number) => (await shoot(page, { x: Math.round(x), y: Math.round(y), width: 8, height: 8 })).rgba[0];
  // The page is paper far from everything; beside the name the field tints it (the red channel drops).
  const paperRed = await page.evaluate(() => Number(getComputedStyle(document.body).backgroundColor.match(/\d+/g)![0]));
  const paper = paperRed;
  const besideName = Math.min(await red(name.left + name.width / 2, name.top + name.height + 40), await red(name.left - 40, name.top + name.height / 2));
  expect(paper - besideName, "red channel, paper minus the field beside the name").toBeGreaterThanOrEqual(8);
  // Behind the middle of the blocks the field is faded away: the paper.
  const behindText = await red(blocks.left + blocks.width / 2, blocks.top + blocks.height / 2);
  expect(Math.abs(paper - behindText), "red channel, paper minus behind the blocks").toBeLessThanOrEqual(3);
});

test("intro: blocks 1 and 2 are on the first screen, staggered, and blocks 3 and 4 follow the cards, staggered", async ({ page }) => {
  await openHome(page, { at: "top" });
  const first = page.locator("[data-first-blocks] [data-block-text]");
  const about = page.locator("#about [data-block-text]:visible");
  await expect(first).toHaveCount(2);
  await expect(about).toHaveCount(2);
  for (const text of [first.nth(0), first.nth(1), about.nth(0), about.nth(1)]) {
    await expect(text).toBeVisible();
    // No staging: nothing is hidden, shifted or fading in.
    expect(await text.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await text.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  }
  const left = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => el.getBoundingClientRect().left);
  expect(await left(first.nth(1)), "block 2 leans right of block 1").toBeGreaterThan((await left(first.nth(0))) + 60);
  expect(await left(about.nth(1)), "block 4 leans right of block 3").toBeGreaterThan((await left(about.nth(0))) + 100);
  // The text of blocks 1 and 2 is the story's, whole: both blocks' sentences, with their def and pop links.
  for (const block of [intro.blocks[0], intro.blocks[1]]) {
    expect(await page.locator(`#story-${block.key}`).count(), block.key).toBe(1);
  }
  await expect(page.locator('[data-first-blocks] [data-inline="def"][data-inline-key="product"]')).toHaveCount(1);
  await expect(page.locator('[data-first-blocks] [data-inline="pop"][data-inline-key="leadership-award"]')).toHaveCount(1);
  const widths = await Promise.all([0, 1].map((i) => first.nth(i).evaluate((el) => el.getBoundingClientRect().width / parseFloat(getComputedStyle(el).fontSize))));
  // About 60 characters: 60ch is a little over 30 em in this face.
  for (const width of widths) expect(width).toBeLessThan(45);
});

test("intro: the page runs first screen, cards, more about me, proof of work, Connect", async ({ page }) => {
  await openHome(page, { at: "top" });
  const tops = await page.evaluate(() => ["[data-first-screen]", "#work", "#about", "#numbers", "#connect"].map((s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY));
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(new Set(tops).size).toBe(5);
  await expect(page.locator("#about")).toHaveAccessibleName(intro.more);
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

test("intro: the music is one quiet line on the first screen, and freeze it is the toggle inside it", async ({ page }) => {
  await openHome(page, { at: "top" });
  const band = page.locator("#listen");
  await expect(band.getByRole("heading", { name: L.line })).toBeVisible();
  await expect(band.getByRole("button", { name: L.accept, exact: true })).toBeVisible();
  await expect(band.getByRole("button", { name: L.decline, exact: true })).toBeVisible();
  // The band is on the first screen, between the blocks and the ribbon.
  const [blocks, bandBox, ribbon] = await Promise.all([boxOf(page, "[data-first-blocks]"), boxOf(page, "#listen"), boxOf(page, "[data-coil-ribbon]")]);
  expect(bandBox.top).toBeGreaterThanOrEqual(blocks.top + blocks.height - 1);
  expect(ribbon.top).toBeGreaterThanOrEqual(bandBox.top + bandBox.height - 1);
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
  // On the first screen the prompt is in view from the start: no pill.
  expect(await hidden()).toBe(true);
  // Scrolled away above the top of the screen, unanswered: the pill arrives as "Music?".
  await scrollToY(page, Math.round(promptBottom + 80));
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill after the prompt has gone" }).toBe(false);
  await expect(page.locator(CAPSULE)).toHaveAttribute("aria-label", /^Music\?/);
  // Back up to the prompt: it steps away again.
  await scrollToY(page, 0);
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill with the prompt back on screen" }).toBe(true);
  await expect(page.locator(PILL)).toHaveCount(1);
});

test("intro: Deal me in is a link to the cards, the 30-second line is one muted line under it, and the ribbon has its room", async ({ page }) => {
  await openHome(page, { at: "top" });
  const first = page.locator("[data-first-cta]");
  await expect(dealLink(page)).toHaveText(new RegExp(intro.teaser.deal));
  await expect(dealLink(page)).toHaveAttribute("href", "#work");
  await expect(first.getByRole("link", { name: intro.teaser.quick })).toHaveAttribute("href", "/quick");
  // The 30-second link is one small muted line under the button: no underline at rest, no button or pill look.
  const dealBox = await boxOf(page, "[data-first-cta] a");
  const quickBox = await boxOf(page, '[data-first-cta] a[href="/quick"]');
  expect(quickBox.top).toBeGreaterThanOrEqual(dealBox.top + dealBox.height - 1);
  const quick = await first.getByRole("link", { name: intro.teaser.quick }).evaluate((el) => {
    const style = getComputedStyle(el);
    return { decoration: style.textDecorationLine, background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderTopLeftRadius };
  });
  expect(quick).toMatchObject({ decoration: "none", background: "rgba(0, 0, 0, 0)", border: "0px" });
  // Both are centered under the ribbon, and the ribbon's slot is as tall as its cards.
  const ribbon = await boxOf(page, "[data-coil-ribbon]");
  const viewport = page.viewportSize()!;
  expect(Math.abs(dealBox.left + dealBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(dealBox.top).toBeGreaterThanOrEqual(ribbon.top + ribbon.height - 1);
  expect(ribbon.height).toBeGreaterThan(100);
});

// The first screen is one screen, with no scroll at the defaults.
for (const size of [
  { name: "1280x800", viewport: { width: 1280, height: 800 } },
  { name: "390x844", viewport: { width: 390, height: 844 }, phone: true },
]) {
  test.describe(`the first screen at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: !!size.phone, isMobile: !!size.phone });

    test("intro: the name, the text, the wave, the ribbon and Deal me in fit one screen with no scroll", async ({ page }) => {
      await openHome(page, { at: "top" });
      const { natural, leftover } = await leftoverPx(page);
      test.info().annotations.push({ type: "leftover vertical space", description: `${leftover.toFixed(0)} px (content ${natural.toFixed(0)} of ${size.viewport.height})` });
      const first = await boxOf(page, "[data-first-screen]");
      expect(first.height, "the first screen is one screen tall").toBeLessThanOrEqual(size.viewport.height + 0.5);
      expect(leftover, "the content fits").toBeGreaterThanOrEqual(0);
      const cta = await boxOf(page, "[data-first-cta]");
      expect(cta.top + cta.height).toBeLessThanOrEqual(size.viewport.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.viewport.width);
      // The blocks on show are block 1 (and block 2 on a desktop); the phone leaves block 2 to the about section.
      await expect(page.locator("[data-first-blocks] [data-block-text]:visible")).toHaveCount(size.phone ? 1 : 2);
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("intro: one column, block 2 waits in the about section, and nothing is wider than the screen", async ({ page }) => {
    await openHome(page, { at: "top" });
    const text = page.locator("[data-block-text]:visible");
    await expect(text).toHaveCount(4);
    const lefts = await Promise.all([0, 1, 2, 3].map((i) => text.nth(i).evaluate((el) => Math.round(el.getBoundingClientRect().left))));
    expect(new Set(lefts).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Block 2 is read once, in the about section, before blocks 3 and 4; the first screen's copy is out of the reading order.
    await expect(page.locator('[data-first-blocks] [data-story-block="work"]')).toBeHidden();
    await expect(page.locator('#about [data-story-block="work"]')).toBeVisible();
    expect(await page.locator('[data-story-block="work"]:visible').count()).toBe(1);
    expect(await page.evaluate(() => document.querySelector("[data-more]"))).toBeNull();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("intro: no loader runs, the first screen is simply in place: the name with the field as its fill, the ribbon as a still row", async ({ page }) => {
    await page.goto("/?coildebug=1");
    await expect(page.locator(HEADING)).toBeVisible();
    expect(await loaderState(page)).toBeNull();
    await expect(page.locator(".intro-loader")).toBeHidden();
    const first = await boxOf(page, HEADING);
    await page.waitForTimeout(1200);
    expect(await boxOf(page, HEADING)).toEqual(first);
    await expect(page.locator("[data-name-visual]").first()).toBeVisible();
    await expect(page.locator("[data-ribbon-still]")).toBeVisible();
    await expect(page.locator("[data-first-field]")).toBeVisible();
    await expect(page.locator("#work canvas")).toHaveCount(0);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("intro: the first screen reads whole: the heading as text with the field as its fill, the ribbon as a still row, Deal me in a link to the cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(HEADING)).toBeVisible();
    await expect(page.locator(HEADING)).toHaveCSS("visibility", "visible");
    await expect(page.locator(".intro-loader")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: hero.heading })).toBeVisible();
    await expect(page.locator("[data-name-visual]").first()).toBeVisible();
    await expect(page.locator("[data-name-visual]").nth(1)).toHaveCSS("background-clip", /text/);
    await expect(page.locator("[data-ribbon-still]")).toBeVisible();
    expect(await page.locator("[data-ribbon-still] > *").count()).toBe(14);
    await expect(dealLink(page)).toBeVisible();
    await expect(dealLink(page)).toHaveAttribute("href", "#work");
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
