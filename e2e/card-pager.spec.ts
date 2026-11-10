import type { Locator, Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf, headerTileOf } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { phonePages } from "@/lib/gallery/plan";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardDialog, flyCard, openCardFromBook, panelAtRest } from "./support/cards";
import { homeDeck, stepFrom } from "@/lib/card/deck";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";

// The phone gallery at 390 by 844 (a fine pointer: the pager follows the
// width, a Coil click flies as it does on a desktop, and a mouse drag is a
// pointer drag like a finger's).
test.use({ viewport: { width: 390, height: 844 } });

const g = siteContent.modals.gallery;
const d = siteContent.modals.deck;
const keys = Object.keys(siteContent.cards) as CardKey[];
const PAGED = keys.filter((key) => galleryOf(key).plan.slides.length > 0);

// The band's paragraphs all fit beside their photos at 390 by 844, so its pager is one page a paragraph (a card whose words did not fit
// would have more: words that cannot fit beside even a short stage go on to pages that each carry a photo, card-phone.spec).
test("pager: a phone opens one page a paragraph, the header above the pages and the controls under them", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "band");
  await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
  const count = phonePages(galleryOf("band").plan, PHONE_GROUPING).length;
  await expect(dialog.locator("[data-pager-page]")).toHaveCount(count);
  const header = (await dialog.locator("[data-pager] h2").boundingBox())!;
  const viewport = (await dialog.locator("[data-pager-viewport]").boundingBox())!;
  expect(header.y + header.height).toBeLessThanOrEqual(viewport.y);
  const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
  expect(Math.abs(panel.height - (844 - GALLERY.pager.sheetInsetPx))).toBeLessThan(2);
  // Past the pages, the chevrons go to the card before and after (Aaron, Nov 9: a visitor can chevron through every card).
  await expect(dialog.getByRole("button", { name: d.previousCard(siteContent.cards[stepFrom(homeDeck, "band", -1)!].short) })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: g.pageNumber(1, count) })).toHaveAttribute("aria-current", "true");
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await expect(dialog.locator('[data-pager-page="0"]')).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "2");
  await expect(dialog.getByRole("button", { name: d.nextCard(siteContent.cards[stepFrom(homeDeck, "band", 1)!].short) })).toBeEnabled();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
});

test("pager: an arrow key with a modifier held is the browser's, not the pager's", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "0");
  for (const modifier of ["Alt", "Control", "Meta", "Shift"]) {
    await page.keyboard.down(modifier);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.up(modifier);
  }
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "0");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
});

test("pager: Mentorship's mentors follow its words a block each, in order across the pages, their heading once with the first, and its link on the last page", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship", { settled: true });
  const { title, people } = siteContent.cards.mentorship.mentors;
  const pages = dialog.locator("[data-pager-page]");
  // Every mentor once and in order, wherever the pager put them, with their line.
  expect(await dialog.locator("[data-mentors] a").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(people.map((mentor) => mentor.href));
  for (const mentor of people) await expect(dialog.getByText(mentor.line!, { exact: true })).toHaveCount(1);
  await expect(dialog.locator("h3", { hasText: title })).toHaveCount(1);
  // The first page is the card's own words, and the heading stands on the page with the first mentor.
  await expect(pages.first().locator("[data-mentors]")).toHaveCount(0);
  const headed = pages.filter({ has: page.locator("h3", { hasText: title }) });
  await expect(headed).toHaveCount(1);
  await expect(headed.locator(`a[href="${people[0].href}"]`)).toHaveCount(1);
  // The link is after the last mentor: on the last page.
  await expect(dialog.locator("a", { hasText: siteContent.cards.mentorship.modal.links[0].label })).toHaveCount(1);
  await expect(pages.last().locator("a", { hasText: siteContent.cards.mentorship.modal.links[0].label })).toHaveCount(1);
});

