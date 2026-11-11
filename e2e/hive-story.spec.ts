import { test, expect } from "./support/fixtures";
import { hiveStoryCopy } from "@/lib/content/hive-story";

// /hive-visual, FH08 Hive's public story: every word in the server HTML, a
// phone's first screen that says what it is, bees that fly only when they
// should, and a page that stays out of search and the sitemap until Aaron says.

const PATH = "/hive-visual";

test("hive story: the server HTML carries every word and the whole diagram, and asks not to be indexed", async ({ request }) => {
  const html = await (await request.get(PATH)).text();
  for (const words of [hiveStoryCopy.title, hiveStoryCopy.lede, hiveStoryCopy.flow.rest, hiveStoryCopy.flow.nodes.check.label, hiveStoryCopy.flow.nodes.bee.label, hiveStoryCopy.steps.heading, hiveStoryCopy.calls.heading]) {
    expect(html, words).toContain(words.replace(/'/g, "&#x27;"));
  }
  expect(html).toMatch(/<meta name="robots" content="noindex, follow"/);
  // Two drawings of the flow (the phone column and the desktop row), each with its comb of dots.
  expect(html.match(/viewBox="0 0 358 428"/g)).toHaveLength(1);
  expect(html.match(/viewBox="0 0 1312 424"/g)).toHaveLength(1);
});

test("hive story: stays out of the sitemap", async ({ request }) => {
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(PATH);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hive story: the first screen holds the title, the lede and the diagram, with no sideways scroll", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(hiveStoryCopy.title);
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(widths[0]).toBe(widths[1]);
    const stage = await page.locator(".hive-stage svg").filter({ visible: true }).boundingBox();
    expect(stage).not.toBeNull();
    // The diagram starts on the first screen, and the phone gets the column, not the shrunken row.
    expect(stage!.y).toBeLessThan(844);
    expect(stage!.width).toBeGreaterThan(340);
    await expect(page.locator('.hive-stage svg[viewBox="0 0 358 428"]')).toBeVisible();
  });
});

test("hive story: the team page shows as a laptop shot beside a phone shot, each loaded and described", async ({ page }) => {
  await page.goto(PATH);
  for (const shot of Object.values(hiveStoryCopy.team.shots)) {
    const img = page.getByAltText(shot.alt);
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test.describe("the team page on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hive story: only the phone shot shows, so nothing is shrunk past reading", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByAltText(hiveStoryCopy.team.shots.desktop.alt)).toBeHidden();
    await expect(page.getByAltText(hiveStoryCopy.team.shots.phone.alt)).toBeVisible();
  });
});

test("hive story: the clock runs while the stage is on screen", async ({ page }) => {
  await page.goto(PATH);
  const head = page.locator(".hive-stage-head");
  await expect(head).toHaveAttribute("data-live", "true");
  const clock = page.locator(".hive-clock");
  const first = await clock.textContent();
  // The clock moves on within the first hourly beats (13:17, 14:17, 15:17, 02:30).
  await expect(clock).not.toHaveText(first ?? "", { timeout: 4_000 });
  await expect(page.locator(".hive-caption")).not.toHaveText(hiveStoryCopy.flow.rest);
});

test("hive story: the fact's trip plays step by step once it is on screen", async ({ page }) => {
  await page.goto(PATH);
  const trip = page.locator(".hive-trip");
  await trip.scrollIntoViewIfNeeded();
  await expect(trip).toHaveAttribute("data-playing", "true");
  await expect(trip.locator(".hive-step[data-now]")).toHaveCount(1);
  // Early in the trip the Drive doc (step 6) is dimmed, not gone.
  expect(await trip.locator("[data-at][data-off]").count()).toBeGreaterThan(0);
});

