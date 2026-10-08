import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";

// The top-left mark (components/mark): a click still scrolls to the top; a
// 650ms hold strikes and opens the card and swallows the click it ends with;
// an early release tastes the fill and drains; Enter or Space held does the
// same from the keyboard; reduced motion opens the card on the static mark.
// The cursor's ring paints the same fill as the mark.
//
// The mark is DOM and GSAP only, so every test runs twice: with the scene, and
// with WebGL taken away in the page (the poster hero, as Aaron's own browser
// shows it).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const Y = 600;
const CLOSE = siteContent.modals.closeAriaLabel;
const mark = (page: Page) => page.locator("[data-mark-trigger]");
const card = (page: Page) => page.getByRole("dialog", { name: siteContent.mark.dialogLabel });
const progress = async (page: Page) => Number(await mark(page).getAttribute("data-hold-progress"));
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function markBox(page: Page) {
  const box = await mark(page).boundingBox();
  if (!box) throw new Error("the mark is not on screen");
  return box;
}

async function pointAtMark(page: Page) {
  const box = await markBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function holdMark(page: Page, ms: number) {
  await pointAtMark(page);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

function blockWebGL(page: Page) {
  return page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === "webgl" || kind === "webgl2") return null;
      return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  });
}

for (const mode of ["scene", "no-webgl"] as const) {
  test.describe(mode, () => {
    if (mode === "no-webgl") test.beforeEach(({ page }) => blockWebGL(page));

    async function open(page: Page) {
      if (mode === "scene") return openHome(page);
      await page.goto("/");
      await settled(page);
      await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "off");
    }

    test(`mark: hover grows it 10px from its corner, and a click still scrolls to the top with no card (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      const side = Math.round((await markBox(page)).width);
      const grown = String((side + 10) / side).replace(".", "\\.");
      await pointAtMark(page);
      await expect(mark(page).locator("span").first()).toHaveAttribute("style", new RegExp(`scale\\(${grown}\\)`));
      await mark(page).click();
      await expect.poll(() => scrollY(page)).toBeLessThan(2);
      await sleep(1000);
      await expect(card(page)).toHaveCount(0);
    });

    test(`mark: a 700ms hold strikes and opens the card, and swallows the click it ends with (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await holdMark(page, 700);
      const dialog = card(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "cel");
      await expect.poll(() => dialog.locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await expect.poll(() => page.evaluate(() => document.querySelector<SVGElement>("[data-mark-ring]")?.style.opacity ?? "0")).toBe("0");
      await dialog.getByRole("button", { name: CLOSE }).click();
      await expect(dialog).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await mark(page).click();
      await expect.poll(() => scrollY(page)).toBeLessThan(2);
    });

    test(`mark: letting go at 300ms opens nothing and the fill drains @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await page.mouse.down();
      await sleep(300);
      const mid = await page.evaluate(() => ({
        fill: Number(document.querySelector<HTMLElement>("[data-mark-trigger]")!.dataset.holdProgress),
        arc: Number(document.querySelector<SVGElement>("[data-mark-ring]")!.dataset.ringArc),
      }));
      await page.mouse.up();
      expect(mid.fill).toBeGreaterThan(0.3);
      expect(mid.fill).toBeLessThan(0.75);
      expect(Math.abs(mid.arc / 75 - mid.fill)).toBeLessThan(0.002);
      await expect.poll(() => progress(page)).toBe(0);
      await sleep(600);
      await expect(card(page)).toHaveCount(0);
    });

    test(`mark: a quick tap shows at least 0.3 of the fill for 200ms, then drains (${mode})`, async ({ page }) => {
      await open(page);
      await pointAtMark(page);
      await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>("[data-mark-trigger]")!;
        const rec = { samples: [] as [number, number][], releasedAt: 0 };
        Object.assign(window, { __tap: rec });
        window.addEventListener("pointerup", () => (rec.releasedAt = performance.now()), { once: true });
        const start = performance.now();
        const tick = () => {
          rec.samples.push([performance.now(), Number(el.dataset.holdProgress)]);
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.down();
      await page.mouse.up();
      await sleep(1600);
      const { samples, releasedAt } = await page.evaluate(() => (window as unknown as { __tap: { samples: [number, number][]; releasedAt: number } }).__tap);
      const tasted = samples.filter(([t]) => t - releasedAt >= 110 && t - releasedAt <= 270).map(([, fill]) => fill);
      expect(tasted.length).toBeGreaterThan(5);
      expect(Math.min(...tasted)).toBeGreaterThanOrEqual(0.299);
      expect(samples.at(-1)?.[1]).toBe(0);
    });

    test(`mark: Enter held opens the card, its repeat cannot close it, Escape does and focus returns to the mark (${mode})`, async ({ page }) => {
      await open(page);
      await mark(page).focus();
      await page.keyboard.down("Enter");
      await expect(card(page)).toBeVisible();
      await expect(page.locator("[data-mark-ring]")).toHaveCount(0);
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.down("Enter");
      await page.keyboard.up("Enter");
      await sleep(300);
      await expect(card(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(card(page)).toHaveCount(0);
      await expect(mark(page)).toBeFocused();
    });

    test(`mark: Escape cancels a keyboard hold, and Space held opens the card without its release pressing Close (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await mark(page).focus();
      await page.keyboard.down("Enter");
      await sleep(300);
      await page.keyboard.press("Escape");
      await sleep(500);
      await page.keyboard.up("Enter");
      await sleep(400);
      await expect(card(page)).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await page.keyboard.down("Space");
      await expect(card(page)).toBeVisible();
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.up("Space");
      await sleep(300);
      await expect(card(page)).toBeVisible();
    });

    test.describe("reduced motion", () => {
      test.use({ contextOptions: { reducedMotion: "reduce" } });

      test(`mark: the hold opens the card on the static mark, with no strike (${mode})`, async ({ page }) => {
        await page.goto("/");
        await settled(page);
        await holdMark(page, 700);
        const dialog = card(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "static");
        await expect(dialog.locator('[data-part="cel"], [data-cel-night], [data-cel-flash]')).toHaveCount(0);
        await expect(dialog.locator('[data-card="surface"]')).toHaveCSS("opacity", "1");
      });
    });
  });
}