test("pager: every photo sits inside its stage, whole or on a short stage cropped to keep its width, and no stage is taller than 40 percent of the height (55 percent on a page with no words; a name tag and the post's card are as tall as their words)", async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  for (const key of PAGED) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const problems = await dialog.evaluate((root, caps) => {
      const out: string[] = [];
      root.querySelectorAll("[data-pager-page]").forEach((pageEl) => {
        const stage = pageEl.querySelector("[data-pager-stage]");
        if (!stage) return;
        const box = stage.getBoundingClientRect();
        const at = pageEl.getAttribute("data-pager-page");
        // The jobs card's two own kinds of stage: a name tag takes its tip's height, and the post's card its own.
        const own = !!stage.querySelector("[data-job-tag], [data-post-card]");
        const cap = pageEl.hasAttribute("data-wordless") ? caps.wordless : caps.stage;
        if (!own && box.height > cap + 0.5) out.push(`page ${at}: stage ${box.height}px`);
        stage.querySelectorAll("[data-photo-frame]").forEach((photo) => {
          const r = photo.getBoundingClientRect();
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5 || r.right > box.right + 0.5) out.push(`page ${at}: photo ${photo.getAttribute("data-photo-frame")} outside its stage`);
          // A photo cropped to a short stage keeps its share of the page's width.
          if (stage.hasAttribute("data-cropped") && r.width < box.width * caps.share - 1) out.push(`page ${at}: cropped photo ${Math.round(r.width)}px wide of ${Math.round(box.width)}`);
        });
      });
      return out;
    }, { stage: 844 * GALLERY.pager.stageMax, wordless: 844 * GALLERY.pager.wordlessMax, share: GALLERY.pager.photoMinShare });
    expect(problems, key).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("pager: the header, the first page and the controls mask in, and nothing is left behind", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  const controls = await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-pager-controls]')?.style.clipPath || null, null, { polling: "raf", timeout: 5000 });
  expect(await controls.jsonValue()).toMatch(/^inset\(/);
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(await dialog.locator(".card-line").count()).toBe(0);
});

test("pager: a card with no photos is its words and its links in a short modal", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "this-site");
  await expect(dialog.locator("[data-pager]")).toHaveCount(0);
  await expect(dialog.locator('[data-mask="words-0"]')).toBeVisible();
  await expect(dialog.getByRole("link", { name: new RegExp(siteContent.cards["this-site"].modal.links[0].label) })).toBeVisible();
});

test("pager: the phone header keeps a card's shorter meta, so IEEE's reads President, 2023 to 2026", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "ieee");
  await expect(dialog.locator('[data-mask="meta"]')).toHaveText("President, 2023 to 2026");
  await expect(dialog.locator('[data-inline-key="ieee-ao"]')).toHaveCount(0);
});

// With no scene (reduced motion) a title's open has no flight, so the modal draws the header tile's face itself, as markup.
test("pager: Talos's mark in the phone header's tile is never under its kit's 20px", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "talos", { flight: false });
  const tile = (await dialog.locator('[data-tile-slot="work"]').boundingBox())!;
  expect([Math.round(tile.width), Math.round(tile.height)]).toEqual([GALLERY.talosTileCompact.width, GALLERY.talosTileCompact.height]);
  const mark = (await dialog.locator('[data-tile-slot="work"] [data-face="logo"] img').first().boundingBox())!;
  expect(Math.max(mark.width, mark.height)).toBeGreaterThanOrEqual(GALLERY.talosMarkMinPx);
});

test("pager: a mouse click on the Coil flies a photo card onto the phone header's tile, which stays put while the pages turn", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo");
  const dialog = cardDialog(page, key);
  await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
  await panelAtRest(page, key);
  const slot = dialog.locator('[data-tile-slot="photo"]');
  await expect(slot).toHaveCount(1);
  await expect(dialog.locator("[data-pager-page] [data-tile-slot]")).toHaveCount(0);
  const before = (await slot.boundingBox())!;
  const tile = headerTileOf(key, true);
  expect(Math.abs(before.width - tile.width) < 1 && Math.abs(before.height - tile.height) < 1, `${before.width} by ${before.height}`).toBe(true);
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  expect(await slot.boundingBox()).toEqual(before);
  await expect(dialog.locator('[data-pager-page="0"] [data-photo-frame] img').first()).toHaveCSS("opacity", "1");
});

