import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome } from "./support/coil";
import { settled } from "./support/fallback";
import type { HookWindow } from "./support/hooks";
import { noWebgl2Api } from "./support/webgl";
// The Coil and Band toggle (lab log, "Controls lab"): a capsule at the
// hero's bottom left that pulls the coil into the entrance's band and back,
// shown only while a scene runs and the entrance has rested.
const labels = siteContent.hero.shapeToggle;
const toggle = (page: Page) => page.getByRole("group", { name: labels.ariaLabel });
const half = (page: Page, name: string) => toggle(page).getByRole("button", { name, exact: true });
const shape = (page: Page) => page.evaluate(() => (window as HookWindow).__coil!.shape());
const cardCount = async (page: Page) => Number((await page.evaluate(() => (window as HookWindow).__coil!.budget())).cards);
async function waitForPull(page: Page, pull: 0 | 1) {
  await page.waitForFunction((p) => (window as HookWindow).__coil!.shape().pull === p, pull, { timeout: 5_000 });
  await nextFrames(page, 2);
}
test("toggle: hidden through the loader and the entrance, then shown with Coil pressed", async ({ page }) => {
  await page.addInitScript(() => {
    const seen: boolean[] = ((window as unknown as { __toggleSeen: boolean[] }).__toggleSeen = []);
    const tick = () => {
      const el = document.querySelector("[data-shape-toggle]");
      if (document.documentElement.dataset.home !== "ready") seen.push(!!el && el.checkVisibility({ visibilityProperty: true }));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openHome(page);
  const before = await page.evaluate(() => (window as unknown as { __toggleSeen: boolean[] }).__toggleSeen);
  expect(before.length, "frames sampled before ready").toBeGreaterThan(0);
  expect(before.filter(Boolean), "frames showing the toggle before ready").toEqual([]);
  await expect(toggle(page)).toBeVisible();
  await expect(half(page, labels.coil)).toHaveAttribute("aria-pressed", "true");
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "false");
  expect(await shape(page)).toMatchObject({ target: "coil", pull: 1 });
});
test("toggle: Band pulls the coil into the entrance's band over the pull, Coil winds it back", async ({ page }) => {
  await openHome(page);
  const cards = await cardCount(page);
  await page.evaluate(() => {
    const w = window as HookWindow & { __held?: number[] };
    const held: number[] = (w.__held = []);
    const tick = () => {
      const now = w.__coil!.shape();
      if (now.progress > 0 && now.progress < 1) held.push(w.__coil!.offset());
      if (now.pull !== 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const startedAt = await page.evaluate(() => performance.now());
  await half(page, labels.band).click();
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(() => (window as HookWindow).__coil!.shape().pull === 0, null, { timeout: 5_000 });
  const tookMs = (await page.evaluate(() => performance.now())) - startedAt;
  expect(tookMs, "the switch animates over the pull").toBeGreaterThan(COIL.toggle.durationMs * 0.8);
  await nextFrames(page, 2);
  const band = await shape(page);
  expect(band.angStep).toBeCloseTo(band.bandAngStep, 9);
  expect(band.shown, "one copy of each card").toBe(cards);
  const held = await page.evaluate(() => (window as unknown as { __held: number[] }).__held);
  expect(held.length, "frames sampled mid-switch").toBeGreaterThan(10);
  expect(new Set(held).size, "the strand holds through the switch").toBe(1);
  await half(page, labels.coil).click();
  await waitForPull(page, 1);
  const coil = await shape(page);
  expect(coil.angStep).toBe(coil.restAngStep);
  expect(coil.shown).toBeGreaterThan(cards);
});
test("toggle: the keyboard reaches each half and Space or Enter picks it", async ({ page }) => {
  await openHome(page);
  await half(page, labels.coil).focus();
  await page.keyboard.press("Tab");
  await expect(half(page, labels.band)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "true");
  await waitForPull(page, 0);
  await page.keyboard.press("Shift+Tab");
  await expect(half(page, labels.coil)).toBeFocused();
  await page.keyboard.press("Enter");
  await waitForPull(page, 1);
});
test("toggle: cross-fades its seat to the unwound list's Coil control, and comes back in the band", async ({ page }) => {
  await openHome(page);
  await half(page, labels.band).click();
  await waitForPull(page, 0);
  await page.evaluate(() => {
    const seat: number[][] = ((window as unknown as { __seat: number[][] }).__seat = []);
    const op = (sel: string) => Number(getComputedStyle(document.querySelector(sel)!).opacity);
    const tick = () => {
      seat.push([op("[data-shape-toggle]"), op("section[data-scene] button.fx")]);
      if (seat.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => (window as HookWindow).__coil!.api.unwind(true));
  await page.waitForFunction(() => (window as HookWindow).__coil!.unwindState().progress === 1, null, { timeout: 5_000 });
  await expect(toggle(page)).toBeHidden();
  const seat = await page.evaluate(() => (window as unknown as { __seat: number[][] }).__seat);
  expect(seat.filter(([a, b]) => Math.abs(a + b - 1) > 0.01), "one cross-fade, the seat never empty").toEqual([]);
  // The wind-back: the toggle stays inert until the list's progress is back at 0.
  await page.evaluate(() => {
    const w = window as HookWindow & { __back?: [number, boolean][] };
    const back: [number, boolean][] = (w.__back = []);
    const tick = () => {
      const progress = w.__coil!.unwindState().progress;
      back.push([progress, document.querySelector("[data-shape-toggle]")!.closest("[inert]") !== null]);
      if (progress > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => (window as HookWindow).__coil!.api.unwind(false));
  await page.waitForFunction(() => (window as HookWindow).__coil!.unwindState().progress === 0, null, { timeout: 5_000 });
  await nextFrames(page, 2);
  const back = await page.evaluate(() => (window as unknown as { __back: [number, boolean][] }).__back);
  const windingBack = back.filter(([progress]) => progress > 0);
  expect(windingBack.length, "frames sampled on the wind-back").toBeGreaterThan(10);
  expect(windingBack.filter(([, inert]) => !inert), "the toggle is inert while the list winds back").toEqual([]);
  expect(await page.evaluate(() => document.querySelector("[data-shape-toggle]")!.closest("[inert]") !== null)).toBe(false);
  await expect(toggle(page)).toBeVisible();
  expect(await shape(page)).toMatchObject({ pull: 0, shown: await cardCount(page) });
});
test("toggle: on a phone-width pane the first-visit line clears it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const overlap = await page.evaluate((text) => {
    const line = document.querySelector<HTMLElement>("[data-hint-line]")!;
    line.textContent = text;
    const a = line.getBoundingClientRect();
    const b = document.querySelector("[data-shape-toggle]")!.getBoundingClientRect();
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }, siteContent.hero.hints.tapCard);
  expect(overlap).toBe(0);
});
// The overlay (and the toggle in it) is always rendered; without a scene the
// overlay's root keeps it hidden (visibility), so it is neither seen nor reachable.
async function expectNoToggle(page: Page) {
  await page.goto("/");
  await settled(page);
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
  const el = page.locator("[data-shape-toggle]");
  await expect(el).toHaveCount(1);
  await expect(el).toBeHidden();
  await expect(toggle(page)).toBeHidden();
}
test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("toggle: no scene, no toggle", async ({ page }) => expectNoToggle(page));
});
test("toggle: the still fallback (no WebGL 2) has no toggle", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  await expectNoToggle(page);
});