test.describe("under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("hive story: the fact's trip shows every step at once and never plays", async ({ page }) => {
    await page.goto(PATH);
    const trip = page.locator(".hive-trip");
    await trip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2_000);
    await expect(trip).not.toHaveAttribute("data-playing", "true");
    await expect(trip.locator("[data-off]")).toHaveCount(0);
  });

  test("hive story: no bees fly, the canvas stays empty, and the caption is the one-line summary", async ({ page }) => {
    await page.goto(PATH);
    await page.waitForTimeout(1_500);
    await expect(page.locator(".hive-stage-head")).not.toHaveAttribute("data-live", "true");
    await expect(page.locator(".hive-caption")).toHaveText(hiveStoryCopy.flow.rest);
    const inked = await page.locator(".hive-stage canvas").evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 3; i < data.length; i += 4) sum += data[i];
      return sum;
    });
    expect(inked).toBe(0);
  });
});

test("hive story: the bees pause once the stage scrolls away", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator(".hive-stage-head")).toHaveAttribute("data-live", "true");
  await page.locator("#hive-more").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const clock = page.locator(".hive-clock");
  const parked = await clock.textContent();
  // A running loop shows every time on the clock within 15 s, so a clock that
  // holds for longer than one loop is a paused one.
  await page.waitForTimeout(15_500);
  expect(await clock.textContent()).toBe(parked);
});

test("hive story: links back to every part of the portfolio, from the first screen and the end", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator(`#main header a[href="${hiveStoryCopy.backLink.href}"]`)).toBeVisible();
  for (const link of hiveStoryCopy.more.site) await expect(page.locator(`#main a[href="${link.href}"]`)).toHaveText(link.label);
});

const HONEY = "rgb(242, 190, 58)";
const bg = (page: import("@playwright/test").Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test("hive story: the page is honey and the logo light, and the logo stays light and shown on hover and keyboard focus", async ({ page }) => {
  await page.goto(PATH);
  expect(await bg(page)).toBe(HONEY);
  const logo = page.locator("[data-mark-trigger]");
  const look = () => logo.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).opacity, getComputedStyle(el).visibility]);
  expect(await look()).toEqual(["rgb(250, 250, 247)", "1", "visible"]);
  await logo.hover();
  expect(await look()).toEqual(["rgb(250, 250, 247)", "1", "visible"]);
  await page.mouse.move(700, 600);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(logo).toBeFocused();
  expect(await look()).toEqual(["rgb(250, 250, 247)", "1", "visible"]);
});

for (const [label, target, selector] of [["the MVP", "/quick", 'a[href="/quick"]'], ["the home", "/", 'header a[href="/"]']] as const) {
  test(`hive story: leaving for ${label} by a link shows the normal background, with no honey on the new page`, async ({ page }) => {
    await page.goto(PATH);
    expect(await bg(page)).toBe(HONEY);
    // Sample every frame: once the new page's content is in, the background must never be honey.
    await page.evaluate(() => {
      const w = window as unknown as { __bg: [boolean, string][] };
      w.__bg = [];
      const tick = () => {
        w.__bg.push([!document.querySelector('main[data-page="hive-visual"]'), getComputedStyle(document.documentElement).backgroundColor]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.locator(`#main ${selector}`).first().click();
    await page.waitForURL((url) => url.pathname === target);
    await page.waitForTimeout(600);
    const samples = await page.evaluate(() => (window as unknown as { __bg?: [boolean, string][] }).__bg ?? []);
    expect(samples.filter(([gone, color]) => gone && color === HONEY)).toEqual([]);
    expect(await bg(page)).not.toBe(HONEY);
  });
}

test.describe("dark mode elsewhere", () => {
  test.use({ colorScheme: "dark" });

  test("hive story: the honey stays on its page; the MVP keeps the dark theme", async ({ page }) => {
    await page.goto(PATH);
    expect(await bg(page)).toBe(HONEY);
    await page.goto("/quick");
    expect(await bg(page)).toBe("rgb(14, 20, 25)");
  });
});

test("hive story: links out open in a new tab without an opener", async ({ page }) => {
  await page.goto(PATH);
  const external = page.locator('#main a[href^="https://"]');
  expect(await external.count()).toBe(hiveStoryCopy.more.products.length);
  for (const link of await external.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
