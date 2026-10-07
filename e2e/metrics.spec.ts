import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { siteContent } from "../lib/content";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";

// The skyline inside Up to now: snapshot figures with no token, flat until
// seen, a fling leaves it pending, the toggle plays the morph, reduced motion snaps.
const m = siteContent.metrics;
const snap = JSON.parse(readFileSync("lib/metrics/data/contributions-6mo.json", "utf8"));
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDay = (day: string) => {
  const [y, mo, d] = day.split("-").map(Number);
  return monthDay.format(Date.UTC(y, mo - 1, d));
};
const state = (page: Page) => page.locator("[data-skyline-stage]").getAttribute("data-view-state");
const block = (page: Page) => page.locator("[data-metrics-block]");
const button = (page: Page, v: "flat" | "skyline") => block(page).getByRole("button", { name: m.chart[v], exact: true });

async function topAt(page: Page, fraction: number) {
  return page.evaluate((f) => {
    const el = document.querySelector("[data-metrics-block]")!;
    return Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - innerHeight * f));
  }, fraction);
}
async function scrollAt(page: Page, pxPerSec: number, to: number | "max") {
  await page.evaluate(([speed, target]) => new Promise<void>((done) => {
    const goal = target === "max" ? document.documentElement.scrollHeight - innerHeight : Number(target);
    const dir = Math.sign(goal - scrollY) || 1;
    let last = performance.now();
    const step = (now: number) => {
      const next = scrollY + (dir * speed * Math.min(50, now - last)) / 1000;
      last = now;
      const end = dir > 0 ? next >= goal : next <= goal;
      window.scrollTo({ top: end ? goal : next, behavior: "instant" });
      if (end) done();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), [pxPerSec, to] as const);
}
async function record(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-skyline-stage]")!;
    const w = window as unknown as { __states: string[] };
    w.__states = [];
    new MutationObserver(() => w.__states.push(el.dataset.viewState ?? "")).observe(el, { attributes: true, attributeFilter: ["data-view-state"] });
  });
}
const states = (page: Page) => page.evaluate(() => (window as unknown as { __states: string[] }).__states);

test("metrics: the stats show the snapshot's figures, stamped, with no token", async ({ page }) => {
  await openHome(page);
  const active = snap.days.filter((d: { count: number }) => d.count > 0).length;
  await expect(page.locator('[data-stat="streak"]')).toContainText(String(snap.streaks.current.days));
  await expect(page.locator('[data-stat="streak"]')).toContainText(`${m.streakLabel}${m.since} ${shortDay(snap.streaks.current.start)}`);
  await expect(page.locator('[data-stat="total"]')).toContainText(new Intl.NumberFormat("en-US").format(snap.total));
  await expect(page.locator('[data-stat="active"]')).toContainText(String(active));
  await expect(page.locator("[data-metrics-stale]")).toHaveText(`${m.asOf} ${shortDay(snap.range.to)}`);
});

test("metrics: flat at 95 percent down the viewport, skyline after a slow scroll past the line", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.95));
  await nextFrames(page, 90);
  expect(await state(page)).toBe("flat");
  await scrollAt(page, 200, await topAt(page, 0.35));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await expect(block(page)).toHaveAttribute("data-morph-plays", "1");
});

test("metrics: a 3000px/s fling leaves it flat at the footer; it morphs once on return", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, 0);
  await scrollAt(page, 3000, "max");
  const share = await page.evaluate(() => {
    const r = document.querySelector("[data-skyline-stage]")!.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height;
  });
  expect(share, "the chart must be out of view at the footer").toBeLessThan(0.6);
  await nextFrames(page, 30);
  expect(await state(page)).toBe("flat");
  await expect(block(page)).toHaveAttribute("data-morph-pending", "true");
  await scrollAt(page, 3000, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await scrollToY(page, (await topAt(page, 0.2)) + 120);
  await nextFrames(page, 60);
  await expect(block(page)).toHaveAttribute("data-morph-plays", "1");
});

test("metrics: the toggle plays the morph, by click and by keyboard", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await record(page);
  await button(page, "flat").click();
  await expect.poll(() => state(page)).toBe("flat");
  expect(await states(page)).toEqual(["moving", "flat"]);
  await expect(button(page, "flat")).toHaveAttribute("aria-pressed", "true");
  await button(page, "skyline").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page)).toBe("skyline");
  await button(page, "flat").focus();
  await page.keyboard.press("Space");
  await expect.poll(() => state(page)).toBe("flat");
  expect(await states(page)).toEqual(["moving", "flat", "moving", "skyline", "moving", "flat"]);
});

