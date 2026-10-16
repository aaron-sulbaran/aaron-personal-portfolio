import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { siteContent } from "../lib/content";
import { formatCompact, peakDay, shortDate, tokenTip } from "../lib/metrics/format";
import { windowStart } from "../lib/metrics/window";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";

// The skyline in the numbers strip under Who I am: snapshot figures with no token, flat until
// seen, a fling leaves it pending, the toggle plays the morph, reduced motion snaps. Commits
// and Tokens swap the series in place.
const m = siteContent.metrics;
const snap = JSON.parse(readFileSync("lib/metrics/data/contributions-6mo.json", "utf8"));

type ToolCounts = { in: number; out: number; cr: number; cw: number };
type UsageRow = { d: string; claude: ToolCounts; codex: ToolCounts };
type Toolkit = { customSkills: number; installedSkills: number; plugins: number; mcpServers: number };
const usage = JSON.parse(readFileSync("lib/metrics/data/usage-6mo.json", "utf8")) as { days: UsageRow[]; toolkit: Toolkit };
const toolkitTotal = usage.toolkit.customSkills + usage.toolkit.installedSkills + usage.toolkit.plugins + usage.toolkit.mcpServers;
const toolTotal = (c: ToolCounts) => c.in + c.out + c.cr + c.cw;
const usageTo = usage.days[usage.days.length - 1].d;
const usageFrom = windowStart(usageTo, "6mo");
const usageDays = usage.days
  .filter((d) => d.d >= usageFrom)
  .map((d) => ({ date: d.d, claude: toolTotal(d.claude), codex: toolTotal(d.codex), count: toolTotal(d.claude) + toolTotal(d.codex) }));
const usageTotal = usageDays.reduce((sum, d) => sum + d.count, 0);
const usageLast = usageDays.find((d) => d.date === usageTo)!;
const seriesButton = (page: Page, v: "commits" | "tokens") => block(page).getByRole("button", { name: m.chart[v], exact: true });
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

test("metrics: the stats show the snapshot's figures, stamped Updated, with no token", async ({ page }) => {
  await openHome(page);
  const active = snap.days.filter((d: { count: number }) => d.count > 0).length;
  await expect(page.locator('[data-stat="streak"] + dd')).toContainText(String(snap.streaks.current.days));
  await expect(page.locator('[data-stat="streak"]')).toContainText(`${m.streakLabel}${m.since} ${shortDay(snap.streaks.current.start)}`);
  await expect(page.locator('[data-stat="total"] + dd')).toContainText(new Intl.NumberFormat("en-US").format(snap.total));
  await expect(page.locator('[data-stat="active"] + dd')).toContainText(String(active));
  await expect(page.locator("[data-metrics-stale]")).toHaveText(`${m.updated} ${shortDay(snap.range.to)}`);
});

// Aaron, 2026-10-13: "Erase the stray LinkedIn 450k number." The slot mechanism stays; nothing renders.
test("metrics: the LinkedIn figure is gone and no column holds its place", async ({ page }) => {
  await openHome(page);
  await expect(page.locator('[data-stat="linkedin"]')).toHaveCount(0);
  await expect(page.locator("#numbers")).not.toContainText("450,000");
  await expect(page.locator("#numbers")).not.toContainText("LinkedIn");
  const group = page.getByRole("group", { name: `${m.title} ${m.groupLabel}`, exact: true });
  await expect(group).toHaveCount(1);
  await expect(page.locator("#numbers").getByText(m.groupLabel, { exact: true })).toBeVisible();
  await expect(group.locator('[data-stat="streak"]')).toHaveCount(1);
  // Nothing sits beside the board: the strip's grid has the board and no second column.
  expect(await page.locator("#numbers div.grid[data-wave-words]").evaluate((el) => el.children.length)).toBe(1);
});

