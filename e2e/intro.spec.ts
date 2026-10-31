import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { INTRO_LOADING, nextFrames, openHome, scrollToY } from "./support/coil";
import { CAPSULE, PILL, armDock, readDock } from "./support/dock";
import { bubble } from "./support/inline";
import { decodePng, shoot } from "./support/pixels";
import { documentTop } from "./support/wave";
import { siteContent } from "@/lib/content";

// Page 1, who I am (hero rework, slices 3 and 4d): the loader that becomes the
// name, the name drawn in its own small canvas with the field inside its
// letters, the story's two paragraphs on either side of the page with the thin
// wave between them, the ribbon and Deal me in at its foot; the pages in order
// (page 1, the cards, proof of work, Connect); and the lab page that stays out
// of production.

const L = siteContent.listen;
const { intro, hero } = siteContent;
const HEADING = "#intro-heading";
const HOBBY_POPS = ["sandboarding", "downhill-skating", "skydiving", "rock-climbing", "3d-printing"];
// Everything of the page hidden but the name's canvas, so a pixel read is its own.
const HIDE_PAGE = "html,body{transition:none!important}body *{visibility:hidden!important}[data-name-canvas-el]{visibility:visible!important}";

type Box = { left: number; top: number; width: number; height: number };
type NameCanvasHook = {
  nameRect: () => { left: number; baseline: number; fontPx: number; width: number } | null;
  stats: () => { frames: number; running: boolean; landed: boolean; size: [number, number]; clock: number; wakeActive: boolean };
};
const boxOf = (page: Page, selector: string): Promise<Box> =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, selector);
const loaderState = (page: Page) => page.evaluate(() => document.documentElement.dataset.introLoader ?? null);
const dealLink = (page: Page) => page.locator("[data-intro-cta] a").first();
const nameStats = (page: Page) => page.evaluate(() => (window as unknown as { __nameCanvas: NameCanvasHook }).__nameCanvas.stats());
// The five items that arrive on load, in page order: the name's line, paragraph 1, the band's question, paragraph 2, the strip's button.
const arrivalOpacities = (page: Page) => page.evaluate(() => [...document.querySelectorAll("[data-arrive]")].map((el) => Number(getComputedStyle(el).opacity)));
const blockBox = (page: Page, key: string) => boxOf(page, `#story-${key} [data-block-text]`);

// The name's canvas has drawn its first frame and the loader is gone.
async function nameDrawn(page: Page) {
  await page.waitForFunction(() => document.querySelector("[data-name-stage]")?.getAttribute("data-name-canvas") === "on" && document.documentElement.dataset.introLoader === "done", null, { timeout: 20_000 });
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
  // The name canvas drew the name on that same place, at the heading's own size, and the loader handed over to it.
  await nameDrawn(page);
  const target = await page.evaluate(() => (window as unknown as { __nameCanvas: NameCanvasHook }).__nameCanvas.nameRect());
  const fontPx = await page.evaluate((selector) => parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize), HEADING);
  expect(target, "the canvas's name").not.toBeNull();
  expect(Math.abs(target!.fontPx - fontPx), "the canvas name's size against the heading's").toBeLessThan(0.5);
  expect(Math.abs(target!.left - after.left), "the canvas name's ink against the heading's box").toBeLessThan(14);
  expect(target!.baseline).toBeGreaterThan(after.top);
  expect(target!.baseline).toBeLessThanOrEqual(after.top + after.height + 0.5);
  expect((await nameStats(page)).landed, "the loader landed the name on the canvas").toBe(true);
  // The heading's name is the page's one h1, read as "Hi, I'm Aaron."
  await expect(page.getByRole("heading", { level: 1, name: hero.heading })).toHaveCount(1);
  // It is quick on a local build: well inside the budget (about 1.6 s on a fast connection) with room for a busy machine.
  const doneAt = await page.evaluate(() => (window as unknown as { __loaderDoneAt: number }).__loaderDoneAt);
  expect(doneAt, "ms from navigation to the loader's end").toBeLessThan(2000);
});