test("pager: keyboard focus never falls out of the dialog when its control disables or its page goes inert, and Tab from the body comes back in", async ({ page }) => {
  // The next chevron disables only where the deck stops: on the last card's last page, once every card has been seen.
  await page.addInitScript(([key, keys]) => sessionStorage.setItem(key, keys), [SEEN_STORAGE_KEY, JSON.stringify(homeDeck)] as const);
  const last = await openCardFromBook(page, homeDeck[homeDeck.length - 1], { settled: true });
  const next = last.dialog.locator('[data-pager-arrow="next"]');
  const lastPages = await last.dialog.locator("[data-pager-page]").count();
  expect(lastPages).toBeGreaterThan(1);
  await next.focus();
  for (let i = 1; i < lastPages; i++) {
    await page.keyboard.press("Enter");
    await expect(last.dialog.locator("[data-pager]")).toHaveAttribute("data-page", String(i));
  }
  await expect(next).toBeDisabled();
  await expect(last.dialog.locator('[data-pager-arrow="prev"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(last.dialog).toHaveCount(0);

  const { dialog } = await openCardFromBook(page, "misuki", { home: false, settled: true });
  // The page of Misuki's second paragraph, whichever page that is once its first has had its own.
  const pages = dialog.locator("[data-pager-page]");
  const at = await pages.evaluateAll((els) => els.findIndex((el) => [...el.querySelectorAll("button")].some((button) => button.textContent === "Fast and Furious")));
  await dialog.locator(`[data-pager-dot="${at}"]`).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", String(at));
  const tip = dialog.getByRole("button", { name: "Fast and Furious", exact: true });
  await tip.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", String(at - 1));
  // Focus lands on a live control of the dialog (the nearest one: a page of plain words has none of its own, so a pager control), not on the body.
  await expect.poll(() => page.evaluate(() => { const el = document.activeElement; return el !== document.body && !!el?.closest('[role="dialog"]') && !el.closest("[inert]"); })).toBe(true);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: g.nextPage })).toBeFocused();
});

test("pager: under reduced motion a page changes with no travel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  // Chrome writes a zero length shorthand back without its duration, so the inline longhands are read
  // (the computed one is globals.css's reduced motion floor, whatever the track asks for).
  const written = await dialog.locator("[data-pager-track]").evaluate((el) => [(el as HTMLElement).style.transitionProperty, (el as HTMLElement).style.transitionDuration]);
  expect(written[0]).toBe("transform");
  expect(written[1]).toMatch(/^0(ms|s)$/);
});

async function centerOf(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A drag slow enough never to count as a quick flick (under 0.6px a ms).
async function slowDrag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }, steps = 14) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (by.x * i) / steps, from.y + (by.y * i) / steps);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}

// Past the first page a drag goes to the card before (Aaron's pick, 2026-11-09: e2e/card-deck.spec.ts walks the deck); the pages never wrap.
test("pager: a sideways drag turns one page, a short one springs back, and past the start it goes to the card before", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "band", { settled: true });
  const pager = dialog.locator("[data-pager]");
  const stage = (i: number) => dialog.locator(`[data-pager-page="${i}"] [data-pager-stage]`);
  await slowDrag(page, await centerOf(stage(0)), { x: -30, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await slowDrag(page, await centerOf(stage(0)), { x: -120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "1");
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  await slowDrag(page, await centerOf(stage(1)), { x: 120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  await slowDrag(page, await centerOf(stage(0)), { x: 120, y: 0 });
  await expect(cardDialog(page, stepFrom(homeDeck, "band", -1)!)).toBeVisible();
});

test("pager: a vertical drag on the stage springs back short of 96px and closes the modal past it", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "band", { settled: true });
  const panel = dialog.locator("[data-gallery-panel]");
  const before = (await panel.boundingBox())!.y;
  const stage = dialog.locator('[data-pager-page="0"] [data-pager-stage]');
  await slowDrag(page, await centerOf(stage), { x: 0, y: 60 });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.y)).toBe(Math.round(before));
  await slowDrag(page, await centerOf(stage), { x: 0, y: 130 });
  await expect(dialog).toHaveCount(0);
});

// A page's words only scroll where a single paragraph is taller than the whole page even with its phone omissions dropped (a very short
// window: every other overflow is paged, card-phone.spec): Misuki's first paragraph is still over 230px, more than a 420px tall window
// leaves a page beside a photo. The pointer then belongs to the words, and a drag on the stage still closes the modal.
test("pager: a paragraph taller than a very short page scrolls in its own area and never dismisses, while a drag on the stage still does", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  const { dialog } = await openCardFromBook(page, "misuki", { settled: true });
  const pages = dialog.locator("[data-pager-page]");
  const at = await pages.evaluateAll((els) => els.findIndex((el) => el.querySelector("[data-scrolls]")));
  expect(at, "a page whose words scroll").toBeGreaterThanOrEqual(0);
  await dialog.locator(`[data-pager-dot="${at}"]`).click();
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  const words = pages.nth(at).locator("[data-pager-text]");
  await expect(words).toHaveAttribute("data-scrolls", "");
  await slowDrag(page, await centerOf(words), { x: 0, y: -150 });
  await slowDrag(page, await centerOf(words), { x: 0, y: 150 });
  await expect(dialog).toBeVisible();
  const middle = await centerOf(words);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => words.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-pager-dot="0"]').click();
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  await slowDrag(page, await centerOf(pages.first().locator("[data-pager-stage]")), { x: 0, y: 130 });
  await expect(dialog).toHaveCount(0);
});