// Aaron, 2026-10-09: no little kicker over a section's title. The strip has its own big heading,
// set exactly as Who I am's is, and the GitHub line under it, set exactly as the line under Who I am's.
test("metrics: the strip is headed by its own big title and the GitHub line, set as Who I am's heading and line are", async ({ page }) => {
  await openHome(page);
  const heading = page.locator("#numbers h2");
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText(m.title);
  await expect(page.locator("h1")).toHaveCount(1);
  const line = page.locator("#numbers p[data-sections-block='body']").first();
  await expect(line).toHaveText(m.groupLabel);
  const group = page.getByRole("group", { name: `${m.title} ${m.groupLabel}`, exact: true });
  await expect(group).toHaveAttribute("aria-labelledby", `${await heading.getAttribute("id")} ${await line.getAttribute("id")}`);
  expect(await page.locator("#numbers [data-sections-block='kicker']").count(), "no kicker over the title").toBe(0);
  expect(await page.locator("#numbers [data-sections-block]").first().evaluate((el) => el.tagName), "the title comes first").toBe("H2");
  const look = (selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const style = getComputedStyle(el);
      return { tag: el.tagName, family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight, color: style.color, letterSpacing: style.letterSpacing };
    });
  expect(await look("#numbers h2"), "the title looks like Who I am's").toEqual(await look("#about h2"));
  expect(await look("#numbers p[data-sections-block='body']"), "the line looks like the one under Who I am's").toEqual(
    await look("#about .sections-sticky-col p[data-sections-block='body']"),
  );
});

// Aaron, 2026-10-13: the line under the strip's title runs on one line on a
// desktop; Who I am's keeps its narrow measure.
test("metrics: the line under the title is one line at 1440, while Who I am's stays narrow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  const lines = (selector: string) =>
    page.locator(selector).first().evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(await lines("#numbers p[data-sections-block='body']")).toBe(1);
  expect(await page.locator("#about .sections-sticky-col p[data-sections-block='body']").first().evaluate((el) => getComputedStyle(el).maxWidth)).toBe("320px");
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
    document.querySelector<HTMLElement>("#numbers")!.style.marginTop = "200px";
    return docTop() - before;
  });
  expect(moved, "the reflow must move the block's top").toBe(200);
  await held();
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await held();
});

// The engine rethemes (resolving every token, measuring every label) on a
// theme switch only: ScrollTrigger's refresh guard and the scroll lock write
// <html>'s inline style, and those writes must not retheme it. retheme is
// the engine's only measureText caller, so the count of those on the
// skyline's canvas counts rethemes.
test("metrics: a theme switch repaints the skyline; a style write on <html> does not retheme it", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await nextFrames(page, 30);
  await page.evaluate(() => {
    const canvas = document.querySelector("[data-skyline-stage] canvas");
    const w = window as unknown as { __measures: number };
    w.__measures = 0;
    const measure = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function (this: CanvasRenderingContext2D, text: string) {
      if (this.canvas === canvas) w.__measures++;
      return measure.call(this, text);
    };
  });
  const measures = () => page.evaluate(() => (window as unknown as { __measures: number }).__measures);
  const ink = () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>("[data-skyline-stage] canvas")!;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum;
    });

  for (const write of [
    () => document.documentElement.style.setProperty("--scrollbar-comp", "15px"),
    () => (document.documentElement.style.scrollBehavior = "auto"),
    () => document.documentElement.style.removeProperty("scroll-behavior"),
    () => document.documentElement.style.setProperty("--scrollbar-comp", "0px"),
    () => document.documentElement.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") ?? "light"),
  ]) {
    await page.evaluate(write);
    await nextFrames(page, 3);
  }
  expect(await measures(), "style writes and an unchanged theme must not retheme").toBe(0);

  const before = await ink();
  await page.evaluate(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
  await expect.poll(measures).toBeGreaterThan(0);
  await expect.poll(ink, { timeout: 5000 }).not.toBe(before);
});

// A Flat click holds until the line is next crossed, and a live switch of
// reduced motion (which rebuilds the trigger) is not a crossing.
test("metrics: a Flat click past the line survives reduced motion switched on and off", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await button(page, "flat").click();
  await expect.poll(() => state(page)).toBe("flat");
  await record(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(400);
  await nextFrames(page, 10);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(1500);
  await nextFrames(page, 10);
  expect(await states(page)).toEqual([]);
  expect(await state(page)).toBe("flat");
  await expect(button(page, "flat")).toHaveAttribute("aria-pressed", "true");
});

