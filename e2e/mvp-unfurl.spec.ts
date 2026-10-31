import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToFoot } from "./support/coil";
import { settled } from "./support/fallback";
import { tabTo } from "./support/inline";

// The MVP's short name, "MVP", unfurls to "Minimum Viable Portfolio" in the Menu
// chip and in page 1's line under Deal me in, on a fine pointer that can hover
// (a hover or keyboard focus), in the move of the MVP page's own title
// (components/quick/MvpUnfurl, globals.css "The MVP unfurl"). It plays once per
// hover and folds back on leave or blur, switches at once under reduced motion,
// and moves nothing: page 1's line stays centred and the chip's box grows over
// its neighbours. A touch screen never unfurls (e2e/touch.spec.ts).

const { teaser } = siteContent.intro;
const M = siteContent.menu;
const WORDS = quickCopy.title;

type Box = { x: number; y: number; width: number; height: number };
const boxOf = (target: Locator): Promise<Box> =>
  target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
const widthOf = async (target: Locator) => (await boxOf(target)).width;
const line = (page: Page) => page.locator("[data-intro-cta] a[data-mvp-link]");
const fan = (page: Page) => page.locator("[data-intro-cta] .mvp-fan");
const chip = (page: Page) => page.locator("[data-menu-mvp]");

// The unfurled width, once the transitions have run their course.
async function settledWidth(target: Locator) {
  let last = -1;
  await expect
    .poll(async () => {
      const now = await widthOf(target);
      const same = Math.abs(now - last) < 0.01;
      last = now;
      return same;
    }, { intervals: [150, 150, 150, 150, 150, 150, 150, 150, 150, 150], timeout: 5000 })
    .toBe(true);
  return last;
}

async function arrived(page: Page) {
  await page.waitForFunction(() => !document.documentElement.dataset.introWords);
}

// Layout shifts and width transitions from here on, kept on window. A shift is told apart by where it happened: the unfurling words
// themselves move as the room opens (Chromium counts that travel, a few millionths of a viewport each), and anything else on the page
// moving is the fault this guards against.
async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __shift: number; __outside: string[]; __runs: string[] };
    w.__shift = 0;
    w.__outside = [];
    w.__runs = [];
    new PerformanceObserver((list) => {
      type Source = { node: Node | null };
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: Source[] }[]) {
        if (entry.hadRecentInput) continue;
        w.__shift += entry.value;
        for (const { node } of entry.sources) {
          const el = node instanceof Element ? node : (node?.parentElement ?? null);
          if (!el?.closest("[data-mvp-link]")) w.__outside.push(`${el?.tagName ?? "?"}.${el?.className ?? ""}`);
        }
      }
    }).observe({ type: "layout-shift" });
    document.addEventListener("transitionrun", (event) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains("mvp-slot") && event.propertyName === "width") w.__runs.push("slot");
    });
  });
}
const shifts = (page: Page) => page.evaluate(() => (window as unknown as { __shift: number }).__shift);
const outsideShifts = (page: Page) => page.evaluate(() => (window as unknown as { __outside: string[] }).__outside);
const runs = (page: Page) => page.evaluate(() => (window as unknown as { __runs: string[] }).__runs.length);

async function openLine(page: Page) {
  await openHome(page, { at: "foot" });
  await arrived(page);
  await page.mouse.move(2, 2);
  await expect(line(page)).toBeVisible();
}

test("mvp unfurl: page 1's line reads In a rush? The MVP, is named for the whole MVP, and goes to the MVP page", async ({ page }) => {
  await openLine(page);
  await expect(page.getByRole("link", { name: teaser.quickName, exact: true })).toHaveCount(1);
  await expect(line(page)).toHaveAttribute("href", "/quick");
  // What is drawn at rest: the line and its short word; the unfurled words are held back.
  await expect(line(page).locator(".mvp-short")).toHaveText(quickCopy.titleShort);
  expect(await line(page).evaluate((el, lead) => (el.textContent ?? "").startsWith(lead), teaser.quick.slice(0, -quickCopy.titleShort.length))).toBe(true);
  await expect(fan(page)).toBeHidden();
  expect(await fan(page).evaluate((el) => el.getAttribute("aria-hidden"))).toBe("true");
});

