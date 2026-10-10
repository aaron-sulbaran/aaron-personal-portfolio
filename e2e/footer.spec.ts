import { siteContent } from "@/lib/content";
import { FOOTER as F } from "@/lib/footer/constants";
import { eggTotalMs } from "@/lib/footer/egg";
import { bandShare } from "@/lib/footer/geometry";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { FOOTER, footerBoxes, parsePose, readWord, recordWord, toFooter, waitForWord } from "./support/footer";

// The footer (slice C6): the server's small lines and reserved band, the
// wordmark at rest and its egg, the field's chunk and its fallbacks.

const C = siteContent.footer;
const SHARE = bandShare(C.wordmark);
const LINES_ROW = 180; // the small lines' row from md: the footer lab's Connect row (pt-20 plus 100px)
const PERIOD = [...C.wordmark].indexOf(".");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Task 7: the shell ----

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("footer: the server reserves the word's band under the small lines", async ({ page }) => {
    await page.goto("/");
    const b = await footerBoxes(page);
    expect(b.band.height).toBeCloseTo(SHARE * b.width, 0);
    expect(b.lines.height).toBeCloseTo(LINES_ROW, 0);
    expect(b.height).toBeCloseTo(LINES_ROW + SHARE * b.width, 0);
    const footer = page.locator(FOOTER);
    await expect(footer.getByText(C.tagline(""), { exact: false })).toBeVisible();
    await expect(footer.getByText(C.copyright, { exact: true })).toBeVisible();
    await expect(footer.getByText(C.wordmark, { exact: true })).toBeAttached();
  });
});

test("footer: the word mounts into its band, so nothing below Connect moves", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const b = await footerBoxes(page);
  expect(b.band.height).toBeCloseTo(SHARE * b.width, 0);
  expect(b.height).toBeCloseTo(LINES_ROW + SHARE * b.width, 0);
  expect(b.lines.top).toBeCloseTo(0, 0);
});

test("footer: from its first layout to the word at rest, the footer never changes height", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __footerHeights: number[] };
    w.__footerHeights = [];
    const watch = () => {
      const footer = document.querySelector("footer[data-footer]");
      if (!footer) return false;
      new ResizeObserver((entries) => entries.forEach((e) => w.__footerHeights.push(e.borderBoxSize[0].blockSize))).observe(footer);
      return true;
    };
    if (!watch()) {
      const mo = new MutationObserver(() => watch() && mo.disconnect());
      mo.observe(document, { childList: true, subtree: true });
    }
  });
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const heights = await page.evaluate(() => (window as unknown as { __footerHeights: number[] }).__footerHeights);
  expect(heights.length).toBeGreaterThan(0);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.5);
});

// ---- Task 8: the wordmark ----

test("footer: at rest the word sits whole on its baseline inside the footer, the period button over the period", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const w = await readWord(page);
  expect(w.chars.join("")).toBe(C.wordmark);
  for (const t of w.transforms) {
    const p = parsePose(t);
    expect(p.y).toBeCloseTo(w.baseline, 1);
    expect(p.squash).toBe(1);
    expect(p.angle).toBe(0);
  }
  const rects = await page.evaluate(() => {
    const r = (el: Element) => el.getBoundingClientRect();
    return { footer: r(document.querySelector("footer[data-footer]")!), tint: r(document.querySelector("[data-footer-tint]")!), button: r(document.querySelector("[data-egg]")!) };
  });
  expect(rects.tint.left).toBeGreaterThanOrEqual(rects.footer.left);
  expect(rects.tint.right).toBeLessThanOrEqual(rects.footer.right);
  expect(rects.tint.bottom).toBeLessThanOrEqual(rects.footer.bottom);
  // The ink spans the word's 92 percent less its first and last letters' outer gaps.
  expect(rects.tint.width / rects.footer.width).toBeGreaterThan(0.9);
  expect(rects.tint.width / rects.footer.width).toBeLessThanOrEqual(F.fitShare);
  const period = parsePose(w.transforms[PERIOD]);
  expect(rects.button.left + rects.button.width / 2 - rects.footer.left).toBeCloseTo(period.x, 0);
  expect(rects.button.width).toBeGreaterThanOrEqual(F.hitPx.min);
  // The footer clips its overflow: the button and its focus ring end inside it.
  expect(rects.button.bottom + F.hitPx.ring).toBeLessThanOrEqual(rects.footer.bottom);
  await expect(page.getByRole("button", { name: C.dropPeriod })).toBeVisible();
  await expect(page.locator("svg[data-wordmark]")).toHaveAttribute("aria-hidden", "true");
  // Seen once: away and back, the word does not rise again.
  await scrollToY(page, 0);
  await toFooter(page);
  await nextFrames(page, 5);
  expect((await readWord(page)).transforms).toEqual(w.transforms);
});

