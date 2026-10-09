import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { siteContent } from "../lib/content";
import { test, expect } from "./support/fixtures";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { coilPoints, openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { noWebgl2Api } from "./support/webgl";

// An accessibility smoke with no new dependency: the keyboard reaches the
// mark, the Menu pill and the book in that order; nothing focusable hides
// inside aria-hidden; every control the keyboard can reach has a name.

type Stop = { tag: string; name: string; inBook: boolean };

async function tabStops(page: Page): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " "),
        inBook: !!el.closest("#work"),
      };
    });
    if (stop) stops.push(stop);
    if (stop?.inBook) break;
  }
  return stops;
}

test("a11y: Tab reaches the mark, then the Menu pill, then the book's rows", async ({ page }) => {
  await openHome(page);
  const stops = await tabStops(page);
  const mark = stops.findIndex((stop) => stop.name === "Back to top");
  const pill = stops.findIndex((stop) => stop.name === "Open menu");
  const book = stops.findIndex((stop) => stop.inBook);
  expect(mark, `tab stops: ${JSON.stringify(stops.map((s) => s.name))}`).toBeGreaterThanOrEqual(0);
  expect(pill).toBeGreaterThan(mark);
  expect(book).toBeGreaterThan(pill);
});

async function focusReport(page: Page) {
  return page.evaluate(() => {
    const focusable = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
      ),
    ].filter((el) => {
      if (el.closest("[inert]") || (el as HTMLButtonElement).disabled || el.tabIndex < 0) return false;
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
    });
    const label = (el: HTMLElement) => {
      const labelledBy = el.getAttribute("aria-labelledby");
      const byId = labelledBy
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      const images = [...el.querySelectorAll("img[alt]")].map((img) => img.getAttribute("alt")).join(" ");
      return (el.getAttribute("aria-label") || byId || el.textContent || images || el.getAttribute("title") || "").trim();
    };
    const describe = (el: HTMLElement) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${label(el).slice(0, 40)}"`;
    return {
      count: focusable.length,
      hidden: focusable.filter((el) => el.closest('[aria-hidden="true"]')).map(describe),
      unnamed: focusable.filter((el) => label(el) === "").map(describe),
    };
  });
}

test("a11y: nothing focusable sits inside aria-hidden, and every reachable control has a name", async ({ page }) => {
  await openHome(page);
  const report = await focusReport(page);
  expect(report.count).toBeGreaterThan(20);
  expect(report.hidden, "focusable elements inside aria-hidden").toEqual([]);
  expect(report.unnamed, "focusable elements with no accessible name").toEqual([]);
});

test("a11y (no WebGL 2): the notice's Got it follows the h1 and is a named tab stop between the Menu pill and the book, nothing focusable hides", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  await page.goto("/");
  await settled(page);
  await expect(page.locator("[data-still-notice]")).toBeVisible();
  const order = await page.evaluate(() => {
    const h1 = document.getElementById("hero-heading")!;
    const gotIt = document.querySelector("[data-still-notice] button")!;
    const book = document.getElementById("work")!;
    return {
      afterH1: !!(h1.compareDocumentPosition(gotIt) & Node.DOCUMENT_POSITION_FOLLOWING),
      beforeBook: !!(gotIt.compareDocumentPosition(book) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
  expect(order.afterH1, "Got it after the h1 in the DOM").toBe(true);
  expect(order.beforeBook, "and before the book").toBe(true);
  const stops = await tabStops(page);
  const pill = stops.findIndex((stop) => stop.name === "Open menu");
  const gotIt = stops.findIndex((stop) => stop.name.startsWith(siteContent.hero.still.dismiss));
  const book = stops.findIndex((stop) => stop.inBook);
  expect(gotIt, `tab stops: ${JSON.stringify(stops.map((s) => s.name))}`).toBeGreaterThan(pill);
  expect(book).toBeGreaterThan(gotIt);
  const report = await focusReport(page);
  expect(report.hidden, "focusable elements inside aria-hidden").toEqual([]);
  expect(report.unnamed, "focusable elements with no accessible name").toEqual([]);
});

test("a11y: the skyline's canvas is named with its total and range", async ({ page }) => {
  const snap = JSON.parse(readFileSync("lib/metrics/data/contributions-6mo.json", "utf8"));
  const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const shortDay = (day: string) => {
    const [y, mo, d] = day.split("-").map(Number);
    return monthDay.format(Date.UTC(y, mo - 1, d));
  };
  const total = new Intl.NumberFormat("en-US").format(snap.total);
  await openHome(page);
  const canvas = page.locator("[data-skyline-stage] canvas");
  await expect(canvas).toHaveAttribute("aria-label", siteContent.metrics.chart.label(total, shortDay(snap.range.from), shortDay(snap.range.to), false));
  await expect(canvas).toHaveAttribute("tabindex", "0");
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`a11y: every label-face text in main and the footer meets 4.5:1 in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.addInitScript((key) => sessionStorage.setItem(key, JSON.stringify(["capital-one-pm"])), SEEN_STORAGE_KEY);
    await openHome(page);
    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y < maxScroll; y += 600) await scrollToY(page, y);
    await scrollToY(page, maxScroll);
    await page.waitForTimeout(1000);
    await page.mouse.move(1, 1);
    const report = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const probe = document.createElement("span");
      probe.style.color = "var(--color-background)";
      document.body.append(probe);
      const bg = parse(getComputedStyle(probe).color);
      probe.remove();
      const failures: string[] = [];
      let checked = 0;
      for (const el of document.querySelectorAll<HTMLElement>("main .font-label, footer .font-label")) {
        if (!el.getClientRects().length || el.closest("[inert]")) continue;
        let alpha = 1;
        for (let n: HTMLElement | null = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
        if (alpha < 0.5) continue; // a hidden layer
        const [r, g, b, a = 1] = parse(getComputedStyle(el).color);
        const fg = [r, g, b].map((v, i) => v * alpha * a + bg[i] * (1 - alpha * a));
        const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        const ratio = (hi + 0.05) / (lo + 0.05);
        checked += 1;
        if (ratio < 4.5) failures.push(`${el.textContent?.trim().slice(0, 30)}: ${ratio.toFixed(2)}`);
      }
      return { checked, failures };
    });
    expect(report.checked, "label-face texts measured (26 on 2026-10-06)").toBeGreaterThanOrEqual(24);
    expect(report.failures, "label-face texts under 4.5:1").toEqual([]);
  });
}

// Focus rings are for the keyboard (lib/input/modality). A mouse press, a hold
// or a tap never leaves one behind, however focus then moves; Tab brings it
// back on the same controls.

// Every element painting an outline right now. The outline-none utility draws a
// transparent 2px outline, which paints nothing.
async function paintedRings(page: Page) {
  return page.evaluate(() => {
    const rings: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const style = getComputedStyle(el);
      if (style.outlineStyle === "none" || style.outlineStyle === "hidden" || parseFloat(style.outlineWidth) === 0) continue;
      if (/^rgba\(\d+, \d+, \d+, 0\)$/.test(style.outlineColor) || style.outlineColor === "transparent") continue;
      if (!el.getClientRects().length) continue;
      rings.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${style.outlineWidth} ${style.outlineStyle}`);
    }
    return rings;
  });
}