test("intro: the name is drawn in its own canvas with the field only inside its letters: clear around them, and the DOM name steps aside", async ({ page }) => {
  await openHome(page, { at: "top" });
  await nameDrawn(page);
  // The DOM spans wait (the h1's sr-only text is still the heading) while the canvas draws.
  await expect(page.locator("[data-name-visual]").first()).toBeHidden();
  await page.addStyleTag({ content: HIDE_PAGE });
  await page.waitForTimeout(300);
  const name = await boxOf(page, HEADING);
  const paper = await page.evaluate(() => (getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? []).slice(0, 3).map(Number));
  const shot = await shoot(page, { x: Math.floor(name.left - 40), y: Math.floor(name.top - 20), width: Math.ceil(name.width + 80), height: Math.ceil(name.height + 40) });
  const differs = (i: number) => [0, 1, 2].some((c) => Math.abs(shot.rgba[i * 4 + c] - paper[c]) > 6);
  let ink = 0;
  let clearOutside = 0;
  let outside = 0;
  for (let y = 0; y < shot.height; y++) {
    for (let x = 0; x < shot.width; x++) {
      const i = y * shot.width + x;
      if (differs(i)) ink++;
      // The 30 px margin left of the lockup and above it: nothing of the field is drawn there.
      if (x < 30 || y < 12) {
        outside++;
        if (!differs(i)) clearOutside++;
      }
    }
  }
  const share = ink / (shot.width * shot.height);
  expect(share, "the letters' share of the box").toBeGreaterThan(0.08);
  expect(share, "the field is not a block behind the name").toBeLessThan(0.55);
  expect(clearOutside / outside, "paper around the letters").toBeGreaterThan(0.995);
});

test("intro: the name's sheen drifts on its own and the pointer stirs it", async ({ page }) => {
  await openHome(page, { at: "top" });
  await nameDrawn(page);
  const first = await nameStats(page);
  await page.waitForTimeout(600);
  const later = await nameStats(page);
  expect(later.frames, "the canvas keeps drawing while it is on screen").toBeGreaterThan(first.frames + 10);
  expect(later.clock, "the surface's own slow drift").toBeGreaterThan(first.clock);
  expect(later.wakeActive).toBe(false);
  const name = await boxOf(page, HEADING);
  await page.mouse.move(name.left + 20, name.top + name.height * 0.6);
  for (let i = 1; i <= 8; i++) await page.mouse.move(name.left + 20 + i * 36, name.top + name.height * 0.6, { steps: 2 });
  await expect.poll(async () => (await nameStats(page)).wakeActive, { message: "the pointer's wake over the name" }).toBe(true);
});

test("intro: the name's canvas rests while it is off screen and wakes when it is back", async ({ page }) => {
  await openHome(page, { at: "top" });
  await nameDrawn(page);
  await scrollToY(page, 2200);
  await page.waitForTimeout(400);
  const away = await nameStats(page);
  await page.waitForTimeout(500);
  expect((await nameStats(page)).frames, "no frames while it is off screen").toBe(away.frames);
  await scrollToY(page, 0);
  await expect.poll(async () => (await nameStats(page)).frames, { message: "drawing again" }).toBeGreaterThan(away.frames + 5);
});

