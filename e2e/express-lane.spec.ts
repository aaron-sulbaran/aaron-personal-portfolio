import { siteContent } from "@/lib/content";
import { quickCopy, quickEntries } from "@/lib/content/quick";
import { INVITE_KEY } from "@/lib/quick/invite";
import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import type { Page } from "@playwright/test";

// The Express lane (docs/superpowers/specs/2026-10-13-express-lane-design.md):
// its tiles open the cards' own modals, the first-visit invite asks once, the
// transition runs both ways and lands focus on the new page's heading, and the
// lane never fetches the Coil's chunk. The invite is the subject here, so the
// suite's default of a dismissed invite is switched off.
test.use({ inviteDismissed: false });

const tile = (page: Page, slot: string) => page.locator(`main button[data-quick-slot="${slot}"]`);
const homeReady = (page: Page) => expect(page.locator("html")).toHaveAttribute("data-home", "ready", { timeout: 20_000 });
const idle = (page: Page) => expect(page.locator("[data-transition]")).toHaveAttribute("data-transition", "idle", { timeout: 10_000 });

test("express lane: every tile opens its own card's modal, Escape closes it and focus returns to the tile", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.locator("h1")).toHaveAccessibleName(quickCopy.title);
  await expect(page.locator("[data-quick-hint]")).toHaveText(quickCopy.hint);
  for (const entry of quickEntries) {
    const button = tile(page, entry.slot);
    await button.click();
    const dialog = page.locator(`[role="dialog"][data-card-modal="${entry.id}"]`);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2").first()).toHaveText(siteContent.cards[entry.id].modal.title);
    await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

test("express lane: the page reads whole at first paint and never requests the scene's chunk", async ({ page }) => {
  const scripts = watchScripts(page);
  await page.goto("/quick");
  await page.waitForLoadState("networkidle");
  for (const year of ["2021", "2022", "2023", "2024", "2025", "2026"]) await expect(page.locator(`#year-${year} h2`)).toHaveText(year);
  await expect(page.locator("main h2").first()).toHaveText("2026");
  await expect(page.locator("main button[data-card]")).toHaveCount(quickEntries.length);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
  expect(await scripts.sceneChunks()).toEqual([]);
});

test("express lane: the first-visit invite shows once, and never again once dismissed", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  const pill = page.locator('[data-express-invite="pill"]');
  const toast = page.locator('[data-express-invite="toast"]');
  await expect(toast).toBeVisible({ timeout: 6_000 });
  await expect(pill).toHaveCount(0);
  await toast.getByRole("button", { name: quickCopy.invite.no }).click();
  await expect(pill).toHaveCount(0);
  await expect(toast).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), INVITE_KEY)).toBe("dismissed");
  await page.reload();
  await homeReady(page);
  await page.waitForTimeout(3_000);
  await expect(pill).toHaveCount(0);
  await expect(toast).toHaveCount(0);
});

test("express lane: the invite never shows on a deep landing past the hero", async ({ page }) => {
  await page.goto("/#about");
  await homeReady(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(3_000);
  await expect(page.locator('[data-express-invite="pill"], [data-express-invite="toast"]')).toHaveCount(0);
});

test("express lane: the transition runs both ways and lands focus on each page's heading", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  await page.locator('[data-express-invite="toast"]').getByRole("button", { name: quickCopy.invite.yes }).click({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), INVITE_KEY)).toBe("used");

  await page.locator("main").getByRole("link", { name: quickCopy.back }).click();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-home", "ready");
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await page.goBack();
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
});

test("express lane: the Menu chip takes either page to the other", async ({ page }) => {
  await page.goto("/quick");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: quickCopy.back }).click();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: quickCopy.menuChip }).click();
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
});

// The tile pictures reveal on their own trigger, not the timeline's: a tile
// wholly on screen is never an empty frame, whatever the reading line has reached.
const clippedTilesInView = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button[data-quick-slot]")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      })
      .filter((button) => getComputedStyle(button.querySelector("[data-quick-thumb]")!).clipPath !== "none")
      .map((button) => button.dataset.quickSlot),
  );

for (const [name, viewport] of [["1280x900", { width: 1280, height: 900 }], ["390x844", { width: 390, height: 844 }]] as const) {
  test.describe(`express lane tile pictures at ${name}`, () => {
    test.use({ viewport });

    test("a tile wholly in view is unclipped within a second, wherever the reader stops", async ({ page }) => {
      await page.goto("/quick");
      await page.waitForLoadState("networkidle");
      const last = page.locator("main button[data-quick-slot]").last();
      await expect.poll(() => last.locator("[data-quick-thumb]").evaluate((el) => getComputedStyle(el).clipPath), { timeout: 3_000 }).not.toBe("none");

      const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      const stops = Math.ceil(height / 330);
      for (let i = 1; i <= stops; i++) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), Math.min(height, i * 330));
        await expect.poll(() => clippedTilesInView(page), { timeout: 1_500, message: `stop ${i} of ${stops}` }).toEqual([]);
      }
    });

    test("under reduced motion every picture shows at once", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/quick");
      await page.waitForLoadState("networkidle");
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-quick-thumb]")].filter((el) => getComputedStyle(el).clipPath !== "none").length), { timeout: 1_500 }).toBe(0);
    });
  });
}