// The swatches draw at 11px inside a 24px square button, so each press target
// is 24px tall and neighbours never overlap. The probes stay a pixel inside
// each edge: hit testing snaps the buttons' fractional positions.
test("metrics: each legend swatch takes a press across a 24px tall target that meets its neighbours", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  const swatches = block(page).locator("button[title]");
  await expect(swatches).toHaveCount(5);
  const misses = await swatches.evaluateAll((els) => {
    const out: string[] = [];
    const boxes = els.map((el) => el.getBoundingClientRect());
    els.forEach((el, k) => {
      const b = boxes[k];
      const hits = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y);
        return hit === el || (hit !== null && el.contains(hit));
      };
      const probes: [number, number][] = [
        [b.left + b.width / 2, b.top + 1],
        [b.left + b.width / 2, b.bottom - 1],
        [b.left + 1, b.top + b.height / 2],
        [b.right - 1, b.top + b.height / 2],
      ];
      for (const [x, y] of probes) if (!hits(x, y)) out.push(`${k} at ${x.toFixed(1)},${y.toFixed(1)}`);
      if (b.height < 24 || b.width < 24) out.push(`${k} target is ${b.width}x${b.height}`);
      const drawn = el.firstElementChild?.getBoundingClientRect();
      if (!drawn || drawn.width > 12 || drawn.height > 12) out.push(`${k} swatch draws at ${drawn?.width}x${drawn?.height}`);
      if (k > 0 && b.left < boxes[k - 1].right - 0.5) out.push(`${k} overlaps ${k - 1}`);
    });
    return out;
  });
  expect(misses).toEqual([]);
});