test("mvp unfurl: hovering page 1's line unfurls MVP to Minimum Viable Portfolio once, and leaving folds it back", async ({ page }) => {
  await openLine(page);
  await watch(page);
  const rest = await widthOf(fan(page));
  await line(page).hover();
  await expect(fan(page)).toBeVisible();
  const open = await settledWidth(fan(page));
  expect(open, "the unfurled words are wider than MVP").toBeGreaterThan(rest + 60);
  await expect(fan(page)).toHaveText(WORDS);
  // Once per hover: three words open (one run each), and holding the pointer there plays nothing more.
  expect(await runs(page)).toBe(3);
  await page.waitForTimeout(700);
  expect(await runs(page)).toBe(3);
  // The short word gives way to the unfurled one, in place.
  await expect(line(page).locator(".mvp-short")).toHaveCSS("visibility", "hidden");
  await page.mouse.move(2, 2);
  await expect(fan(page)).toBeHidden();
  expect(await settledWidth(fan(page))).toBeCloseTo(rest, 0);
  expect(await runs(page), "folding back runs the three words again").toBe(6);
  await line(page).hover();
  await expect.poll(() => runs(page), { message: "the next hover plays again" }).toBe(9);
});

test("mvp unfurl: keyboard focus on page 1's line unfurls it, and a blur folds it back", async ({ page }) => {
  await openLine(page);
  const rest = await widthOf(fan(page));
  await tabTo(page, line(page));
  await expect(fan(page)).toBeVisible();
  expect(await settledWidth(fan(page))).toBeGreaterThan(rest + 60);
  await expect(fan(page)).toHaveText(WORDS);
  await page.keyboard.press("Tab");
  await expect(fan(page)).toBeHidden();
  expect(await settledWidth(fan(page))).toBeCloseTo(rest, 0);
});

test("mvp unfurl: page 1's line stays centred and nothing moves while it unfurls (no layout shift)", async ({ page }) => {
  await openLine(page);
  const deal = page.locator("[data-deal-button]");
  const centreX = (b: Box) => b.x + b.width / 2;
  const [line0, deal0] = [await boxOf(line(page)), await boxOf(deal)];
  expect(Math.abs(centreX(line0) - centreX(deal0)), "the line is centred under Deal me in at rest").toBeLessThanOrEqual(1);
  const page0 = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }));
  await watch(page);
  await line(page).hover();
  await settledWidth(fan(page));
  expect(await boxOf(line(page)), "the line's own box").toEqual(line0);
  expect(await boxOf(deal), "Deal me in").toEqual(deal0);
  // The words reach past the line's box on the right and stay on the screen.
  const [open, viewport] = [await boxOf(fan(page)), page.viewportSize()!];
  expect(open.x + open.width).toBeGreaterThan(line0.x + line0.width);
  expect(open.x + open.width).toBeLessThan(viewport.width);
  expect(await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }))).toEqual(page0);
  await page.mouse.move(2, 2);
  await settledWidth(fan(page));
  expect(await boxOf(line(page))).toEqual(line0);
  expect(await outsideShifts(page), "anything but the unfurling words that shifted").toEqual([]);
  expect(await shifts(page), "layout shift while it unfurled and folded, the words' own travel").toBeLessThan(0.0001);
});

test("mvp unfurl: the unfurled words take the link fill from the centre, in the accent", async ({ page }) => {
  await openLine(page);
  const inkOf = () => fan(page).evaluate((el) => ({ p: Number(getComputedStyle(el).getPropertyValue("--inline-p")), clip: getComputedStyle(el).backgroundClip }));
  expect((await inkOf()).p).toBe(0);
  await line(page).hover();
  await expect.poll(async () => (await inkOf()).p, { message: "the fill comes in" }).toBe(1);
  expect((await inkOf()).clip).toMatch(/text/);
});

