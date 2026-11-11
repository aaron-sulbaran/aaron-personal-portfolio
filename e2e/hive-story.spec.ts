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
    const stage = await page.locator(".hive-stage-box > svg").filter({ visible: true }).boundingBox();
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
  // The playing step is marked, and no step's text is faded: every line keeps
  // its full contrast on honey (WCAG 1.4.3), playing or not.
  expect(await trip.locator(".hive-step").evaluateAll((items) => items.map((el) => getComputedStyle(el).opacity))).toEqual(Array(6).fill("1"));
  await expect(trip.locator(".hive-step[data-now] .hive-step-n")).toHaveCSS("background-color", "rgb(34, 22, 15)");
  // Early in the trip the Drive doc (step 6) is dimmed, not gone.
  expect(await trip.locator("[data-at][data-off]").count()).toBeGreaterThan(0);
});

test("hive story: every animation can be stepped by hand, and a step holds until the reader moves on", async ({ page }) => {
  await page.goto(PATH);
  const groups = page.locator('[role="group"][aria-label$="step through"]');
  await expect(groups).toHaveCount(4);
  for (const group of await groups.all()) {
    await group.scrollIntoViewIfNeeded();
    const count = group.locator(".hive-control-count");
    const next = group.getByRole("button", { name: /^Next,/ });
    const back = group.getByRole("button", { name: /^Back,/ });
    // Step whichever way is open (the loop may sit on its last step), then the other way.
    const forward = await next.isEnabled();
    await (forward ? next : back).click();
    await page.waitForTimeout(300);
    const held = await count.textContent();
    await expect(group.getByRole("button", { name: /^Pause,/ })).toHaveAttribute("aria-pressed", "true");
    await expect(count).toHaveText(/^Step \d of \d$/);
    await expect(count).toHaveAttribute("aria-live", "polite");
    await page.waitForTimeout(2_600);
    expect(await count.textContent()).toBe(held);
    await (forward ? back : next).click();
    await expect(count).not.toHaveText(held ?? "");
  }
});

// A canvas's pixels, hashed, so a frozen piece can be told from a moving one.
const canvasHash = (page: import("@playwright/test").Page, selector: string) =>
  page.locator(selector).evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0;
    for (let i = 0; i < data.length; i += 97) h = (h * 31 + data[i]) | 0;
    return h;
  });

test("hive story: Pause stops all motion in its piece", async ({ page }) => {
  await page.goto(PATH);
  for (const [group, canvas] of [["How information moves", ".hive-stage canvas"], ["Aside: the exhibit itself", ".hive-exhibit canvas"]] as const) {
    const controls = page.locator(`[role="group"][aria-label^="${group}"]`);
    await controls.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await controls.getByRole("button", { name: /^Pause,/ }).click();
    await expect(controls.getByRole("button", { name: /^Pause,/ })).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(200);
    const still = await canvasHash(page, canvas);
    await page.waitForTimeout(1_200);
    expect(await canvasHash(page, canvas)).toBe(still);
  }
  for (const [group, marker] of [["How one fact gets in", ".hive-trip"], ["From a teammate", ".hive-loop"]] as const) {
    const controls = page.locator(`[role="group"][aria-label^="${group}"]`);
    await controls.scrollIntoViewIfNeeded();
    await controls.getByRole("button", { name: /^Pause,/ }).click();
    const count = controls.locator(".hive-control-count");
    const held = await count.textContent();
    await page.waitForTimeout(2_800);
    expect(await count.textContent(), marker).toBe(held);
  }
});

test("hive story: the step controls show a keyboard ring on the honey", async ({ page }) => {
  await page.goto(PATH);
  const next = page.locator('[role="group"][aria-label^="How information moves"]').getByRole("button", { name: /^Next,/ });
  await next.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(next).toBeFocused();
  const ring = await next.evaluate((el) => { const s = getComputedStyle(el); return [s.outlineStyle, parseFloat(s.outlineWidth), s.outlineColor]; });
  expect(ring[0]).toBe("solid");
  expect(ring[1]).toBeGreaterThanOrEqual(2);
  expect(ring[2]).toBe("rgb(27, 58, 92)");
});

// WCAG contrast of an element's text against the first opaque background behind it.
async function contrastOf(page: import("@playwright/test").Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (m) { const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean); return [Number(r) / 255, Number(g) / 255, Number(b) / 255, Number(a)]; }
      const k = c.match(/color\(srgb ([^)]+)\)/);
      if (k) { const [r, g, b, , a] = k[1].split(/\s+/); return [Number(r), Number(g), Number(b), a ? Number(a) : 1]; }
      return [0, 0, 0, 0];
    };
    const lum = ([r, g, b]: number[]) => [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    let node: Element | null = el, bg = [0, 0, 0, 0];
    while (node && bg[3] < 1) { bg = parse(getComputedStyle(node).backgroundColor); node = node.parentElement; }
    if (bg[3] < 1) bg = parse(getComputedStyle(document.documentElement).backgroundColor);
    const fg = parse(getComputedStyle(el).color);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}

test("hive story: the new text on honey meets contrast: 4.5 for body text, 3 for the controls", async ({ page }) => {
  await page.goto(PATH);
  for (const selector of [".hive-exhibit figcaption", ".hive-exhibit .text-muted", ".hive-loop .text-muted", ".hive-loop-step", "#hive-calls ~ * .text-muted", ".hive-step p", ".hive-caption"]) {
    if (!(await page.locator(selector).count())) continue;
    expect(await contrastOf(page, selector), selector).toBeGreaterThanOrEqual(4.5);
  }
  for (const selector of [".hive-control", ".hive-control-count", ".hive-aside-tag"]) expect(await contrastOf(page, selector), selector).toBeGreaterThanOrEqual(3);
});

test.describe("the controls on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hive story: every set of step controls fits at 390 with no sideways scroll", async ({ page }) => {
    await page.goto(PATH);
    for (const group of await page.locator('[role="group"][aria-label$="step through"]').all()) {
      await group.scrollIntoViewIfNeeded();
      const box = await group.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});

test("hive story: the Beekeeper demo says it is a mock-up, and the exhibit says it is an illustration, in visible text", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByText(hiveStoryCopy.calls.loop.note)).toBeVisible();
  await expect(page.getByText(hiveStoryCopy.why.exhibit.note)).toBeVisible();
});

test.describe("under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("hive story: nothing plays, but Back and Next still step through still frames", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole("button", { name: /^(Play|Pause),/ })).toHaveCount(0);
    const hero = page.locator('[role="group"][aria-label^="How information moves"]');
    await hero.getByRole("button", { name: /^Next,/ }).click();
    await expect(page.locator(".hive-caption")).toHaveText(hiveStoryCopy.flow.captions[1]);
    const inked = await page.locator(".hive-stage canvas").evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 3; i < data.length; i += 4) sum += data[i];
      return sum;
    });
    expect(inked).toBeGreaterThan(0);
  });

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
