import type { Locator, Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf, headerTileOf } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { phonePages } from "@/lib/gallery/plan";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardDialog, flyCard, openCardFromBook, panelAtRest } from "./support/cards";

// The phone gallery at 390 by 844 (a fine pointer: the pager follows the
// width, a Coil click flies as it does on a desktop, and a mouse drag is a
// pointer drag like a finger's).
test.use({ viewport: { width: 390, height: 844 } });

const g = siteContent.modals.gallery;
const keys = Object.keys(siteContent.cards) as CardKey[];
const PAGED = keys.filter((key) => galleryOf(key).plan.slides.length > 0);

test("pager: a phone opens one page a paragraph, the header above the pages and the controls under them", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
  const count = phonePages(galleryOf("capital-one").plan, PHONE_GROUPING).length;
  await expect(dialog.locator("[data-pager-page]")).toHaveCount(count);
  const header = (await dialog.locator("[data-pager] h2").boundingBox())!;
  const viewport = (await dialog.locator("[data-pager-viewport]").boundingBox())!;
  expect(header.y + header.height).toBeLessThanOrEqual(viewport.y);
  const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
  expect(Math.abs(panel.height - (844 - GALLERY.pager.sheetInsetPx))).toBeLessThan(2);
  await expect(dialog.getByRole("button", { name: g.previousPage })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: g.pageNumber(1, count) })).toHaveAttribute("aria-current", "true");
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await expect(dialog.locator('[data-pager-page="0"]')).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "2");
  await expect(dialog.getByRole("button", { name: g.nextPage })).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
});

test("pager: Mentorship's mentors and its link ride on its last page", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  await expect(dialog.locator('[data-pager-page="1"] [data-mentors]')).toHaveCount(1);
  await expect(dialog.locator('[data-pager-page="1"] a', { hasText: siteContent.cards.mentorship.modal.links[0].label })).toHaveCount(1);
  await expect(dialog.locator('[data-pager-page="0"] [data-mentors]')).toHaveCount(0);
});

test("pager: every photo is whole in its stage, and no stage is taller than 40 percent of the height", async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  for (const key of PAGED) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const problems = await dialog.evaluate((root, cap) => {
      const out: string[] = [];
      root.querySelectorAll("[data-pager-page]").forEach((pageEl) => {
        const stage = pageEl.querySelector("[data-pager-stage]");
        if (!stage) return;
        const box = stage.getBoundingClientRect();
        const at = pageEl.getAttribute("data-pager-page");
        if (box.height > cap + 0.5) out.push(`page ${at}: stage ${box.height}px`);
        stage.querySelectorAll("[data-photo-frame]").forEach((photo) => {
          const r = photo.getBoundingClientRect();
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5 || r.right > box.right + 0.5) out.push(`page ${at}: photo ${photo.getAttribute("data-photo-frame")} cropped`);
        });
      });
      return out;
    }, 844 * GALLERY.pager.stageMax);
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

test("pager: Talos's mark in the phone header's tile is never under its kit's 20px", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "talos");
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
  const capital = await openCardFromBook(page, "capital-one", { settled: true });
  const next = capital.dialog.getByRole("button", { name: g.nextPage });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(capital.dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await page.keyboard.press("Enter");
  await expect(capital.dialog.locator("[data-pager]")).toHaveAttribute("data-page", "2");
  await expect(next).toBeDisabled();
  await expect(capital.dialog.getByRole("button", { name: g.previousPage })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(capital.dialog).toHaveCount(0);

  const { dialog } = await openCardFromBook(page, "misuki", { home: false, settled: true });
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  const tip = dialog.getByRole("button", { name: "Fast and Furious", exact: true });
  await tip.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "0");
  await expect(dialog.getByRole("button", { name: g.pageNumber(1, 2) })).toBeFocused();

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

test("pager: a sideways drag turns one page, a short one springs back, and past the start it stays", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one", { settled: true });
  const pager = dialog.locator("[data-pager]");
  const stage = (i: number) => dialog.locator(`[data-pager-page="${i}"] [data-pager-stage]`);
  await slowDrag(page, await centerOf(stage(0)), { x: 120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await slowDrag(page, await centerOf(stage(0)), { x: -30, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await slowDrag(page, await centerOf(stage(0)), { x: -120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "1");
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  await slowDrag(page, await centerOf(stage(1)), { x: 120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await expect(dialog).toBeVisible();
});

test("pager: a vertical drag on the stage springs back short of 96px and closes the modal past it", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one", { settled: true });
  const panel = dialog.locator("[data-gallery-panel]");
  const before = (await panel.boundingBox())!.y;
  const stage = dialog.locator('[data-pager-page="0"] [data-pager-stage]');
  await slowDrag(page, await centerOf(stage), { x: 0, y: 60 });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.y)).toBe(Math.round(before));
  await slowDrag(page, await centerOf(stage), { x: 0, y: 130 });
  await expect(dialog).toHaveCount(0);
});

test("pager: long words scroll in their own area and never dismiss, while a drag on the stage still does", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
  const first = dialog.locator('[data-pager-page="0"]');
  const words = first.locator("[data-pager-text]");
  await expect(words).toHaveAttribute("data-scrolls", "");
  await slowDrag(page, await centerOf(words), { x: 0, y: -150 });
  await slowDrag(page, await centerOf(words), { x: 0, y: 150 });
  await expect(dialog).toBeVisible();
  const middle = await centerOf(words);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => words.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(dialog).toBeVisible();
  await slowDrag(page, await centerOf(first.locator("[data-pager-stage]")), { x: 0, y: 130 });
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
