import type { Page } from "@playwright/test";
import { homeDeck } from "@/lib/card/deck";
import type { CardKey } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardDialog, cardRow, flyCard, openCardFromBook } from "./support/cards";

// What a run may leave behind in the page: a split line, a held line's break,
// an armed body, or an inline clip-path, GSAP scale or held wrapping anywhere
// in a card's modal body. (The panel sits outside the body and rises on its
// own inline transform; the mask-in never writes it.)
async function leftovers(page: Page) {
  return page.evaluate(() => ({
    lines: document.querySelectorAll(".card-line, br[data-mask-break]").length,
    armed: document.querySelectorAll("[data-mask-armed]").length,
    written: [...document.querySelectorAll<HTMLElement>("[data-card-body] [style]")].filter((el) => el.style.clipPath !== "" || /scale\(/.test(el.style.transform) || el.style.whiteSpace !== "").length,
  }));
}
const CLEAN = { lines: 0, armed: 0, written: 0 };

// Where each split part of a card's modal breaks its lines. While the run is
// live, the split's own lines; once it is done, where the browser wraps the
// same text (a glyph that drops below the line before it starts a new one).
// A part with no glyph on screen (a phone page out of view) comes back empty.
async function wraps(page: Page, key: CardKey): Promise<Record<string, string[]>> {
  return page.evaluate((key) => {
    const tidy = (text: string) => text.replace(/\s+/g, " ").trim();
    const parts = [...document.querySelectorAll<HTMLElement>(`[data-card-modal="${key}"] [data-mask-split]`)];
    return Object.fromEntries(parts.map((part) => {
      const split = [...part.querySelectorAll(".card-line")];
      if (split.length) return [part.dataset.mask ?? "", split.map((line) => tidy(line.textContent ?? ""))];
      const lines: string[] = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
      let top = -Infinity;
      let line = "";
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (let i = 0; i < text.length; i++) {
          if (/\S/.test(text[i])) {
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const glyph = range.getClientRects()[0];
            if (glyph && glyph.top > top + glyph.height / 2) {
              if (tidy(line)) lines.push(tidy(line));
              line = "";
              top = glyph.top;
            }
          }
          line += text[i];
        }
      }
      if (tidy(line)) lines.push(tidy(line));
      return [part.dataset.mask ?? "", lines];
    }));
  }, key);
}

// Opens every card in page 2's order and notes each part whose lines break in
// one place while it masks in and another once the run is done (Aaron, Nov 9:
// the family business's words jumped as its reveal ended, at "small-business").
async function movedAtTheEnd(page: Page): Promise<string[]> {
  const moved: string[] = [];
  for (const key of homeDeck) {
    const row = cardRow(page, key);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    const dialog = cardDialog(page, key);
    await page.waitForFunction((key) => !!document.querySelector(`[data-card-modal="${key}"] [data-mask-armed] .card-line`), key, { polling: "raf", timeout: 5000 });
    const live = await wraps(page, key);
    await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
    const rest = await wraps(page, key);
    for (const [id, lines] of Object.entries(live)) {
      if (rest[id]?.length && JSON.stringify(rest[id]) !== JSON.stringify(lines)) moved.push(`${key} ${id}: ${JSON.stringify(lines)} then ${JSON.stringify(rest[id])}`);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  return moved;
}

test("masks: a card's modal masks in on a timer and leaves nothing behind", async ({ page }) => {
  await openHome(page);
  const opened = Date.now();
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await expect(dialog.locator('[data-mask="title"] .card-line').first()).toBeAttached();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(Date.now() - opened).toBeLessThan(3500);
  expect(await leftovers(page)).toEqual(CLEAN);
});

test("masks: a photo's clip edge travels left to right, and each line's clip opens left to right in place", async ({ page }) => {
  await openCardFromBook(page, "capital-one");
  const photo = await page.waitForFunction(() => {
    const clip = document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-mask="photo-0"]')?.style.clipPath ?? "";
    const inset = clip.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat);
    return inset && inset[1] > 1 && inset[1] < 99 ? inset : null;
  }, null, { polling: "raf", timeout: 5000 });
  const [top, right, bottom, left] = (await photo.jsonValue())!;
  expect([top, bottom, left]).toEqual([0, 0, 0]);
  expect(right).toBeGreaterThan(1);
  const line = await page.waitForFunction(() => {
    const clip = document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-mask="words-0"] .card-line')?.style.clipPath ?? "";
    const inset = clip.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat);
    return inset && inset[1] > -2 && inset[1] < 102 ? inset : null;
  }, null, { polling: "raf", timeout: 5000 });
  const parts = (await line.jsonValue())!;
  expect([parts[0], parts[2], parts[3]]).toEqual([-25, -25, -2]);
});

test("masks: Escape in the middle of the run leaves nothing behind, and the next open replays from the start", async ({ page }) => {
  const { row, dialog } = await openCardFromBook(page, "capital-one");
  await page.waitForFunction(() => !!document.querySelector('[data-card-modal="capital-one"] [data-mask="words-0"] .card-line'), null, { polling: "raf" });
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await leftovers(page)).toEqual(CLEAN);
  await row.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await expect(dialog.locator('[data-mask="title"] .card-line').first()).toBeAttached();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(await leftovers(page)).toEqual(CLEAN);
});

test("masks: a flown card's photo never masks, while its caption does", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo", { parked: false });
  const sample = await page.waitForFunction((k) => {
    const dialog = document.querySelector(`[data-card-modal="${k}"]`);
    const slot = dialog?.querySelector<HTMLElement>('[data-tile-slot="photo"]');
    const caption = dialog?.querySelector<HTMLElement>('[data-mask="caption-0"] .card-line');
    return slot && caption?.style.clipPath ? { slot: slot.style.clipPath, caption: caption.style.clipPath } : null;
  }, key, { polling: "raf", timeout: 5000 });
  const { slot, caption } = (await sample.jsonValue())!;
  expect(slot).toBe("");
  expect(caption).toMatch(/^inset\(/);
});

test("masks: under reduced motion nothing masks, and turning it on mid-run shows every part at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  expect(await leftovers(page)).toEqual(CLEAN);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await cardRow(page, "capital-one").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 1000 });
  expect(await leftovers(page)).toEqual(CLEAN);
});

// Fourteen opens, each a whole run, outlast the default test timeout.
test("masks: every card's text breaks its lines where they will rest, so nothing moves when the run ends", async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  expect(await movedAtTheEnd(page)).toEqual([]);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("masks: every card's text breaks its lines where they will rest, so nothing moves when the run ends", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await page.waitForFunction(() => document.documentElement.dataset.home === "ready");
    expect(await movedAtTheEnd(page)).toEqual([]);
  });
});