test("intro: both paragraphs are on page 1, whole: paragraph 1 beside the name in one row, the wave, then paragraph 2 on the left with the right-hand columns free", async ({ page }) => {
  await openHome(page, { at: "top" });
  await expect(page.locator("[data-story-block]")).toHaveCount(2);
  await expect(page.locator("#about [data-story-block]")).toHaveCount(2);
  for (const text of await page.locator("[data-block-text]").all()) {
    await expect(text).toBeVisible();
    // No staging: nothing is hidden, shifted or fading in.
    expect(await text.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await text.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  }
  const [name, who, outside, band, late, outsideCell] = await Promise.all([
    boxOf(page, HEADING),
    blockBox(page, "who"),
    blockBox(page, "outside"),
    boxOf(page, "#listen"),
    boxOf(page, "[data-intro-late]"),
    boxOf(page, "#story-outside"),
  ]);
  // Paragraph 1 sits right of the name, with room between them, and starts at the name's height: one row, nothing under the name.
  expect(who.left, "paragraph 1 clear of the name").toBeGreaterThan(name.left + name.width + 60);
  expect(Math.abs(who.top - name.top), "paragraph 1 at the name's top").toBeLessThan(60);
  await expect(page.locator("[data-intro-top] [data-story-block]")).toHaveCount(1);
  // The wave across the page comes after the row, then paragraph 2 on the left, at the name's left edge.
  expect(band.top).toBeGreaterThanOrEqual(who.top + who.height - 1);
  expect(band.top).toBeGreaterThanOrEqual(name.top + name.height - 1);
  expect(outside.top).toBeGreaterThanOrEqual(band.top + band.height - 1);
  expect(Math.abs(outside.left - name.left)).toBeLessThan(2);
  // Paragraph 2 is the late grid's one block, and its right-hand columns are free: the open player's room, a card's width and a column's gap.
  await expect(page.locator("[data-intro-late] [data-story-block]")).toHaveCount(1);
  expect(late.left + late.width - (outsideCell.left + outsideCell.width), "the room right of paragraph 2's columns").toBeGreaterThanOrEqual(360 + 31);
  // The words are the story's, whole: both paragraphs, with their def and pop links.
  for (const block of intro.blocks) expect(await page.locator(`#story-${block.key}`).count(), block.key).toBe(1);
  await expect(page.locator('#story-who [data-inline="def"][data-inline-key="product"]')).toHaveCount(1);
  await expect(page.locator('#story-who [data-inline="pop"][data-inline-key="leadership-award"]')).toHaveCount(1);
  for (const key of ["family", "friends"]) await expect(page.locator(`#story-outside [data-inline="pop"][data-inline-key="${key}"]`), key).toHaveCount(1);
  const fontPx = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-block-text]")!).fontSize));
  // About 60 characters: 60ch is a little over 30 em in this face.
  for (const box of [who, outside]) expect(box.width / fontPx, "the measure").toBeLessThan(45);
});