// Two real refreshes over a held Flat click: a reflow above the block (the
// hook's own debounced refresh, 150ms after the block's top moves) and
// ScrollTrigger's auto refresh on a window resize event (0.2s later, layout
// unchanged, so the trigger's progress ratio is unchanged). Neither may refire
// onEnter; with invalidateOnRefresh the second one did.
test("metrics: a click hold survives ScrollTrigger refreshes", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await expect(block(page)).toHaveAttribute("data-morph-plays", "1");
  await button(page, "flat").click();
  await expect.poll(() => state(page)).toBe("flat");
  const held = async () => {
    await page.waitForTimeout(400);
    await nextFrames(page, 10);
    expect(await state(page)).toBe("flat");
    await expect(block(page)).toHaveAttribute("data-morph-plays", "1");
    await expect(button(page, "flat")).toHaveAttribute("aria-pressed", "true");
  };
  const moved = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-metrics-block]")!;
    const docTop = () => el.getBoundingClientRect().top + scrollY;
    const before = docTop();
    document.querySelector<HTMLElement>("#up-to-now")!.style.marginTop = "200px";
    return docTop() - before;
  });
  expect(moved, "the reflow must move the block's top").toBe(200);
  await held();
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await held();
});

test("metrics: Enter on the canvas with nothing pinned announces and shows the last day", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  const last = snap.days[snap.days.length - 1] as { date: string; count: number };
  const [y, mo, d] = last.date.split("-").map(Number);
  const longDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const count = last.count ? `${new Intl.NumberFormat("en-US").format(last.count)} ${last.count === 1 ? m.chart.unit : m.chart.units}` : m.chart.none;
  const expected = `${count} ${m.chart.on} ${longDay.format(Date.UTC(y, mo - 1, d))}`;
  const tip = block(page).locator('[role="tooltip"]');
  await expect(tip).toHaveAttribute("aria-hidden", "true");
  await block(page).locator("[data-skyline-stage] canvas").focus();
  await page.keyboard.press("Enter");
  await expect(block(page).locator('[aria-live="polite"]')).toHaveText(expected);
  await expect(tip).toHaveAttribute("aria-hidden", "false");
  await expect(tip).toHaveCSS("opacity", "1");
  await expect(tip).toContainText(expected);
});

test("metrics: a legend swatch previews on focus and pins only on a press", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  const swatch = block(page).getByRole("button", { name: m.chart.highlight(m.chart.levels[2]), exact: true });
  await swatch.focus();
  await expect(swatch).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await expect(swatch).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(swatch).toHaveAttribute("aria-pressed", "false");
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("metrics: snaps between flat and skyline, never moving", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await scrollToY(page, await topAt(page, 0.95));
    await record(page);
    expect(await state(page)).toBe("flat");
    await scrollToY(page, await topAt(page, 0.3));
    await expect.poll(() => state(page)).toBe("skyline");
    await button(page, "flat").click();
    await expect.poll(() => state(page)).toBe("flat");
    expect(await states(page)).toEqual(["skyline", "flat"]);
  });
});

test("capture: the skyline at 1440 in both themes, and at 390 in light", async ({ page }) => {
  test.skip(process.env.METRICS_CAPTURE !== "1", "manual capture");
  // One load: a second visit to a scrolled home is a deep reload with no entrance.
  await openHome(page);
  const show = async (v: "flat" | "skyline") => {
    if ((await state(page)) !== v) await button(page, v).click();
    await expect.poll(() => state(page), { timeout: 5000 }).toBe(v);
    // The pointer leaves the toggle, so neither its hover nor the cursor ring is in the shot.
    await page.mouse.move(4, page.viewportSize()!.height / 2);
    await nextFrames(page, 20);
  };
  const shoot = async (theme: "light" | "dark", suffix: string) => {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await scrollToY(page, await topAt(page, 0.2));
    await show("skyline");
    await block(page).screenshot({ path: `test-results/metrics-skyline-${theme}${suffix}.png` });
    await show("flat");
    await block(page).screenshot({ path: `test-results/metrics-flat-${theme}${suffix}.png` });
  };
  for (const theme of ["light", "dark"] as const) await shoot(theme, "");
  await page.setViewportSize({ width: 390, height: 844 });
  await shoot("light", "-390");
});
