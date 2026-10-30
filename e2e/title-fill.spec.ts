import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToFoot, waitForScene } from "./support/coil";
import { noWebgl2Api, noWebglContext } from "./support/webgl";
import { TITLE_KEYS, fillMotion, showTitle, titleContrastNow, titleState, titleStats } from "./support/titles";
import { FILL_HELD_IN_INK } from "@/lib/coil/fillPool";

// Every numbered page's title wears page 1's name's fill (Aaron, 2026-10-29):
// the same field, motion and sheen, from the name's engine (components/coil/
// fill), inside the letters of each page's real heading (TitleFill.tsx). Page
// 1's name is intro.spec.ts's; these are pages 2 to 4: that each draws and
// moves, reads at 3:1 or better against what is really behind it, shifts
// nothing, falls back as the name does, holds at most two contexts with the
// name, and that page 2's waits out the deal. A title held in its ink
// (FILL_HELD_IN_INK: page 2's, under 3:1 on the blue field at 1280 in light)
// stays in ink; ?coildebug=fill-all draws it anyway, so its gate, its pool
// share and its numbers are still tested and read.

const DRAWN = TITLE_KEYS.filter((key) => !FILL_HELD_IN_INK.includes(key));
const HELD = TITLE_KEYS.filter((key) => FILL_HELD_IN_INK.includes(key));

const SIZES = [
  { name: "1280", viewport: { width: 1280, height: 800 }, phone: false },
  { name: "390", viewport: { width: 390, height: 844 }, phone: true },
] as const;

// The fill's canvases' live WebGL contexts (the name's and the titles', not the
// Coil's), the most there ever were at once, and how far from the viewport each
// title was when its context was made.
async function countContexts(page: Page) {
  await page.addInitScript(() => {
    type Made = { ctx: WebGL2RenderingContext; canvas: HTMLCanvasElement };
    const w = window as unknown as { __fills: Made[]; __fillMost: number; __fillMadeAt: number[] };
    w.__fills = [];
    w.__fillMost = 0;
    w.__fillMadeAt = [];
    const live = () => w.__fills.filter((m) => !m.ctx.isContextLost()).length;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      const ctx = (original as (...args: unknown[]) => unknown).call(this, kind, ...rest) as WebGL2RenderingContext | null;
      if (ctx && /webgl/.test(kind) && this.hasAttribute("data-fill-canvas") && !w.__fills.some((m) => m.ctx === ctx)) {
        w.__fills.push({ ctx, canvas: this });
        const r = this.getBoundingClientRect();
        w.__fillMadeAt.push(r.bottom <= 0 ? -r.bottom : r.top >= innerHeight ? r.top - innerHeight : 0);
        w.__fillMost = Math.max(w.__fillMost, live());
      }
      return ctx;
    } as typeof original;
    const tick = () => {
      w.__fillMost = Math.max(w.__fillMost, live());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () =>
    page.evaluate(() => {
      const w = window as unknown as { __fills: { ctx: WebGL2RenderingContext }[]; __fillMost: number; __fillMadeAt: number[] };
      return { live: w.__fills.filter((m) => !m.ctx.isContextLost()).length, most: w.__fillMost, made: w.__fills.length, madeAt: w.__fillMadeAt };
    });
}

for (const size of SIZES) {
  test.describe(`the titles' fill at ${size.name}`, () => {
    test.use({ viewport: size.viewport, deviceScaleFactor: 1, hasTouch: size.phone, isMobile: size.phone });

    test("each title draws the name's fill once it shows, and the fill moves: two frames apart differ inside the letters", async ({ page }) => {
      await openHome(page);
      for (const key of HELD) {
        await showTitle(page, key, "rest");
        await page.waitForTimeout(800);
        expect(await titleState(page, key), `${key}: held in its ink`).toBe("rest");
        expect(await page.locator(`[data-title-fill-key="${key}"] canvas`).count(), `${key}: no canvas`).toBe(0);
      }
      for (const key of DRAWN) {
        await showTitle(page, key);
        await expect.poll(async () => (await titleStats(page, key))?.surfaceIn ?? 0, { message: `${key}: the surface grown in` }).toBe(1);
        const before = (await titleStats(page, key))!.frames;
        const moved = await fillMotion(page, key);
        expect(moved, `${key}: the fill's letters`).not.toBeNull();
        expect(moved!.pixels, `${key}: pixels inside the letters`).toBeGreaterThan(200);
        expect(moved!.mean, `${key}: the mean change inside the letters, two frames 0.7 s apart`).toBeGreaterThan(0.4);
        expect((await titleStats(page, key))!.frames, `${key}: frames while it shows`).toBeGreaterThan(before + 10);
        // The heading is still the heading: its own text, its glyphs hidden only by the text's fill.
        const heading = await page.evaluate((k) => {
          const el = [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length)!;
          const h = el.firstElementChild as HTMLElement;
          const style = getComputedStyle(h);
          return { tag: h.tagName, text: h.textContent, fill: style.webkitTextFillColor, select: style.userSelect, hidden: el.querySelector("canvas")?.getAttribute("aria-hidden") };
        }, key);
        expect(heading.tag).toBe("H2");
        expect(heading.text?.trim().length).toBeGreaterThan(4);
        expect(heading.fill).toBe("rgba(0, 0, 0, 0)");
        expect(heading.select).not.toBe("none");
        expect(heading.hidden).toBe("true");
        test.info().annotations.push({ type: key, description: `mean change ${moved!.mean.toFixed(2)} over ${moved!.pixels} px` });
      }
    });

    for (const colorScheme of ["light", "dark"] as const) {
      test(`each title reads at 3:1 or better against what is really behind it, in ${colorScheme}, or is reported as left in ink`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        // fill-all: a held title draws too, so its numbers are read for the decision.
        await openHome(page, { debug: "1,fill-all" });
        const report: string[] = [];
        for (const key of TITLE_KEYS) {
          await showTitle(page, key);
          await expect.poll(async () => (await titleStats(page, key))?.surfaceIn ?? 0).toBe(1);
          await page.mouse.move(2, size.viewport.height - 2);
          const readings = [];
          // The sheen and the field drift: read at three moments.
          for (let i = 0; i < 3; i++) {
            readings.push((await titleContrastNow(page, key))!);
            await page.waitForTimeout(900);
          }
          const least = Math.min(...readings.map((r) => r.min));
          const held = FILL_HELD_IN_INK.includes(key);
          report.push(`${key}${held ? " (left in ink; its fill, drawn for the readout)" : ""} min ${least.toFixed(2)} (medians ${readings.map((r) => r.median.toFixed(2)).join(", ")})`);
          if (!held) expect.soft(least, `${key}: the weakest glyph's ratio`).toBeGreaterThanOrEqual(3);
        }
        test.info().annotations.push({ type: "contrast", description: report.join("; ") });
      });
    }
  });
}

test.describe("layout shift", () => {
  for (const path of ["/", "/#work"]) {
    test(`stays 0 on ${path} while the titles' fill takes over`, async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __shift: number };
        w.__shift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) w.__shift += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path.replace("/", "/?coildebug=1"));
      await waitForScene(page);
      await page.waitForTimeout(1500);
      // And on down the page: each title's fill takes over from its ink in place.
      if (path === "/#work") for (const key of DRAWN) await showTitle(page, key);
      expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBeLessThan(0.0001);
    });
  }
});