test("pager: under reduced motion a drag moves nothing, a cancel changes nothing, and a sideways release still turns the page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false, settled: true });
  const pager = dialog.locator("[data-pager]");
  const track = dialog.locator("[data-pager-track]");
  const panel = dialog.locator("[data-gallery-panel]");
  const moved = () => Promise.all([track.evaluate((el) => (el as HTMLElement).style.transform), panel.evaluate((el) => (el as HTMLElement).style.translate)]);
  const rest = await moved();
  const from = await centerOf(dialog.locator('[data-pager-page="0"] [data-pager-stage]'));
  await page.evaluate(() => {
    window.addEventListener("pointerdown", (e) => ((window as unknown as { lastPointerId: number }).lastPointerId = e.pointerId), { once: true, capture: true });
  });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x - 15 * i, from.y);
    await page.waitForTimeout(20);
  }
  expect(await moved()).toEqual(rest);
  await pager.evaluate((el) => el.dispatchEvent(new PointerEvent("pointercancel", { pointerId: (window as unknown as { lastPointerId: number }).lastPointerId, bubbles: true })));
  await page.mouse.up();
  await expect(pager).toHaveAttribute("data-page", "0");
  await expect(dialog).toBeVisible();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x - 15 * i, from.y);
    await page.waitForTimeout(20);
  }
  expect(await moved()).toEqual(rest);
  await page.mouse.up();
  await expect(pager).toHaveAttribute("data-page", "1");
});

// Travel's group of turning photos is on the page after its first paragraph's; which page that is depends on how the words fit (Mentorship's
// group, beside its mentors, is dealt out a photo a page at 390 by 844).
async function toGroup(dialog: Locator) {
  const at = await dialog.locator("[data-pager-page]").evaluateAll((els) => els.findIndex((el) => el.querySelector("[data-rotator]")));
  await dialog.locator(`[data-pager-dot="${at}"]`).click();
  return dialog.locator(`[data-pager-page="${at}"] [data-rotator]`);
}

test("pager turns: a page's group turns in its stage only while its page is current, its marks inside the current photo's corner", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "travel");
  const group = dialog.locator("[data-rotator]");
  await page.waitForTimeout(GALLERY.mask.landingMs + GALLERY.rotate.delayMs + 400);
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await toGroup(dialog);
  await expect(group).toHaveAttribute("data-rotator-runs", "");
  await expect(group).toHaveAttribute("data-rotator-index", "1", { timeout: GALLERY.rotate.intervalMs + 2000 });
  await page.waitForTimeout(GALLERY.rotate.changeMs + 150);
  const marks = (await group.locator("[data-rotator-marks]").boundingBox())!;
  const photo = (await group.locator('[data-rotator-layer="1"]').boundingBox())!;
  const inset = GALLERY.rotate.marksInsetPx;
  expect(Math.abs(photo.x + photo.width - inset - (marks.x + marks.width))).toBeLessThan(1.5);
  expect(Math.abs(photo.y + photo.height - inset - (marks.y + marks.height))).toBeLessThan(1.5);
});

test("pager turns: a tap on the stage steps the group at once, Enter steps it, and a press held over 500ms only holds it", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "travel");
  const group = await toGroup(dialog);
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  const frame = group.locator("[data-rotator-frame]");
  await frame.click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  await frame.focus();
  await page.keyboard.press("Enter");
  await expect(group).toHaveAttribute("data-rotator-index", "2");
  const center = await centerOf(frame);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await page.waitForTimeout(GALLERY.rotate.holdMs + 200);
  await page.mouse.up();
  await expect(group).toHaveAttribute("data-rotator-index", "2");
});

test("pager turns: under reduced motion the group never turns on its own, and a tap steps it with no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "travel", { home: false });
  const group = await toGroup(dialog);
  await page.waitForTimeout(GALLERY.mask.landingMs + GALLERY.rotate.delayMs + 400);
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await group.locator("[data-rotator-frame]").click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  expect(await group.locator("[data-rotator-layer]").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.clipPath))).toEqual(["", "", ""]);
});
