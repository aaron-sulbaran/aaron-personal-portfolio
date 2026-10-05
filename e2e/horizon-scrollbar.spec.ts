import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { documentTop, sweep } from "./support/wave";
import { MUTED_ARGS } from "./support/launch";

// A classic 15px scrollbar (headless Chromium hides scrollbars unless told
// otherwise, and a styled one is never an overlay). The scroll lock hides it
// and pads by --scrollbar-comp, so the strip keeps its width and its backing
// store, and stays as wide as the band (the two tracks share one train).
test.use({ launchOptions: { args: MUTED_ARGS, ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Counts writes to the strip canvas's backing store size.
    let sizings = 0;
    for (const prop of ["width", "height"] as const) {
      const own = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, prop)!;
      Object.defineProperty(HTMLCanvasElement.prototype, prop, {
        ...own,
        set(this: HTMLCanvasElement, value: number) {
          if (this.closest('[data-wave="horizon"]')) sizings++;
          own.set!.call(this, value);
        },
      });
    }
    Object.assign(window, { __e2eStripSizings: () => sizings });
    const style = () => {
      const tag = document.createElement("style");
      tag.textContent = "html::-webkit-scrollbar { width: 15px; }";
      document.head.appendChild(tag);
    };
    if (document.head) style();
    else document.addEventListener("DOMContentLoaded", style, { once: true });
  });
});

const widths = (page: Page) =>
  page.evaluate(() => ({
    scrollbar: window.innerWidth - document.documentElement.clientWidth,
    comp: getComputedStyle(document.documentElement).getPropertyValue("--scrollbar-comp").trim(),
    strip: document.querySelector<HTMLCanvasElement>('[data-wave="horizon"] canvas')!.clientWidth,
    stripStore: document.querySelector<HTMLCanvasElement>('[data-wave="horizon"] canvas')!.width,
    band: document.querySelector<HTMLCanvasElement>("#listen canvas")!.clientWidth,
    sizings: (window as unknown as { __e2eStripSizings: () => number }).__e2eStripSizings(),
  }));

test("horizon: a scroll lock does not resize the strip", async ({ page }) => {
  await openHome(page, { path: "/?wavedebug" });
  await scrollToY(page, Math.round(await documentTop(page, "#about")));
  await expect.poll(() => sweep(page)).toBeGreaterThan(0.99);
  const before = await widths(page);
  expect(before.scrollbar, "a classic scrollbar").toBe(15);
  expect(before.strip).toBe(page.viewportSize()!.width - 15);

  // What the scroll lock does (lib/modal.ts) with a 15px scrollbar.
  await page.evaluate(() => {
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "15px";
    document.documentElement.style.setProperty("--scrollbar-comp", "15px");
  });
  await page.waitForTimeout(100);
  await nextFrames(page, 2);
  const locked = await widths(page);
  expect(locked.scrollbar, "the lock hid the scrollbar").toBe(0);
  expect(locked.strip).toBe(before.strip);
  expect(locked.stripStore).toBe(before.stripStore);
  expect(locked.sizings, "strip backing store rebuilds under the lock").toBe(before.sizings);

  await page.evaluate(() => {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    document.documentElement.style.setProperty("--scrollbar-comp", "0px");
  });
  await page.waitForTimeout(100);
  await nextFrames(page, 2);
  const released = await widths(page);
  expect(released.scrollbar, "the scrollbar is back").toBe(15);
  expect(released.strip).toBe(before.strip);
  expect(released.sizings, "strip backing store rebuilds on release").toBe(before.sizings);
});

test("horizon: the band and the strip share one width with the Menu open and closed", async ({ page }) => {
  await openHome(page, { path: "/?wavedebug" });
  await scrollToY(page, Math.round(await documentTop(page, "#about")));
  const closed = await widths(page);
  expect(closed.scrollbar).toBe(15);
  expect(closed.strip).toBe(closed.band);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
  await nextFrames(page, 2);
  const open = await widths(page);
  expect(open.comp, "the lock's compensation").toBe("15px");
  expect(open.strip).toBe(open.band);
  expect(open.strip).toBe(closed.strip);

  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(page.getByRole("dialog", { name: "Site menu" })).toHaveCount(0);
  await nextFrames(page, 2);
  const after = await widths(page);
  expect(after.strip).toBe(after.band);
  expect(after.strip).toBe(closed.strip);
});