test("mvp unfurl: the Menu chip is named for the whole MVP and goes to the MVP page", async ({ page }) => {
  await openHome(page, { at: "top" });
  await page.getByRole("button", { name: M.ariaLabelOpen }).click();
  const dialog = page.getByRole("dialog", { name: M.dialogLabel });
  const link = dialog.getByRole("link", { name: quickCopy.menuChipName, exact: true });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", "/quick");
  await expect(dialog.locator("[data-menu-mvp-note]")).toHaveCount(0);
});

test("mvp unfurl: the Menu chip grows over its neighbours on hover and focus, and nothing around it moves", async ({ page }) => {
  await openHome(page, { at: "top" });
  await page.getByRole("button", { name: M.ariaLabelOpen }).click();
  const dialog = page.getByRole("dialog", { name: M.dialogLabel });
  await expect(chip(page)).toBeVisible();
  await page.waitForTimeout(1200);
  await page.mouse.move(2, 2);
  const row = dialog.locator("[data-menu-mvp]").locator("xpath=ancestor::span[1]");
  const neighbours = [dialog.locator("[data-menu-freeze]"), dialog.getByRole("link", { name: siteContent.menu.email.label }), dialog.getByRole("link", { name: "LinkedIn" })];
  const before = { chip: await boxOf(chip(page)), slot: await boxOf(row), others: await Promise.all(neighbours.map(boxOf)) };
  await watch(page);

  await chip(page).hover();
  await expect.poll(async () => (await widthOf(chip(page))) > before.chip.width + 100, { message: "the chip opens" }).toBe(true);
  const open = await settledWidth(chip(page));
  const opened = await boxOf(chip(page));
  expect(opened.x + opened.width, "anchored by its right edge").toBeCloseTo(before.chip.x + before.chip.width, 0);
  expect(open).toBeGreaterThan(before.chip.width + 100);
  expect(await boxOf(row), "the room it holds in the row").toEqual(before.slot);
  expect(await Promise.all(neighbours.map(boxOf)), "the chips and rows beside it").toEqual(before.others);
  expect(await chip(page).evaluate((el) => getComputedStyle(el).getPropertyValue("--fx-p")), "the pill fill").toBe("1");
  expect(await runs(page)).toBe(6);
  await page.mouse.move(2, 2);
  expect(await settledWidth(chip(page))).toBeCloseTo(before.chip.width, 0);
  expect(await outsideShifts(page), "anything but the chip that shifted").toEqual([]);
  expect(await shifts(page), "layout shift, the chip's own growth").toBeLessThan(0.002);

  // Keyboard focus does the same, and the blur folds it back.
  await tabTo(page, chip(page));
  expect(await settledWidth(chip(page))).toBeGreaterThan(before.chip.width + 100);
  await page.keyboard.press("Tab");
  expect(await settledWidth(chip(page))).toBeCloseTo(before.chip.width, 0);
  expect(await outsideShifts(page)).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("mvp unfurl: under reduced motion the words switch at once, on page 1's line and in the Menu chip", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await scrollToFoot(page);
    await page.mouse.move(2, 2);
    await expect(line(page)).toBeVisible();
    await watch(page);
    const slot = line(page).locator(".mvp-slot").first();
    await expect(slot).toHaveCSS("transition-duration", "0s");
    const rest = await widthOf(fan(page));
    await line(page).hover();
    // On the frame after the hover, not after a transition: the words are open.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const open = await widthOf(fan(page));
    expect(open).toBeGreaterThan(rest + 60);
    expect(await settledWidth(fan(page))).toBeCloseTo(open, 1);
    expect(await runs(page), "no width transition ran").toBe(0);
    await page.mouse.move(2, 2);
    await expect(fan(page)).toBeHidden();
    expect(await widthOf(fan(page))).toBeCloseTo(rest, 0);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.getByRole("button", { name: M.ariaLabelOpen }).click();
    await expect(chip(page)).toBeVisible();
    await page.waitForTimeout(800);
    const chipRest = await widthOf(chip(page));
    await chip(page).hover();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await widthOf(chip(page))).toBeGreaterThan(chipRest + 100);
    expect(await runs(page), "no width transition ran").toBe(0);
    expect(await outsideShifts(page)).toEqual([]);
  });
});
