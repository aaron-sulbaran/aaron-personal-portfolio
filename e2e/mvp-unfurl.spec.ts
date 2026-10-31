import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToFoot } from "./support/coil";
import { settled } from "./support/fallback";
import { tabTo } from "./support/inline";

// The MVP's short name, "MVP", unfurls to "Minimum Viable Portfolio" on the
// Menu's MVP line and in page 1's line under Deal me in, on a fine pointer that
// can hover (a hover or keyboard focus) (components/quick/MvpUnfurl, globals.css
// "The MVP unfurl"). It plays once per hover and folds back on leave or blur,
// switches at once under reduced motion, and moves nothing: page 1's line stays
// centred, and the Menu's line is its own, so the full name covers nothing. A
// touch screen never unfurls (e2e/touch.spec.ts).

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
const menuLink = (page: Page) => page.locator("[data-menu-mvp]");

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

// The Menu's foot: the settings (theme, freeze the wave), then the MVP on a line of its own, then the contact row.
async function openMenu(page: Page, path = "/") {
  if (path === "/") await openHome(page, { at: "top" });
  else await page.goto(path);
  await page.getByRole("button", { name: M.ariaLabelOpen }).click();
  const dialog = page.getByRole("dialog", { name: M.dialogLabel });
  await expect(dialog.locator("[data-menu-mvp-line]")).toBeVisible();
  // The foot has risen in (its own 0.5s after a 0.42s wait).
  await page.waitForTimeout(1200);
  await page.mouse.move(2, 2);
  return dialog;
}
// The full name drawn over the line: shown, and at full strength.
const fullDrawn = (link: Locator) =>
  link.evaluate((el) => {
    const style = getComputedStyle(el.querySelector(".mvp-full, .mvp-fan")!);
    return style.visibility === "visible" && Number(style.opacity) > 0.99;
  });

test("mvp unfurl: the Menu's MVP is a link on a line of its own between the settings and the contact row, named for the whole MVP", async ({ page }) => {
  const dialog = await openMenu(page);
  const link = dialog.getByRole("link", { name: quickCopy.menuLinkName, exact: true });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", "/quick");
  // The chip row keeps the settings only.
  const chips = dialog.locator("[data-menu-freeze]").locator("xpath=..");
  await expect(chips.locator("[data-menu-mvp]")).toHaveCount(0);
  await expect(chips.locator(":scope > *")).toHaveCount(2);
  const email = dialog.getByRole("link", { name: M.email.label, exact: true });
  const [chipBox, lineBox, emailBox] = [await boxOf(chips), await boxOf(dialog.locator("[data-menu-mvp-line]")), await boxOf(email)];
  expect(lineBox.y, "under the chips").toBeGreaterThanOrEqual(chipBox.y + chipBox.height);
  expect(lineBox.y + lineBox.height, "over the contact row").toBeLessThanOrEqual(emailBox.y);
  // Set like the email link: the label face, in the accent.
  const look = (target: Locator) => target.evaluate((el) => { const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.fontWeight, s.color]; });
  expect(await look(link)).toEqual(await look(email));
  // On a fine pointer the note is not drawn: the link unfurls instead.
  await expect(dialog.locator("[data-menu-mvp-note]")).toBeHidden();
});

test("mvp unfurl: the Menu's MVP line unfurls on hover and focus over the empty line to its right, and nothing in the foot moves", async ({ page }) => {
  const dialog = await openMenu(page);
  const link = menuLink(page);
  const others = [
    dialog.getByRole("button", { name: M.themeAriaLabelToDark }),
    dialog.locator("[data-menu-freeze]"),
    dialog.locator("[data-menu-mvp-line]"),
    dialog.getByRole("link", { name: M.email.label, exact: true }),
    dialog.getByRole("link", { name: "LinkedIn" }),
  ];
  const before = { link: await boxOf(link), others: await Promise.all(others.map(boxOf)) };
  const panel = await boxOf(dialog.locator("#site-menu"));
  await watch(page);

  await link.hover();
  await expect.poll(() => fullDrawn(link), { message: "the full name is drawn" }).toBe(true);
  await page.waitForTimeout(700);
  expect(await boxOf(link), "the link's own box").toEqual(before.link);
  expect(await Promise.all(others.map(boxOf)), "the chips, the line and the contact row").toEqual(before.others);
  const full = await boxOf(link.locator(".mvp-full, .mvp-fan"));
  expect(full.x, "from the link's left edge").toBeCloseTo(before.link.x, 0);
  expect(full.x + full.width, "inside the panel").toBeLessThan(panel.x + panel.width);
  await page.mouse.move(2, 2);
  await expect.poll(() => fullDrawn(link)).toBe(false);

  // Keyboard focus does the same, and the blur takes it back.
  await tabTo(page, link);
  await expect.poll(() => fullDrawn(link)).toBe(true);
  await page.keyboard.press("Tab");
  await expect.poll(() => fullDrawn(link)).toBe(false);
  expect(await Promise.all(others.map(boxOf))).toEqual(before.others);
  expect(await outsideShifts(page), "anything in the foot that shifted").toEqual([]);
});

test("mvp unfurl: on the MVP page the way home holds the same line, so the Menu keeps one shape", async ({ page }) => {
  const parts = async (dialog: Locator) => ({
    chips: await boxOf(dialog.locator("[data-menu-freeze]").locator("xpath=..")),
    line: await boxOf(dialog.locator("[data-menu-mvp-line]")),
    email: await boxOf(dialog.getByRole("link", { name: M.email.label, exact: true })),
  });
  const home = await parts(await openMenu(page));
  const dialog = await openMenu(page, "/quick");
  await expect(dialog.locator("[data-menu-mvp]")).toHaveCount(0);
  const back = dialog.locator("[data-menu-mvp-line]").getByRole("link", { name: quickCopy.back, exact: true });
  await expect(back).toHaveAttribute("href", "/");
  expect(await parts(dialog)).toEqual(home);
});

test("mvp unfurl: the Menu does not start scrolling at the desktop sizes it fits today", async ({ page }) => {
  for (const [width, height] of [[1280, 800], [1440, 900], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    const dialog = await openMenu(page);
    const scroll = await dialog.locator("#site-menu").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(scroll.scroll, `${width}x${height}`).toBeLessThanOrEqual(scroll.client);
  }
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("mvp unfurl: under reduced motion the words switch at once, on page 1's line and the Menu's MVP line", async ({ page }) => {
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
    await expect(menuLink(page)).toBeVisible();
    await page.waitForTimeout(800);
    await menuLink(page).hover();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await fullDrawn(menuLink(page)), "the full name, on the frame after the hover").toBe(true);
    expect(await runs(page), "no width transition ran").toBe(0);
    expect(await outsideShifts(page)).toEqual([]);
  });
});