test.describe("the fallbacks are the name's", () => {
  const expectStill = async (page: Page) => {
    await expect(page.locator("[data-name-stage]")).toHaveAttribute("data-name-canvas", "still");
    for (const key of HELD) await expect.poll(() => titleState(page, key), { message: `${key}: held in its ink` }).toBe("rest");
    for (const key of DRAWN) {
      await expect.poll(() => titleState(page, key), { message: key }).toBe("still");
      const look = await page.evaluate((k) => {
        const el = [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length)!;
        const h = el.firstElementChild as HTMLElement;
        const painted = h.querySelector(".sections-line") ?? h;
        const style = getComputedStyle(painted);
        return { clip: style.backgroundClip, image: style.backgroundImage, canvas: el.querySelectorAll("canvas").length };
      }, key);
      expect(look.clip, `${key}: the text is the fill's clip`).toContain("text");
      expect(look.image, `${key}: the field's poster under the accent's veil`).toContain("coil/field-");
      expect(look.canvas, `${key}: no canvas`).toBe(0);
    }
  };

  test("reduced motion: every title wears the name's CSS fill, still, and no canvas is made", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?coildebug=1");
    await expectStill(page);
  });

  test("no WebGL 2 at all, or no context to be had: the same", async ({ page, browser }) => {
    await page.addInitScript(noWebgl2Api);
    await page.goto("/?coildebug=1");
    await expectStill(page);
    const other = await browser.newPage();
    await other.addInitScript(noWebglContext);
    await other.goto("/?coildebug=1");
    await expect.poll(() => titleState(other, "connect")).not.toBe(null);
    // The deal first (it scrolls the page to page 2 on its own), then, with the
    // API but no context, a title only finds out when it is near: bring each one in.
    await other.evaluate(() => document.getElementById("work")!.scrollIntoView({ behavior: "instant" }));
    await other.waitForFunction(() => document.documentElement.dataset.deal === "dealt", null, { timeout: 15_000 });
    for (const key of DRAWN) {
      await other.evaluate((k) => [...document.querySelectorAll(`[data-title-fill-key="${k}"]`)].find((e) => e.getClientRects().length)!.scrollIntoView({ block: "center", behavior: "instant" }), key);
      await expect.poll(() => titleState(other, key), { message: key, timeout: 10_000 }).toBe("still");
    }
    for (const key of HELD) expect(await titleState(other, key), `${key}: held in its ink`).toBe("rest");
    await other.close();
  });

  test("a lost context: the title goes to the name's CSS fill and stays there", async ({ page }) => {
    await openHome(page);
    await showTitle(page, "numbers");
    await page.evaluate(() => {
      const el = [...document.querySelectorAll("[data-title-fill-key=numbers]")].find((e) => e.getClientRects().length)!;
      const canvas = el.querySelector("canvas")!;
      (canvas.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!.loseContext();
    });
    await expect.poll(() => titleState(page, "numbers")).toBe("still");
    await page.waitForTimeout(1000);
    expect(await titleState(page, "numbers"), "no new canvas after a lost one").toBe("still");
  });
});