test("metrics: Enter on the canvas with nothing pinned announces and shows the last day", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
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

const switchState = (page: Page) => page.locator("[data-skyline-stage]").getAttribute("data-switch-state");
async function recordSwitch(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-skyline-stage]")!;
    const w = window as unknown as { __switches: string[] };
    w.__switches = [];
    new MutationObserver(() => w.__switches.push(el.dataset.switchState ?? "")).observe(el, { attributes: true, attributeFilter: ["data-switch-state"] });
  });
}
const switches = (page: Page) => page.evaluate(() => (window as unknown as { __switches: string[] }).__switches);
const waveBoard = (page: Page) => page.locator("[data-wave-state]");
const waveIdle = (page: Page) => expect(waveBoard(page)).toHaveAttribute("data-wave-state", "idle", { timeout: 10000 });
const waveOrder = (page: Page) => waveBoard(page).getAttribute("data-wave-order");
const band = (page: Page) => page.locator("[data-toolkit-band]");
const figureKeys = (page: Page) => page.locator("[data-metrics-figures] [data-stat]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.stat));

test("metrics: Tokens swaps the figures, the tooltip and the label in place; Commits comes back as it was", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  const canvas = block(page).locator("[data-skyline-stage] canvas");
  await canvas.evaluate((el) => ((el as unknown as { __mark: number }).__mark = 1));
  await expect(seriesButton(page, "commits")).toHaveAttribute("aria-pressed", "true");
  await recordSwitch(page);

  await seriesButton(page, "tokens").click();
  await expect(seriesButton(page, "tokens")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-skyline-stage]")).toHaveAttribute("data-series", "usage");
  await expect.poll(() => switchState(page), { timeout: 5000 }).toBe("done");
  expect(await switches(page)).toEqual(["moving", "done"]);
  expect(await canvas.evaluate((el) => (el as unknown as { __mark?: number }).__mark), "the canvas is the same element").toBe(1);
  expect(await state(page), "the switch keeps the view").toBe("skyline");

  await waveIdle(page);
  expect(await figureKeys(page)).toEqual(["total", "active", "peak"]);
  await expect(band(page)).toBeVisible();
  await expect(band(page).locator("[data-toolkit-total]")).toHaveText(String(toolkitTotal));
  await expect(band(page)).toContainText(m.tokens.toolkitLabel);
  await expect(band(page).locator("[data-toolkit-group]")).toHaveCount(4);
  for (const [key, name] of Object.entries(m.tokens.groups)) {
    await expect(band(page).locator(`[data-toolkit-group="${key}"] h4`)).toContainText(name);
    await expect(band(page).locator(`[data-toolkit-group="${key}"] [data-toolkit-name]`)).toHaveCount(5);
  }
  for (const key of ["written", "used"]) {
    const labels = await band(page).locator(`[data-toolkit-group="${key}"] [data-toolkit-name]`).allTextContents();
    for (const label of labels) expect(label).toMatch(/^\/[a-z0-9-]+/);
  }
  await expect(band(page).locator('[data-toolkit-group="plugin"]')).not.toContainText("chrome-devtools");
  await expect(band(page).locator('[data-toolkit-group="mcp"]')).toContainText("chrome-devtools");
  await expect(band(page)).not.toContainText("dataviz");
  await expect(band(page).locator('[data-toolkit-group="mcp"] [data-toolkit-name]').first()).not.toContainText("/");
  await expect(page.locator("[data-figure-slot]")).toHaveCount(3);
  await expect(page.locator('[data-stat="total"] + dd')).toContainText(formatCompact(usageTotal));
  await expect(page.locator('[data-stat="total"]')).toContainText(m.tokens.totalLabel);
  const peak = peakDay(usageDays)!;
  await expect(page.locator('[data-stat="peak"] + dd')).toContainText(formatCompact(peak.count));
  await expect(page.locator('[data-stat="peak"]')).toContainText(shortDate(peak.date));
  await expect(page.locator('[data-stat="active"] + dd')).toContainText(String(usageDays.filter((d) => d.count > 0).length));
  await expect(canvas).toHaveAttribute("aria-label", m.tokens.label(formatCompact(usageTotal), shortDay(usageFrom), shortDay(usageTo), true));
  await expect(block(page).getByRole("list", { name: m.tokens.keyLabel })).toContainText(m.tokens.keyClaude);
  await expect(block(page).getByRole("list", { name: m.tokens.keyLabel })).toContainText(m.tokens.keyCodex);

  await canvas.focus();
  await page.keyboard.press("Enter");
  await expect(block(page).locator('[aria-live="polite"]')).toHaveText(tokenTip(usageLast));
  await page.keyboard.press("Escape");

  await seriesButton(page, "commits").click();
  await expect(page.locator("[data-skyline-stage]")).toHaveAttribute("data-series", "github");
  await waveIdle(page);
  expect(await figureKeys(page)).toEqual(["streak", "total", "active"]);
  await expect(band(page)).toHaveCount(0);
  await expect(page.locator('[data-stat="total"] + dd')).toContainText(new Intl.NumberFormat("en-US").format(snap.total));
  await expect(page.locator('[data-stat="streak"]')).toContainText(`${m.streakLabel}${m.since} ${shortDay(snap.streaks.current.start)}`);
  await expect(canvas).toHaveAttribute("aria-label", m.chart.label(new Intl.NumberFormat("en-US").format(snap.total), shortDay(snap.range.from), shortDay(snap.range.to), true));
  await expect(block(page).getByRole("list", { name: m.tokens.keyLabel })).toHaveCount(0);
  await expect(block(page).locator("button[title]")).toHaveCount(5);
});

// "Move the as of stamp above the first number" (Aaron, 2026-10-13): a small label over the first
// figure, in whichever view is stale, in the same column.
test("metrics: the Updated stamp sits above the first figure, in the same column, in Commits and in Tokens", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  const above = async (day: string) => {
    const stamp = page.locator("[data-metrics-stale]");
    await expect(stamp).toHaveCount(1);
    await expect(stamp).toHaveText(`${m.updated} ${shortDay(day)}`);
    const stampBox = (await stamp.boundingBox())!;
    const figureBox = (await page.locator('[data-figure-slot="0"] dd').boundingBox())!;
    expect(stampBox.y + stampBox.height, "the stamp ends above the first figure").toBeLessThanOrEqual(figureBox.y + 1);
    expect(Math.abs(stampBox.x - figureBox.x), "the same column").toBeLessThan(2);
  };
  await above(snap.range.to);
  await seriesButton(page, "tokens").click();
  await waveIdle(page);
  await above(usageTo);
});