async function focusedRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    // The Coil and Band toggle rings its group, not the segment that has focus.
    const ringed = (node: HTMLElement) => {
      const style = getComputedStyle(node);
      return style.outlineStyle === "solid" && parseFloat(style.outlineWidth) >= 2 && !/, 0\)$/.test(style.outlineColor);
    };
    return {
      name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30),
      inBook: !!el.closest("#work"),
      painted: ringed(el) || ringed(el.closest<HTMLElement>("[data-shape-toggle]") ?? el),
    };
  });
}

test("focus rings: the mouse leaves none behind on the mark, a hold, the Menu pill or a card's modal", async ({ page }) => {
  await openHome(page);
  const mark = page.locator("[data-mark-trigger]");
  const markCard = page.getByRole("dialog", { name: siteContent.mark.dialogLabel });
  const none = async (when: string) => expect(await paintedRings(page), when).toEqual([]);

  async function holdMark() {
    const box = (await mark.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect(markCard).toBeVisible();
  }

  await mark.click();
  await none("after a click on the mark");

  await holdMark();
  await none("with the mark's card open");
  await markCard.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();
  await expect(markCard).toHaveCount(0);
  await expect(mark).toBeFocused();
  await none("after the card closed by mouse and focus came back to the mark");

  await holdMark();
  await page.keyboard.press("Escape");
  await expect(markCard).toHaveCount(0);
  await expect(mark).toBeFocused();
  await none("after Escape closed a card the mouse opened");

  await page.getByRole("button", { name: siteContent.menu.ariaLabelOpen }).click();
  await expect(page.getByRole("button", { name: siteContent.menu.ariaLabelClose })).toBeFocused();
  await none("with the Menu open");
  await page.getByRole("button", { name: siteContent.menu.ariaLabelClose }).click();
  await expect(page.getByRole("button", { name: siteContent.menu.ariaLabelOpen })).toBeFocused();
  await none("after the Menu closed by mouse and focus came back to the pill");

  // A card in the canvas has no element to take the click, so Chrome never
  // saw a mouse focus before the modal's own script focus.
  const { card } = await coilPoints(page);
  await page.mouse.move(card.x - 20, card.y + 10);
  await page.mouse.move(card.x, card.y);
  await page.waitForTimeout(400);
  await page.mouse.click(card.x, card.y);
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await none("with a card's modal open and Close focused");
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await none("after the card's modal closed by mouse");
});

test("focus rings: Tab draws one on the mark, the Menu pill and a book row; a click clears it; Tab brings it back", async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  const stops: Awaited<ReturnType<typeof focusedRing>>[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const stop = await focusedRing(page);
    stops.push(stop);
    if (stop.inBook) break;
  }
  expect(stops.map((stop) => stop.name)).toEqual(expect.arrayContaining([siteContent.menu.markAriaLabel, siteContent.menu.ariaLabelOpen]));
  expect(stops.at(-1)?.inBook, `tab stops: ${JSON.stringify(stops.map((s) => s.name))}`).toBe(true);
  expect(stops.filter((stop) => !stop.painted).map((stop) => stop.name), "tab stops with no ring").toEqual([]);

  // The keyboard opens the Menu and Escape closes it: focus returns to the pill, ringed.
  const pill = page.getByRole("button", { name: siteContent.menu.ariaLabelOpen });
  await pill.focus();
  await page.keyboard.press("Enter");
  const closeMenu = page.getByRole("button", { name: siteContent.menu.ariaLabelClose });
  await expect(closeMenu).toBeFocused();
  expect((await focusedRing(page)).painted, "Close menu after Enter").toBe(true);
  await page.keyboard.press("Escape");
  await expect(pill).toBeFocused();
  expect((await focusedRing(page)).painted, "the pill after Escape").toBe(true);

  // A click on a control the keyboard just ringed clears the ring, and Tab draws the next.
  const mark = page.locator("[data-mark-trigger]");
  await mark.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(mark).toBeFocused();
  expect((await focusedRing(page)).painted, "the mark after Tab").toBe(true);
  await mark.click();
  expect(await paintedRings(page), "after a click on the ringed mark").toEqual([]);
  await page.keyboard.press("Tab");
  expect((await focusedRing(page)).painted, "the next stop after Tab").toBe(true);
});
