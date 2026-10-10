import { siteContent, type CardKey } from "@/lib/content";
import { boxFor, groupFrame } from "@/lib/gallery/boxes";
import { galleryOf } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { slideWords } from "@/lib/gallery/plan";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { openCardFromBook } from "./support/cards";

// The desktop gallery at the suite's 1440 by 900: every card's rows as its
// plan lays them out, measured from the drawn modal.

const keys = Object.keys(siteContent.cards) as CardKey[];
const within = (actual: number, expected: number) => Math.abs(actual - expected) <= 1;

test("gallery rows: every card's rows follow its plan, the sides alternate, each photo in its orientation's box", async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  for (const key of keys) {
    const gallery = galleryOf(key);
    const { dialog } = await openCardFromBook(page, key, { home: false });
    await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
    const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
    expect(within(panel.width, gallery.panelWidth), `${key}: panel ${panel.width}, plan ${gallery.panelWidth}`).toBe(true);
    const rows = dialog.locator('[data-row="photo"]');
    await expect(rows).toHaveCount(gallery.plan.slides.length);
    for (const [i, slide] of gallery.plan.slides.entries()) {
      const row = rows.nth(i);
      await expect(row).toHaveAttribute("data-side", i % 2 === 0 ? "left" : "right");
      const boxes = slide.photos.map((photo) => boxFor(gallery.aspects[photo], BOXES, GALLERY.wideFrom));
      const expected = slide.photos.length > 1 ? groupFrame(boxes) : boxes[0];
      const drawn = (await row.locator(slide.photos.length > 1 ? "[data-rotator-frame]" : `[data-photo-frame="${slide.photo}"] > div`).first().boundingBox())!;
      expect(within(drawn.width, expected.width) && within(drawn.height, expected.height), `${key} row ${i}: ${drawn.width} by ${drawn.height}`).toBe(true);
      const words = await row.locator('[data-text-column] [data-mask^="words-"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")));
      expect(words, `${key} row ${i}`).toEqual(slideWords(slide).map((unit) => `words-${unit}`));
    }
    if (gallery.plan.slides.length) {
      const top = (await rows.first().boundingBox())!.y;
      for (const unit of gallery.plan.intro) {
        const opening = (await dialog.locator(`[data-mask="words-${unit}"]`).boundingBox())!;
        expect(opening.y + opening.height, `${key} opens with words ${unit}`).toBeLessThanOrEqual(top + 1);
      }
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("gallery rows: a photo card's picture leads its first row at 320 by 427 and carries the flight's slot", async ({ page }) => {
  await openHome(page);
  for (const key of keys.filter((k) => galleryOf(k).lead !== undefined)) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const slot = (await dialog.locator('[data-row="photo"]').first().locator('[data-tile-slot="photo"]').boundingBox())!;
    expect(within(slot.width, GALLERY.verticalWidth) && within(slot.height, (GALLERY.verticalWidth * 4) / 3), `${key}: ${slot.width} by ${slot.height}`).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("gallery rows: the first row clears the fold at 1440 by 900 on the cards the spec tests", async ({ page }) => {
  await openHome(page);
  for (const key of ["capital-one", "hackathons", "mentorship", "ieee"] as const) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const first = (await dialog.locator('[data-row="photo"]').first().boundingBox())!;
    expect(first.y + first.height, key).toBeLessThanOrEqual(900);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("gallery rows: a group's dots step its photo and its caption together, and its words stay", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  const group = dialog.locator("[data-rotator]");
  await group.scrollIntoViewIfNeeded();
  const column = dialog.locator('[data-row="photo"][data-turns] [data-text-column] [data-mask]');
  const words = await column.evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")));
  await group.getByRole("button", { name: siteContent.modals.gallery.photoOf(2, 3), exact: true }).click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  await expect(group.locator('[data-rotator-layer="1"]')).toHaveCSS("visibility", "visible");
  await expect(group.locator('[data-rotator-layer="0"]')).toHaveCSS("visibility", "hidden");
  await expect(group.locator('[data-rotator-caption="1"]')).toHaveCSS("visibility", "visible");
  await expect(group.locator('[data-rotator-caption="0"]')).toHaveCSS("visibility", "hidden");
  expect(await column.evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")))).toEqual(words);
});

test("gallery rows: no photo row sits without words, the band's card picture holds its first row's words and its first turned photo joins the next row's rotation", async ({ page }) => {
  await openHome(page);
  for (const key of keys.filter((k) => galleryOf(k).words.length > 0)) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const rows = dialog.locator('[data-row="photo"]');
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i).locator('[data-text-column] [data-mask^="words-"]').first(), `${key} row ${i}`).toHaveCount(1);
    }
    if (key === "band") {
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).not.toHaveAttribute("data-turns", /.*/);
      await expect(rows.first().locator('[data-tile-slot="photo"]')).toHaveCount(1);
      await expect(rows.first().locator('[data-text-column] [data-mask="words-0"]')).toHaveCount(1);
      await expect(rows.nth(1)).toHaveAttribute("data-turns", "2");
      await expect(rows.nth(1).locator("[data-rotator]")).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
