import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf } from "@/lib/gallery/card";
import { test, expect } from "./support/fixtures";
import { openHome, waitForCoilSettled } from "./support/coil";
import { openCardFromBook } from "./support/cards";

// Aaron's look at the fourteen, by hand and never in a normal run: the Coil
// and two modals at a desktop and a phone size in both themes, where each
// card's first gallery row ends against the fold, and which book metas wrap.
// CARD_LOOK_DIR names the folder; without it every test here skips.
const DIR = process.env.CARD_LOOK_DIR ?? "";
const SIZES = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
const MODALS: CardKey[] = ["mentorship", "capital-one"];
const keys = Object.keys(siteContent.cards) as CardKey[];

test.skip(!DIR, "manual capture for Aaron's look at the fourteen");

// The custom cursor draws itself where the pointer is; a capture hides it.
async function hideCursor(page: Page) {
  await page.addStyleTag({ content: ".z-\\[100\\]{visibility:hidden!important}" });
}

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`look: the Coil and two modals at ${size.name} in ${theme}`, async ({ page }) => {
      test.setTimeout(90_000);
      mkdirSync(DIR, { recursive: true });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme });
      await openHome(page);
      await hideCursor(page);
      await waitForCoilSettled(page);
      await page.screenshot({ path: join(DIR, `coil-${size.name}-${theme}.png`) });
      for (const key of MODALS) {
        const { dialog } = await openCardFromBook(page, key, { home: false, settled: true });
        await page.screenshot({ path: join(DIR, `modal-${key}-${size.name}-${theme}.png`) });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    });
  }
}

test("look: where each card's first row ends against the fold, and which book metas wrap at 1440", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(DIR, { recursive: true });
  const measures: Record<string, unknown> = {};
  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await openHome(page);
    const bottoms: Record<string, number | null> = {};
    for (const key of keys) {
      if (!galleryOf(key).plan.slides.length) {
        bottoms[key] = null;
        continue;
      }
      const { dialog } = await openCardFromBook(page, key, { home: false });
      const first = (await dialog.locator('[data-row="photo"]').first().boundingBox())!;
      bottoms[key] = Math.round(first.y + first.height);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
    measures[`first row bottom at ${size.width} by ${size.height}, fold ${size.height}`] = bottoms;
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  measures["book metas that wrap under their titles at 1440"] = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#work button.book-row")]
      .filter((row) => {
        const [title, meta] = [row.children[0], row.children[1]].map((el) => el.getBoundingClientRect());
        return meta.top >= title.bottom - 1;
      })
      .map((row) => row.dataset.card),
  );
  writeFileSync(join(DIR, "measures.json"), `${JSON.stringify(measures, null, 2)}\n`);
});