// The wave: Commits to Tokens runs left to right (bars, figures top down, the band in); Tokens to
// Commits runs right to left (figures last first, the band out, the bars last).
test("metrics: the wave goes left to right to Tokens and right to left back, and masks run in that direction", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await expect(waveBoard(page)).toHaveAttribute("data-wave-state", "idle");
  await expect(band(page)).toHaveCount(0);

  await seriesButton(page, "tokens").click();
  await expect(seriesButton(page, "tokens")).toHaveAttribute("aria-pressed", "true");
  await expect(waveBoard(page)).toHaveAttribute("data-wave-dir", "ltr");
  await expect.poll(() => page.locator('[data-mask-dir="ltr"]').count(), { intervals: [20], timeout: 3000 }).toBeGreaterThan(0);
  await waveIdle(page);
  expect(await waveOrder(page)).toBe("bars,figure-0,figure-1,figure-2,band-in");
  await expect(band(page)).toBeVisible();
  expect(await page.locator("[data-figure-slot], [data-toolkit-band]").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.clipPath))).toEqual(["", "", "", ""]);
  await expect.poll(() => switchState(page), { timeout: 5000 }).toBe("done");

  await seriesButton(page, "commits").click();
  await expect(waveBoard(page)).toHaveAttribute("data-wave-dir", "rtl");
  await expect.poll(() => page.locator('[data-mask-dir="rtl"]').count(), { intervals: [20], timeout: 3000 }).toBeGreaterThan(0);
  await waveIdle(page);
  expect(await waveOrder(page)).toBe("figure-2,figure-1,figure-0,band-out,bars");
  await expect(band(page)).toHaveCount(0);
  expect(await figureKeys(page)).toEqual(["streak", "total", "active"]);
  await expect.poll(() => switchState(page), { timeout: 5000 }).toBe("done");
});

test("metrics: a press during the wave finishes it at once and starts the next from there", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await seriesButton(page, "tokens").click();
  await expect(waveBoard(page)).toHaveAttribute("data-wave-state", "running");
  await seriesButton(page, "commits").click();
  await expect(seriesButton(page, "commits")).toHaveAttribute("aria-pressed", "true");
  await waveIdle(page);
  expect(await waveOrder(page)).toBe("figure-2,figure-1,figure-0,band-out,bars");
  expect(await figureKeys(page)).toEqual(["streak", "total", "active"]);
  await expect(band(page)).toHaveCount(0);
  await expect(page.locator("[data-skyline-stage]")).toHaveAttribute("data-series", "github");
});

// Aaron, 2026-10-13: both toggles take the hero's Coil and Band design
// (components/fx/PillToggle.tsx), with no backdrop blur since they sit on the page.
const pillVar = (toggle: Locator, name: "--pt-a" | "--pt-b") =>
  toggle.evaluate((el, n) => Number(getComputedStyle(el).getPropertyValue(n)), name);
test("metrics: Commits and Tokens, and Flat and Skyline, are two-half capsules that lean toward a hover and lag on a switch", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.2));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  const series = block(page).getByRole("group", { name: m.chart.seriesGroup, exact: true });
  const view = block(page).getByRole("group", { name: m.chart.viewGroup, exact: true });
  for (const toggle of [series, view]) {
    await expect(toggle).toHaveClass(/\bpill-toggle\b/);
    await expect(toggle.locator("button")).toHaveCount(2);
    expect(await toggle.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
    expect(await toggle.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("999px");
  }
  await expect(series).toHaveAttribute("data-state", "first");
  await expect(view).toHaveAttribute("data-state", "second");

  await seriesButton(page, "tokens").hover();
  await expect.poll(() => pillVar(series, "--pt-b")).toBeCloseTo(0.57, 2);
  expect(await pillVar(series, "--pt-a")).toBe(0);
  await page.mouse.move(4, page.viewportSize()!.height / 2);
  await expect.poll(() => pillVar(series, "--pt-b")).toBeCloseTo(0.5, 2);

  await seriesButton(page, "tokens").click();
  await expect(series).toHaveAttribute("data-state", "second");
  await expect(series).toHaveAttribute("data-dir", "right");
  await nextFrames(page, 3);
  const leading = await pillVar(series, "--pt-b");
  const trailing = await pillVar(series, "--pt-a");
  expect(leading - 0.5, "the leading edge goes first").toBeGreaterThan(trailing);
  await expect.poll(() => pillVar(series, "--pt-a")).toBeCloseTo(0.5, 2);
  await expect.poll(() => pillVar(series, "--pt-b")).toBeCloseTo(1, 2);
  await expect(seriesButton(page, "tokens")).toHaveAttribute("aria-pressed", "true");
});