test("the fill's contexts: never more than two alive on top of the Coil's, none made for a title more than a viewport away, top to bottom and back", async ({ page }) => {
  const read = await countContexts(page);
  // fill-all: every title wears it, the most the pool is ever asked for.
  await openHome(page, { debug: "1,fill-all", at: "top" });
  // Into page 2 the way a reader goes (the deal plays on the way), then on down and back up in steps.
  await page.evaluate(() => document.getElementById("work")!.scrollIntoView({ behavior: "instant" }));
  await page.waitForFunction(() => document.documentElement.dataset.deal === "dealt", null, { timeout: 15_000 });
  const height = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const step = 300;
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(120);
  }
  for (let y = height; y >= 0; y -= step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(600);
  const counted = await read();
  test.info().annotations.push({ type: "contexts", description: `most alive at once ${counted.most}, made ${counted.made}, made at ${counted.madeAt.map(Math.round).join(", ")} px from the viewport` });
  expect(counted.most, "the fill's contexts alive at once").toBeLessThanOrEqual(2);
  expect(counted.made, "the name and the three titles were each made at least once").toBeGreaterThanOrEqual(4);
  const viewportH = page.viewportSize()!.height;
  for (const at of counted.madeAt) expect(at, "how far from the viewport a context was made").toBeLessThanOrEqual(viewportH + 20);
  // Back at the top: the name draws again.
  await expect(page.locator("[data-name-stage]")).toHaveAttribute("data-name-canvas", "on");
});

test("page 2's title waits out the deal: no canvas and no frame from the deal's start until it is unfurled, then its fill takes over", async ({ page }) => {
  // Held in ink by default; fill-all draws it, so the gate is what is tested.
  await openHome(page, { debug: "1,fill-all", at: "foot" });
  await page.evaluate(() => {
    const w = window as unknown as { __workDuring: { deal: string; canvas: number; frames: number }[] };
    w.__workDuring = [];
    const tick = () => {
      const deal = document.documentElement.dataset.deal ?? "";
      if (["dealing", "unfurled"].includes(deal)) {
        const el = [...document.querySelectorAll("[data-title-fill-key=work]")].find((e) => e.getClientRects().length) as (Element & { __titleFill?: { runtime: () => { stats: () => { frames: number } } | null } }) | undefined;
        w.__workDuring.push({ deal, canvas: el?.querySelectorAll("canvas").length ?? 0, frames: el?.__titleFill?.runtime()?.stats().frames ?? 0 });
      }
      if (deal !== "dealt") requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await scrollToFoot(page);
  await page.locator("[data-intro-cta] a").first().click();
  await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  const during = await page.evaluate(() => (window as unknown as { __workDuring: { deal: string; canvas: number; frames: number }[] }).__workDuring);
  expect(during.length, "frames of the deal watched").toBeGreaterThan(30);
  expect(during.filter((f) => f.canvas > 0 || f.frames > 0), "page 2's fill during the deal").toEqual([]);
  await expect.poll(() => titleState(page, "work"), { timeout: 10_000 }).toBe("on");
});
