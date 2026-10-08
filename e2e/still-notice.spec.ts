import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { STILL_NOTICE_KEY } from "@/lib/home/stillNotice";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled, watchHydration } from "./support/fallback";
import { shoot } from "./support/pixels";
import { noWebgl2Api, noWebglContext } from "./support/webgl";

// The still page's notice: one quiet line at the foot of the hero saying why
// the page is still, a status (never a dialog), dismissed for good by "Got it".

const copy = siteContent.hero.still;
const notice = (page: Page) => page.locator("[data-still-notice]");
const dismiss = (page: Page) => notice(page).getByRole("button", { name: copy.dismiss });

async function expectNotice(page: Page, text: string) {
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toHaveAttribute("role", "status");
  await expect(notice(page)).toContainText(text);
  await expect(dismiss(page)).toBeVisible();
}

test("no WebGL 2: the notice says why, and Got it dismisses it for good", async ({ page }) => {
  const hydration = watchHydration(page);
  await page.addInitScript(noWebgl2Api);
  await page.goto("/");
  await settled(page);
  await expectNotice(page, copy.noWebgl);
  await dismiss(page).click();
  await expect(notice(page)).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STILL_NOTICE_KEY)).toBe("1");
  await page.reload();
  await settled(page);
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
  await expect(notice(page)).toHaveCount(0);
  expect(hydration).toEqual([]);
});

test("a context that cannot be created: the same notice, after the h1, dismissed from the keyboard, focus to the h1", async ({ page }) => {
  await page.addInitScript(noWebglContext);
  await page.goto("/");
  await settled(page);
  await expectNotice(page, copy.noWebgl);
  const order = await page.evaluate(() => {
    const h1 = document.getElementById("hero-heading")!;
    const status = document.querySelector("[data-still-notice]")!;
    return { after: !!(h1.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING), inHero: status.parentElement === h1.closest("section") };
  });
  expect(order.after, "the notice follows the h1 in the DOM").toBe(true);
  expect(order.inHero, "the notice sits in the hero section itself").toBe(true);
  await dismiss(page).focus();
  await page.keyboard.press("Enter");
  await expect(notice(page)).toHaveCount(0);
  const focused = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    const alpha = Number(style.outlineColor.match(/rgba?\(([^)]+)\)/)?.[1].split(",")[3] ?? 1);
    return { id: document.activeElement?.id ?? "", ring: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 && alpha > 0 };
  });
  expect(focused.id, "focus lands on the h1").toBe("hero-heading");
  expect(focused.ring, "with no ring drawn around the whole hero").toBe(false);
  await expect(page.locator("#hero-heading")).toHaveAttribute("tabindex", "-1");
});

test("a scene that throws: the notice says it could not start", async ({ page }) => {
  await page.goto("/?coildebug=throw=render");
  await settled(page);
  await expectNotice(page, copy.unavailable);
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("the notice names the motion setting", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await expectNotice(page, copy.reducedMotion);
  });
});

test("the scene on: no notice", async ({ page }) => {
  await openHome(page);
  await expect(notice(page)).toHaveCount(0);
});

const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

// The default viewport (the wide cut) and a phone (the narrow cut, the
// notice over a different part of the picture).
const cases = [null, { width: 390, height: 844 }].flatMap((viewport) => (["light", "dark"] as const).map((colorScheme) => ({ viewport, colorScheme })));
for (const { viewport, colorScheme } of cases) {
  const at = viewport ? ` at ${viewport.width}x${viewport.height}` : "";
  test(`the notice reads at 4.5:1 over the still in ${colorScheme}${at}`, async ({ page }) => {
    if (viewport) await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(noWebgl2Api);
    await page.goto("/");
    await settled(page);
    const still = page.locator("[data-hero-still]");
    await expect(still).toHaveAttribute("data-still-ready", "");
    await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    const text = notice(page).locator("p");
    await expect(text).toBeVisible();
    const { box, color } = await text.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { box: { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }, color: getComputedStyle(el).color };
    });
    await notice(page).evaluate((el) => (el.style.visibility = "hidden"));
    const behind = await shoot(page, box);
    const mean = [0, 0, 0];
    for (let i = 0; i < behind.rgba.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += behind.rgba[i + c];
    const pixels = behind.rgba.length / 4;
    const bg = mean.map((v) => v / pixels);
    const fg = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    test.info().annotations.push({ type: "contrast", description: ratio.toFixed(2) });
    expect(ratio, `notice text ${color} over the still`).toBeGreaterThanOrEqual(4.5);
  });
}