test("intro: the pages run page 1, the cards, proof of work, Connect, and nothing of the story sits after the cards", async ({ page }) => {
  await openHome(page, { at: "top" });
  const tops = await page.evaluate(() => ["#about", "#work", "#numbers", "#connect"].map((s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY));
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(new Set(tops).size).toBe(4);
  await expect(page.locator("#about")).toHaveAccessibleName(intro.ariaLabel);
  expect(await page.locator("#about").count()).toBe(1);
  // Every block is above the cards section.
  const lowest = await page.evaluate(() => Math.max(...[...document.querySelectorAll("[data-story-block]")].map((el) => el.getBoundingClientRect().bottom + window.scrollY)));
  expect(lowest).toBeLessThanOrEqual(tops[1]);
  // The Menu lists the four pages.
  expect(siteContent.menu.items.map((item) => item.href)).toEqual(["#main", "#work", "#numbers", "#connect"]);
});

test("intro: the hobby pops (extreme sports and 3D printing) are on the page and open on hover", async ({ page }) => {
  await openHome(page, { at: "top" });
  for (const key of HOBBY_POPS) {
    const link = page.locator(`#about [data-inline="pop"][data-inline-key="${key}"]`);
    await expect(link, key).toHaveCount(1);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await link.hover();
    await expect(bubble(page), key).toContainText(siteContent.register.pop[key as keyof typeof siteContent.register.pop].caption!);
    await page.mouse.move(2, 2);
  }
});

test("intro: the music is one quiet line between the paragraphs, with one button for each state and no sub-line", async ({ page }) => {
  await openHome(page, { at: "top" });
  const band = page.locator("#listen");
  await band.scrollIntoViewIfNeeded();
  await expect(band.getByRole("heading", { name: L.line })).toBeVisible();
  await expect(band.getByRole("button", { name: L.accept, exact: true })).toBeVisible();
  await expect(band.getByRole("button", { name: L.decline, exact: true })).toBeVisible();
  // The band is on page 1, between paragraph 1 and paragraph 2, and the wave sits under its copy, never under it.
  const [who, bandBox, outside, copy, stage] = await Promise.all([blockBox(page, "who"), boxOf(page, "#listen"), blockBox(page, "outside"), boxOf(page, "[data-band-prompt]"), boxOf(page, "[data-wave-band-line]")]);
  expect(bandBox.top).toBeGreaterThanOrEqual(who.top + who.height - 1);
  expect(outside.top).toBeGreaterThanOrEqual(bandBox.top + bandBox.height - 1);
  expect(stage.top).toBeGreaterThanOrEqual(copy.top + copy.height - 1);
  // The other lines are gone from the page: nothing says the wave moves with the reader or can be frozen.
  const text = await band.innerText();
  for (const gone of ["It moves with you", "freeze it", "Paused.", "No problem", "Enjoy!"]) expect(text, gone).not.toContain(gone);
  await expect(band.locator("[data-band-subline], [data-band-note]")).toHaveCount(0);
  // Not now: one Play it is what is left.
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  await expect(band.locator('[data-control="off"]')).toBeVisible();
  await expect(band.locator('[data-control="off"]')).toBeFocused();
  await expect(band.getByRole("button", { name: L.decline, exact: true })).toBeHidden();
  expect(await band.innerText()).not.toContain("No problem");
});

test("intro: the playback pill carries no freeze disc beside its capsule", async ({ page }) => {
  await armDock(page);
  await openHome(page, { at: "top" });
  const band = page.locator("#listen");
  await band.scrollIntoViewIfNeeded();
  await band.getByRole("button", { name: L.decline, exact: true }).click();
  // Past the band the pill arrives with its capsule alone: no snowflake, no second button.
  await scrollToY(page, Math.round((await documentTop(page, "#listen")) + (await boxOf(page, "#listen")).height + 200));
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill past the band" }).toBe(false);
  await expect(page.locator(PILL)).toHaveCount(1);
  await expect(page.locator(PILL).getByRole("button")).toHaveCount(1);
  await expect(page.locator(`${PILL} [data-wave-freeze]`)).toHaveCount(0);
  await expect(page.locator("[data-wave-freeze]")).toHaveCount(0);
  // The box is the capsule's own width: nothing sits beside it.
  const [pill, capsule] = await Promise.all([boxOf(page, `${PILL} > div`), boxOf(page, CAPSULE)]);
  expect(Math.abs(pill.width - capsule.width), "the pill's box is the capsule").toBeLessThanOrEqual(1);
});

test("intro: the Music? pill stays hidden while the prompt is on screen, and shows once it has scrolled away unanswered", async ({ page }) => {
  await armDock(page);
  await openHome(page, { at: "top" });
  const hidden = async () => (await readDock(page))?.inert === true;
  const promptTop = await documentTop(page, "[data-band-prompt]");
  const promptBottom = promptTop + (await boxOf(page, "[data-band-prompt]")).height;
  // At the top of page 1 the prompt is below the fold, not passed: no pill.
  expect(await hidden()).toBe(true);
  // Scrolled away above the top of the screen, unanswered: the pill arrives as "Music?".
  await scrollToY(page, Math.round(promptBottom + 80));
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill after the prompt has gone" }).toBe(false);
  await expect(page.locator(CAPSULE)).toHaveAttribute("aria-label", /^Music\?/);
  // Back up to the prompt: it steps away again.
  await scrollToY(page, Math.round(promptTop - 200));
  await expect.poll(async () => (await readDock(page))?.inert, { message: "the pill with the prompt back on screen" }).toBe(true);
  await expect(page.locator(PILL)).toHaveCount(1);
});

test("intro: Deal me in is a link to the cards at page 1's foot, the MVP line is one muted line under it, and the ribbon has its room above", async ({ page }) => {
  await openHome(page, { at: "foot" });
  const cta = page.locator("[data-intro-cta]");
  await expect(dealLink(page)).toHaveText(new RegExp(intro.teaser.deal));
  await expect(dealLink(page)).toHaveAttribute("href", "#work");
  await expect(cta.getByRole("link", { name: intro.teaser.quickName, exact: true })).toHaveAttribute("href", "/quick");
  // The MVP link is one small muted line under the button: no underline at rest, no button or pill look.
  const dealBox = await boxOf(page, "[data-intro-cta] a");
  const quickBox = await boxOf(page, '[data-intro-cta] a[href="/quick"]');
  expect(quickBox.top).toBeGreaterThanOrEqual(dealBox.top + dealBox.height - 1);
  const quick = await cta.getByRole("link", { name: intro.teaser.quick }).evaluate((el) => {
    const style = getComputedStyle(el);
    return { decoration: style.textDecorationLine, background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderTopLeftRadius };
  });
  expect(quick).toMatchObject({ decoration: "none", background: "rgba(0, 0, 0, 0)", border: "0px" });
  // Both are centered under the ribbon, which is as tall as its cards, at the foot of the last paragraph.
  const ribbon = await boxOf(page, "[data-coil-ribbon]");
  const last = await blockBox(page, "outside");
  const viewport = page.viewportSize()!;
  expect(Math.abs(dealBox.left + dealBox.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(dealBox.top).toBeGreaterThanOrEqual(ribbon.top + ribbon.height - 1);
  expect(ribbon.top).toBeGreaterThanOrEqual(last.top + last.height - 1);
  expect(ribbon.height).toBeGreaterThan(100);
  // The scene draws the ribbon on its slot.
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "on");
});

for (const size of [
  { name: "1280x800", viewport: { width: 1280, height: 800 } },
  { name: "390x844", viewport: { width: 390, height: 844 }, phone: true },
]) {
  test.describe(`page 1 at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: !!size.phone, isMobile: !!size.phone });

    test("intro: the order is the name, paragraph 1, the wave, paragraph 2, the ribbon and Deal me in, with nothing wider than the screen", async ({ page }) => {
      await openHome(page, { at: "top" });
      const order = await page.evaluate(() => {
        const top = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY;
        return ["#intro-heading", "#story-who", "#listen", "#story-outside", "[data-coil-ribbon]", "[data-deal-button]", "#work"].map(top);
      });
      // The phone stacks in this order; the desktop's paragraph 1 sits beside the name, so the name and paragraph 1 start together.
      const sorted = [...order].sort((a, b) => a - b);
      if (size.phone) expect(order).toEqual(sorted);
      else {
        expect(Math.abs(order[0] - order[1])).toBeLessThan(60);
        expect(order.slice(1)).toEqual(sorted.slice(1));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.viewport.width);
      if (size.phone) {
        // One column: both paragraphs share a left edge, and neither is hidden.
        const lefts = await Promise.all(["who", "outside"].map(async (key) => Math.round((await blockBox(page, key)).left)));
        expect(new Set(lefts).size).toBe(1);
        await expect(page.locator("[data-block-text]:visible")).toHaveCount(2);
      }
    });
  });
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("intro: no loader runs, page 1 is simply in place: the name with the field as its fill, the ribbon as a still row, no running canvas", async ({ page }) => {
    await page.goto("/?coildebug=1");
    await expect(page.locator(HEADING)).toBeVisible();
    expect(await loaderState(page)).toBeNull();
    await expect(page.locator(".intro-loader")).toBeHidden();
    const first = await boxOf(page, HEADING);
    await page.waitForTimeout(1200);
    expect(await boxOf(page, HEADING)).toEqual(first);
    await expect(page.locator("[data-name-stage]")).toHaveAttribute("data-name-canvas", "still");
    await expect(page.locator("[data-name-visual]").first()).toBeVisible();
    await expect(page.locator("[data-name-visual]").nth(1)).toHaveCSS("background-clip", /text/);
    await expect(page.locator("[data-ribbon-still]")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __nameCanvas?: unknown }).__nameCanvas ?? null)).toBeNull();
    await expect(page.locator("#work canvas")).toHaveCount(0);
  });

  test("intro: no word waits to arrive: nothing is held, every item is whole from the first frame", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.dataset.introWords ?? null)).toBeNull();
    expect(await arrivalOpacities(page)).toEqual(new Array(5).fill(1));
    expect(await page.evaluate(() => [...document.querySelectorAll("[data-arrive]")].map((el) => getComputedStyle(el).transform))).toEqual(new Array(5).fill("none"));
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("intro: page 1 reads whole: the heading as text with the field as its fill, the ribbon as a still row, Deal me in a link to the cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(HEADING)).toBeVisible();
    await expect(page.locator(HEADING)).toHaveCSS("visibility", "visible");
    await expect(page.locator(".intro-loader")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: hero.heading })).toBeVisible();
    await expect(page.locator("[data-name-visual]").first()).toBeVisible();
    await expect(page.locator("[data-name-visual]").nth(1)).toHaveCSS("background-clip", /text/);
    await expect(page.locator("[data-ribbon-still]")).toBeVisible();
    expect(await page.locator("[data-ribbon-still] > *").count()).toBe(14);
    await expect(page.locator("[data-block-text]")).toHaveCount(2);
    await expect(dealLink(page)).toBeVisible();
    await expect(dealLink(page)).toHaveAttribute("href", "#work");
    // Nothing waits to arrive: the server's HTML is never blank, every item shows.
    expect(await arrivalOpacities(page)).toEqual(new Array(5).fill(1));
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

test("intro: three stays out of the page's own entry scripts: the name canvas loads with the Coil's chunks, after first paint", async ({ page }) => {
  const scripts: { url: string; body: Promise<string> }[] = [];
  page.on("response", (response) => {
    if (/\.js(\?|$)/.test(response.url()) && response.status() < 400) scripts.push({ url: response.url(), body: response.text().catch(() => "") });
  });
  await page.goto("/");
  await nameDrawn(page);
  const withThree: string[] = [];
  for (const script of scripts) if ((await script.body).includes("WebGLRenderer")) withThree.push(script.url);
  expect(withThree.length, "scripts that hold three's renderer").toBeGreaterThan(0);
  // Never the page's own entry chunks: Next names those main, main-app, webpack or polyfills.
  for (const url of withThree) expect(url, url).not.toMatch(/\/(main|main-app|webpack|polyfills)-[\w-]+\.js/);
  await nextFrames(page, 1);
});

type ArrivalSample = { t: number; o: number[]; y: number[] };

test("intro: page 1's words arrive on load once the loader has handed the name over: in the order asked, a step apart, all in place within two seconds, and never again", async ({ page }) => {
  await page.addInitScript(() => {
    const seen: unknown[] = [];
    (window as unknown as { __arrival: unknown[] }).__arrival = seen;
    let t0: number | null = null;
    const tick = () => {
      const html = document.documentElement;
      if (html && t0 === null && html.getAttribute("data-intro-words") === "play") t0 = performance.now();
      if (t0 !== null && seen.length < 600) {
        const items = [...document.querySelectorAll("[data-arrive]")];
        seen.push({ t: performance.now() - t0, o: items.map((el) => Number(getComputedStyle(el).opacity)), y: items.map((el) => new DOMMatrix(getComputedStyle(el).transform).m42) });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/");
  // Held before the first paint: while the loader runs everything but the name's line waits, transparent and a little low.
  expect(await page.evaluate(() => document.documentElement.dataset.introWords)).toBe("wait");
  const held = await arrivalOpacities(page);
  expect(held.slice(1), "everything but the name's line is held").toEqual(new Array(4).fill(0));
  await page.waitForFunction(() => !document.documentElement.dataset.introWords && ((window as unknown as { __arrival: unknown[] }).__arrival.length ?? 0) > 20, null, { timeout: 30_000 });
  const samples = await page.evaluate(() => (window as unknown as { __arrival: ArrivalSample[] }).__arrival);
  const firstAbove = (index: number, level: number) => samples.find((sample) => sample.o[index] > level)?.t ?? Number.POSITIVE_INFINITY;
  // Items in page order carry steps 0 to 4 (the name's line, paragraph 1, the band, paragraph 2, the button): each starts after the one before it, a stagger apart.
  const starts = [0, 1, 2, 3, 4].map((i) => firstAbove(i, 0.04));
  expect(starts[0], "the name's line is there at the handoff").toBe(samples[0].t);
  for (const [a, b] of [[1, 2], [2, 3], [3, 4]]) expect(starts[b] - starts[a], `item ${b} starts after item ${a}`).toBeGreaterThan(80);
  // Each rises into place on transform and opacity alone, and everything is whole within two seconds of the handoff.
  const done = [1, 2, 3, 4].map((i) => firstAbove(i, 0.99));
  expect(Math.max(...done), "every item whole, ms after the handoff").toBeLessThan(2000);
  expect(samples[0].y.slice(1).every((y) => y >= 0), "items start low and rise").toBe(true);
  expect(samples.at(-1)!.y, "and end in place").toEqual(new Array(5).fill(0));
  // Once per page load: the attribute is gone and a scroll down and back replays nothing.
  await scrollToY(page, 2400);
  await scrollToY(page, 0);
  expect(await page.evaluate(() => document.documentElement.dataset.introWords ?? null)).toBeNull();
  expect(await arrivalOpacities(page)).toEqual(new Array(5).fill(1));
});

test("intro: if the page's own script never plays the arrival, the stylesheet shows every word by itself", async ({ page }) => {
  // A load that arms the hold but never hydrates: the held items sit at opacity 0 until the failsafe animation runs
  // (after the loader's own bail, about ten seconds: the loader covers the page until then, so an earlier show would be unseen).
  await page.route("**/_next/static/chunks/**/*.js", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => document.documentElement.dataset.introWords ?? null)).toBe("wait");
  // (The name's line is already in place under the loader; the other four wait.)
  await expect.poll(async () => Math.min(...(await arrivalOpacities(page))), { timeout: 20_000 }).toBe(1);
});

// The name's ink (the stronger name is the default): both lines of "Hi, I'm Aaron" read at 3:1 or better against the page at rest with the cursor away, in both themes, while the field's gradient still shows inside the letters.
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

async function nameContrast(page: Page) {
  const stage = await boxOf(page, "[data-name-stage]");
  const clip = { x: Math.max(0, stage.left - 20), y: Math.max(0, stage.top - 20), width: stage.width + 40, height: stage.height + 40 };
  const image = decodePng(await page.screenshot({ clip, scale: "css", caret: "initial" }));
  const bg = await page.evaluate(() => (getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? []).slice(0, 3).map(Number));
  const bgL = luminance(bg[0], bg[1], bg[2]);
  const { width: W, height: H, rgba } = image;
  const ratio = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const l = luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    ratio[i] = (Math.max(l, bgL) + 0.05) / (Math.min(l, bgL) + 0.05);
  }
  // The lines, split at the empty rows between them (the page's own "01" label sits above the greeting).
  const rows: number[] = [];
  for (let y = 0; y < H; y++) {
    let ink = 0;
    for (let x = 0; x < W; x++) if (ratio[y * W + x] >= 1.12) ink++;
    rows.push(ink);
  }
  const bands: [number, number][] = [];
  let start = -1;
  let gap = 0;
  rows.forEach((ink, y) => {
    if (ink > 0) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0 && ++gap > 2) {
      bands.push([start, y - gap]);
      start = -1;
      gap = 0;
    }
  });
  if (start >= 0) bands.push([start, H - 1]);
  const [greeting, name] = bands.slice(-2);
  // The lightest pixels in each line's strokes: a pixel counts when it is within 12 percent of the strongest ratio around it (so antialiased edges do not).
  const weakest = ([y0, y1]: [number, number]) => {
    let min = Number.POSITIVE_INFINITY;
    const median: number[] = [];
    const R = 2;
    for (let y = Math.max(R, y0); y <= Math.min(H - 1 - R, y1); y++) {
      for (let x = R; x < W - R; x++) {
        const c = ratio[y * W + x];
        if (c < 1.12) continue;
        let m = 0;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) m = Math.max(m, ratio[(y + dy) * W + x + dx]);
        if (c >= 0.88 * m) {
          min = Math.min(min, c);
          median.push(c);
        }
      }
    }
    median.sort((a, b) => a - b);
    return { min, median: median[Math.floor(median.length / 2)], spread: median.at(-1)! / median[0] };
  };
  return { greeting: weakest(greeting), name: weakest(name), bands: bands.length };
}

test.describe("the name's ink", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const colorScheme of ["light", "dark"] as const) {
    test(`intro: both lines of the name read at 3:1 or better against the page at rest, in ${colorScheme}, with the gradient still in the letters`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openHome(page, { at: "top" });
      await nameDrawn(page);
      await page.mouse.move(1270, 790);
      await page.waitForTimeout(1000);
      const readings = [];
      // The sheen drifts on its own: read it at three moments.
      for (let i = 0; i < 3; i++) {
        readings.push(await nameContrast(page));
        await page.waitForTimeout(900);
      }
      for (const read of readings) {
        expect(read.bands, "lines found in the name's box").toBeGreaterThanOrEqual(2);
        expect(read.greeting.min, "the greeting's lightest stroke").toBeGreaterThanOrEqual(3);
        expect(read.name.min, "the name's lightest stroke").toBeGreaterThanOrEqual(3);
        // The gradient shows: the letters are not one flat ink.
        expect(read.name.spread, "the strongest stroke over the weakest in the name").toBeGreaterThan(1.25);
      }
      test.info().annotations.push({ type: "contrast", description: readings.map((r) => `greeting ${r.greeting.min.toFixed(2)} (median ${r.greeting.median.toFixed(2)}), name ${r.name.min.toFixed(2)} (median ${r.name.median.toFixed(2)})`).join("; ") });
    });
  }
});