test("metrics: a Tokens press in flat stays flat and the morph still waits to be seen", async ({ page }) => {
  await openHome(page);
  await scrollToY(page, await topAt(page, 0.9));
  await nextFrames(page, 30);
  expect(await state(page)).toBe("flat");
  await seriesButton(page, "tokens").click();
  await expect.poll(() => switchState(page), { timeout: 5000 }).toBe("done");
  expect(await state(page)).toBe("flat");
  await expect(block(page)).toHaveAttribute("data-morph-plays", "0");
  await scrollAt(page, 200, await topAt(page, 0.35));
  await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
  await expect(block(page)).toHaveAttribute("data-morph-plays", "1");
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
  test("metrics: Commits and Tokens swap at once, never moving", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await scrollToY(page, await topAt(page, 0.3));
    await expect.poll(() => state(page)).toBe("skyline");
    await recordSwitch(page);
    await seriesButton(page, "tokens").click();
    await expect(page.locator("[data-skyline-stage]")).toHaveAttribute("data-series", "usage");
    await nextFrames(page, 10);
    await seriesButton(page, "commits").click();
    await expect(page.locator("[data-skyline-stage]")).toHaveAttribute("data-series", "github");
    await nextFrames(page, 10);
    expect(await switches(page)).toEqual([]);
    expect(await switchState(page)).toBe("done");
    const series = block(page).getByRole("group", { name: m.chart.seriesGroup, exact: true });
    expect(await series.evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s(, 0s)*$/);
  });
  test("metrics: Tokens swaps the figures and the band at once, with no mask and no clip left behind", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await scrollToY(page, await topAt(page, 0.3));
    await expect.poll(() => state(page)).toBe("skyline");
    await seriesButton(page, "tokens").click();
    await expect(band(page)).toBeVisible();
    expect(await figureKeys(page)).toEqual(["total", "active", "peak"]);
    await expect(waveBoard(page)).toHaveAttribute("data-wave-state", "idle");
    expect(await waveOrder(page)).toBe("instant");
    await expect(page.locator("[data-mask-dir]")).toHaveCount(0);
    expect(await page.locator("[data-figure-slot], [data-toolkit-band]").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.clipPath))).toEqual(["", "", "", ""]);
    await seriesButton(page, "commits").click();
    await expect(band(page)).toHaveCount(0);
    expect(await figureKeys(page)).toEqual(["streak", "total", "active"]);
    expect(await waveOrder(page)).toBe("instant");
  });
});

// The #numbers section as a visitor sees it, for Aaron's look: Commits and Tokens in both themes at
// 1440, and Tokens in light at 390. METRICS_LOOK_DIR picks the folder (default test-results).
test("capture: the numbers strip, Commits and Tokens, at 1440 in both themes and Tokens at 390", async ({ page }) => {
  test.skip(process.env.METRICS_CAPTURE !== "1", "manual capture");
  const dir = process.env.METRICS_LOOK_DIR ?? "test-results";
  await page.setViewportSize({ width: 1440, height: 900 });
  // One load: a second visit to a scrolled home is a deep reload with no entrance.
  await openHome(page);
  const settleStrip = async () => {
    await waveIdle(page);
    await expect.poll(() => switchState(page), { timeout: 8000 }).toBe("done");
    await page.mouse.move(4, page.viewportSize()!.height / 2);
    await nextFrames(page, 30);
  };
  const show = async (series: "commits" | "tokens") => {
    if ((await seriesButton(page, series).getAttribute("aria-pressed")) !== "true") await seriesButton(page, series).click();
    await scrollToY(page, await topAt(page, 0.2));
    await expect.poll(() => state(page), { timeout: 5000 }).toBe("skyline");
    await settleStrip();
  };
  const shoot = async (series: "commits" | "tokens", theme: "light" | "dark", suffix: string) => {
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await show(series);
    await page.locator("#numbers").screenshot({ path: `${dir}/metrics-${series}-${theme}${suffix}.png` });
  };
  for (const theme of ["light", "dark"] as const) {
    await shoot("commits", theme, "");
    await shoot("tokens", theme, "");
    await show("commits");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await shoot("tokens", "light", "-390");
});