test("footer: the letters swell toward the pointer and spring back after a press", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const before = await readWord(page);
  const l = parsePose(before.transforms[3]);
  const box = (await page.locator(FOOTER).boundingBox())!;
  await page.mouse.move(box.x + l.x, box.y + before.baseline - before.size / 2);
  await sleep(600);
  const swelled = await page.evaluate(() => document.querySelectorAll<SVGPathElement>("svg[data-wordmark] defs path")[3].getAttribute("d"));
  await page.mouse.down();
  const pressed = recordWord(page, 400);
  const frames = await pressed;
  await page.mouse.up();
  expect(Math.min(...frames.map((f) => parsePose(f[3]).squash))).toBeLessThan(0.8);
  await page.mouse.move(2, 2);
  await waitForWord(page);
  const after = await readWord(page);
  expect(after.transforms).toEqual(before.transforms);
  expect(swelled).not.toBe(await page.evaluate(() => document.querySelectorAll<SVGPathElement>("svg[data-wordmark] defs path")[3].getAttribute("d")));
});

test("footer: the period drops, hops a quarter turn, lands, and the ripple runs through the letters", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const rest = await readWord(page);
  const recording = recordWord(page, eggTotalMs(F.egg) + 900);
  await page.getByRole("button", { name: C.dropPeriod }).click();
  const frames = await recording;
  await page.mouse.move(2, 2); // off the button: the letters near it swell while it hovers
  const period = frames.map((f) => parsePose(f[PERIOD]));
  expect(Math.min(...period.map((p) => p.y)), "the hop's apex").toBeLessThan(rest.baseline - 0.3 * rest.size);
  expect(period.some((p) => p.angle > 30 && p.angle < 60), "half turned in the air").toBe(true);
  expect(Math.max(...period.map((p) => p.angle)), "past the turn on landing").toBeGreaterThan(F.egg.turnDeg);
  for (const i of [PERIOD - 1, PERIOD + 1]) expect(Math.min(...frames.map((f) => parsePose(f[i]).squash)), `letter ${i} dips`).toBeLessThan(0.97);
  await waitForWord(page);
  expect((await readWord(page)).transforms).toEqual(rest.transforms);
});

test("footer: Enter and Space drop the period; five quick clicks make two hops", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const { baseline, size } = await readWord(page);
  const lifted = (frames: string[][]) => {
    let hops = 0;
    let up = false;
    for (const f of frames) {
      const high = parsePose(f[PERIOD]).y < baseline - 0.2 * size;
      if (high && !up) hops++;
      up = high;
    }
    return hops;
  };
  const button = page.getByRole("button", { name: C.dropPeriod });
  await button.focus();
  for (const key of ["Enter", "Space"]) {
    const rec = recordWord(page, eggTotalMs(F.egg) + 200);
    await page.keyboard.press(key);
    expect(lifted(await rec), key).toBe(1);
    await waitForWord(page);
  }
  const rec = recordWord(page, 2 * eggTotalMs(F.egg) + 600);
  for (let i = 0; i < 5; i++) await button.click({ delay: 10 });
  expect(lifted(await rec)).toBe(2);
});

test("footer: a resize mid-hop lands the word at rest at the new size", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  await page.getByRole("button", { name: C.dropPeriod }).click();
  await page.mouse.move(2, 2);
  await sleep(300);
  await page.setViewportSize({ width: 1024, height: 768 });
  await toFooter(page);
  await waitForWord(page);
  const w = await readWord(page);
  const footer = (await page.locator(FOOTER).boundingBox())!;
  expect(w.size).toBeCloseTo(footer.width * (SHARE / 1.4), 0);
  for (const t of w.transforms) {
    const p = parsePose(t);
    expect(p.y).toBeCloseTo(w.baseline, 1);
    expect(p.squash).toBe(1);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(footer.width);
  }
});