// The rail follows the reader both ways: scrolling down lights the years the
// reading line has passed, scrolling back up un-lights them again.
test.describe("express lane rail at 1280x900", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the active checkpoint moves back up when the reader scrolls back up", async ({ page }) => {
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    const litYears = () => page.evaluate(() => document.querySelectorAll('[data-quick-key^="year-"][data-lit="true"]').length);
    const years = await page.locator('[data-quick-key^="year-"]').count();
    expect(years).toBeGreaterThan(2);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect.poll(litYears, { timeout: 4_000 }).toBe(years);
    const middle = await page.evaluate(() => {
      const heads = [...document.querySelectorAll<HTMLElement>('[data-quick-key^="year-"]')];
      const target = heads[Math.floor(heads.length / 2)];
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.7 + 10, behavior: "instant" });
      return Math.floor(heads.length / 2) + 1;
    });
    await expect.poll(litYears, { timeout: 4_000 }).toBe(middle);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(litYears, { timeout: 4_000 }).toBeLessThan(middle);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect.poll(litYears, { timeout: 4_000 }).toBe(years);
  });

  test("a tile picture, once revealed, stays revealed when the reader scrolls back up", async ({ page }) => {
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const last = page.locator("main button[data-quick-slot]").last();
    await expect.poll(() => last.locator("[data-quick-thumb]").evaluate((el) => getComputedStyle(el).clipPath), { timeout: 3_000 }).toBe("none");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(800);
    expect(await last.locator("[data-quick-thumb]").evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
  });
});

// The title, M(inimum) V(iable) P(ortfolio): a tight "MVP" at first paint with
// every rest's slot at width 0, the slots opening once after the page settles and
// the title is in view, replayed by a click or Enter (never by a hover), the room
// of the finished title reserved so nothing below it moves, and the whole title
// at once under reduced motion.
const SPELLED = "M(inimum) V(iable) P(ortfolio)";
const restOpacities = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-mvp-rest]")].map((el) => Number(getComputedStyle(el).opacity)));
const slotWidths = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-mvp-slot]")].map((el) => el.getBoundingClientRect().width));
const trackFirstSlot = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __min: number };
    w.__min = Infinity;
    const slot = document.querySelector<HTMLElement>("[data-mvp-slot]")!;
    const tick = () => {
      w.__min = Math.min(w.__min, slot.getBoundingClientRect().width);
      requestAnimationFrame(tick);
    };
    tick();
  });
const minFirstSlot = (page: Page) => page.evaluate(() => (window as unknown as { __min: number }).__min);

for (const [name, viewport] of [["1280x900", { width: 1280, height: 900 }], ["390x844", { width: 390, height: 844 }]] as const) {
  test.describe(`express lane title at ${name}`, () => {
    test.use({ viewport });

    test("MVP reads tight at first paint, unfolds once, never moves what is below, and is one heading name", async ({ page }) => {
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const intro = document.querySelector<HTMLElement>("header p");
          (window as unknown as Record<string, unknown>).__first = {
            opacities: [...document.querySelectorAll<HTMLElement>("[data-mvp-rest]")].map((el) => Number(getComputedStyle(el).opacity)),
            widths: [...document.querySelectorAll<HTMLElement>("[data-mvp-slot]")].map((el) => el.getBoundingClientRect().width),
            introTop: intro?.getBoundingClientRect().top,
          };
        });
      });
      await page.goto("/quick");
      const first = await page.evaluate(() => (window as unknown as { __first: { opacities: number[]; widths: number[]; introTop: number } }).__first);
      expect(first.opacities).toEqual([0, 0, 0]);
      expect(first.widths).toEqual([0, 0, 0]);
      const h1 = page.locator("h1");
      await expect(h1).toHaveAccessibleName(quickCopy.title);
      await expect(h1.locator("span").first()).toHaveAttribute("aria-hidden", "true");
      await expect(h1.locator("[data-mvp-ghost]")).toHaveText(SPELLED);
      await expect(h1).toHaveAttribute("data-state", "open", { timeout: 4_000 });
      expect(await restOpacities(page)).toEqual([1, 1, 1]);
      for (const width of await slotWidths(page)) expect(width).toBeGreaterThan(40);
      const introTop = await page.locator("header p").first().evaluate((el) => el.getBoundingClientRect().top);
      expect(introTop).toBeCloseTo(first.introTop, 0);
    });

    test("a click or Enter plays the unfold again, a hover does not", async ({ page }) => {
      await page.goto("/quick");
      const h1 = page.locator("h1");
      await expect(h1).toHaveAttribute("data-state", "open", { timeout: 4_000 });
      await trackFirstSlot(page);
      await h1.hover();
      await page.waitForTimeout(1_200);
      expect(await minFirstSlot(page)).toBeGreaterThan(40);

      await h1.click();
      await expect.poll(() => minFirstSlot(page), { timeout: 2_000 }).toBeLessThan(5);
      await expect.poll(() => slotWidths(page).then((w) => Math.min(...w)), { timeout: 4_000 }).toBeGreaterThan(40);

      await page.evaluate(() => (window as unknown as { __min: number }).__min = Infinity);
      await h1.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => minFirstSlot(page), { timeout: 2_000 }).toBeLessThan(5);
      await expect.poll(() => slotWidths(page).then((w) => Math.min(...w)), { timeout: 4_000 }).toBeGreaterThan(40);
    });

    test("the room under the title is the finished title's, so the intro never moves through an unfold", async ({ page }) => {
      await page.goto("/quick");
      const intro = page.locator("header p").first();
      const top = () => intro.evaluate((el) => el.getBoundingClientRect().top);
      const before = await top();
      const seen: number[] = [];
      for (let i = 0; i < 12; i++) {
        seen.push(await top());
        await page.waitForTimeout(250);
      }
      for (const value of seen) expect(Math.abs(value - before)).toBeLessThan(0.5);
    });

    test("under reduced motion the whole title shows at once", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/quick");
      await expect(page.locator("h1 [data-mvp-ghost]")).toHaveText(SPELLED);
      expect(await restOpacities(page)).toEqual([1, 1, 1]);
      for (const width of await slotWidths(page)) expect(width).toBeGreaterThan(40);
    });
  });
}
