import { readFileSync } from "node:fs";
import { siteContent } from "../lib/content";
import { test, expect } from "./support/fixtures";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { openHome, scrollToY } from "./support/coil";

// An accessibility smoke with no new dependency: the keyboard reaches the
// mark, the Menu pill and the book in that order; nothing focusable hides
// inside aria-hidden; every control the keyboard can reach has a name.

type Stop = { tag: string; name: string; inBook: boolean };

test("a11y: Tab reaches the mark, then the Menu pill, then the book's rows", async ({ page }) => {
  await openHome(page);
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
  const mark = stops.findIndex((stop) => stop.name === "Back to top");
  const pill = stops.findIndex((stop) => stop.name === "Open menu");
  const book = stops.findIndex((stop) => stop.inBook);
  expect(mark, `tab stops: ${JSON.stringify(stops.map((s) => s.name))}`).toBeGreaterThanOrEqual(0);
  expect(pill).toBeGreaterThan(mark);
  expect(book).toBeGreaterThan(pill);
});

test("a11y: nothing focusable sits inside aria-hidden, and every reachable control has a name", async ({ page }) => {
  await openHome(page);
  const report = await page.evaluate(() => {
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
  expect(report.count).toBeGreaterThan(20);
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
