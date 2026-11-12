import { test, expect } from "./support/fixtures";
import { hiveStoryCopy } from "@/lib/content/hive-story";
import { LAYOUTS, checkCenter } from "@/lib/hive-story/flow";

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
  await expect(page.locator(".hive-stage-head").getByText(hiveStoryCopy.flow.rest)).toBeHidden();
});

test("hive story: the stage opens on its summary, holds it, then crossfades to step 1", async ({ page }) => {
  await page.goto(PATH);
  const head = page.locator(".hive-stage-head");
  // Held well past hydration: the summary is still the stage's line, with no clock and no step caption yet.
  await page.waitForTimeout(1_500);
  await expect(head.getByText(hiveStoryCopy.flow.rest)).toBeVisible();
  await expect(head).not.toHaveAttribute("data-live", "true");
  await expect(page.locator(".hive-clock")).toBeHidden();
  // Then step 1 fades in as the summary fades out, never a cut: sample every frame until it settles.
  const frames = await page.evaluate(() => new Promise<number[][]>((resolve) => {
    const summary = document.querySelector(".hive-summary"), caption = document.querySelector(".hive-caption");
    if (!summary || !caption) return resolve([]);
    const out: number[][] = [];
    const tick = () => {
      out.push([Number(getComputedStyle(summary).opacity), Number(getComputedStyle(caption).opacity)]);
      const [s, c] = out[out.length - 1];
      if (out.length > 900 || (s === 0 && c === 1)) resolve(out);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  expect(frames.at(-1)).toEqual([0, 1]);
  expect(frames.some(([s]) => s > 0 && s < 1), "the summary fades out").toBe(true);
  expect(frames.some(([, c]) => c > 0 && c < 1), "step 1 fades in").toBe(true);
  await expect(page.locator(".hive-caption")).toHaveText(hiveStoryCopy.flow.captions[0]);
  await expect(page.locator(".hive-clock")).toBeVisible();
});

test.describe("with JavaScript off", () => {
  test.use({ javaScriptEnabled: false });

  test("hive story: the stage rests on its summary, with no clock and no step caption", async ({ page }) => {
    await page.goto(PATH);
    const head = page.locator(".hive-stage-head");
    await expect(head.getByText(hiveStoryCopy.flow.rest)).toBeVisible();
    await expect(head.getByText(hiveStoryCopy.flow.captions[0])).toBeHidden();
    await expect(page.locator(".hive-clock")).toBeHidden();
  });

  test("hive story: no step controls show, since they do nothing without JavaScript", async ({ page }) => {
    await page.goto(PATH);
    const groups = page.locator('[role="group"][aria-label$="step through"]');
    await expect(groups).toHaveCount(4);
    for (const group of await groups.all()) await expect(group).toBeHidden();
  });
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
    // Held, the toggle offers Play, with its word and icon to match, and no Pause left to contradict it.
    await expect(group.getByRole("button", { name: /^Play,/ })).toBeVisible();
    await expect(group.getByRole("button", { name: /^Play,/ })).toHaveText("Play");
    await expect(group.getByRole("button", { name: /^Play,/ }).locator("svg.lucide-play")).toHaveCount(1);
    await expect(group.getByRole("button", { name: /^Pause,/ })).toHaveCount(0);
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
    await expect(controls.getByRole("button", { name: /^Pause,/ })).toHaveText("Pause");
    await controls.getByRole("button", { name: /^Pause,/ }).click();
    await expect(controls.getByRole("button", { name: /^Play,/ })).toHaveText("Play");
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
  for (const selector of [".hive-exhibit figcaption", ".hive-exhibit .text-muted", ".hive-loop .text-muted", ".hive-loop-step", "#hive-calls ~ * .text-muted", ".hive-step p", ".hive-summary", ".hive-caption"]) {
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

test("hive story: the tools list's heading claims nothing, and every group under it shows its running now or next marker", async ({ page }) => {
  await page.goto(PATH);
  const heading = page.getByRole("heading", { name: hiveStoryCopy.calls.toolsLabel });
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toBeVisible();
  await expect(heading).not.toContainText(/built/i);
  for (const group of [hiveStoryCopy.calls.tools.connector, hiveStoryCopy.calls.tools.beekeeper]) {
    const label = page.locator("#main p", { hasText: group.label });
    await expect(label).toBeVisible();
    await expect(label.locator(".hive-marker")).toBeVisible();
  }
});

test("hive story: the Beekeeper demo says it is a mock-up, and the exhibit says it is an illustration, in visible text", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByText(hiveStoryCopy.calls.loop.note)).toBeVisible();
  // Planned, not live: the demo opens with a Next tag and the page's open "next" marker, above its panes.
  const tag = page.locator(".hive-loop").getByText(hiveStoryCopy.calls.loop.tag, { exact: true });
  await expect(tag).toBeVisible();
  await expect(tag.locator(".hive-marker-next")).toHaveCount(1);
  expect((await tag.boundingBox())!.y).toBeLessThan((await page.locator(".hive-loop-panes").boundingBox())!.y);
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
    await expect(page.locator(".hive-stage-head").getByText(hiveStoryCopy.flow.rest)).toBeVisible();
    await expect(page.locator(".hive-stage-head").getByText(hiveStoryCopy.flow.captions[0])).toBeHidden();
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

test("hive story: the team page is listed as running now, and its part of the diagram is drawn as live", async ({ page }) => {
  await page.goto(PATH);
  const column = (label: string) => page.locator('section[aria-labelledby="hive-status"] h3', { hasText: new RegExp(`^${label}$`) }).locator("xpath=..");
  await expect(column("Running now")).toContainText("The team page");
  await expect(column("Next")).not.toContainText("The team page");
  const nodes = page.locator(".hive-stage svg g", { has: page.locator(`text=${hiveStoryCopy.flow.nodes.page.label}`) });
  await expect(nodes).toHaveCount(2);
  for (const node of await nodes.all()) {
    await expect(node).not.toHaveAttribute("data-next", /.*/);
    await expect(node).not.toContainText("next");
  }
});

test("hive story: the AI pane and Beekeeper's channel share an edge side by side", async ({ page }) => {
  await page.goto(PATH);
  const loop = page.locator(".hive-loop");
  await loop.scrollIntoViewIfNeeded();
  const controls = page.locator('[role="group"][aria-label^="From a teammate"]');
  // The channel's height changes with the step, so check two steps, stepping whichever way is open.
  for (let i = 0; i < 2; i++) {
    const [ai, channel] = await Promise.all([page.locator(".hive-ai").boundingBox(), page.locator(".hive-discord").boundingBox()]);
    expect(Math.abs(ai!.y - channel!.y)).toBeLessThan(1);
    expect(Math.abs(ai!.height - channel!.height), `step ${await controls.locator(".hive-control-count").textContent()}`).toBeLessThan(1);
    const back = controls.getByRole("button", { name: /^Back,/ });
    await ((await back.isEnabled()) ? back : controls.getByRole("button", { name: /^Next,/ })).click();
  }
});

// Whether an element's hit area, pseudo-elements included, reaches 44 px across and 44 px down
// through its center. Hit testing follows border-radius, so a round target is measured on its axes.
const hitsAll44 = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const lands = (x: number, y: number) => { const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit)); };
    return [[-21.5, 0], [21.5, 0], [0, -21.5], [0, 21.5]].every(([dx, dy]) => lands(cx + dx, cy + dy));
  });

for (const width of [390, 1440]) {
  test.describe(`tap targets at ${width}`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

    test(`hive story: the step controls, the logo back to the top, and the portfolio links are 44 px targets at ${width}`, async ({ page }) => {
      await page.goto(PATH);
      await page.waitForTimeout(300);
      expect(await hitsAll44(page.getByRole("button", { name: "Back to top" })), "the logo").toBe(true);
      for (const control of await page.locator(".hive-control").all()) {
        await control.scrollIntoViewIfNeeded();
        expect(await hitsAll44(control), (await control.getAttribute("aria-label")) ?? "control").toBe(true);
      }
      for (const link of await page.locator('section[aria-labelledby="hive-more"] a').all()) {
        await link.scrollIntoViewIfNeeded();
        const box = await link.boundingBox();
        expect(box!.height, (await link.textContent()) ?? "link").toBeGreaterThanOrEqual(44);
        expect(box!.width, (await link.textContent()) ?? "link").toBeGreaterThanOrEqual(44);
        // The bigger box keeps the words as written: no space lost where a label mixes in bold.
        const [shown, written] = await link.evaluate((el) => [(el as HTMLElement).innerText.trim(), (el.textContent ?? "").trim()]);
        expect(shown).toBe(written);
      }
    });
  });
}

test.describe("the diagram on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hive story: every word in the phone diagram is 12 px or more", async ({ page }) => {
    await page.goto(PATH);
    const sizes = await page.locator('.hive-stage svg[viewBox="0 0 358 428"]').evaluate((svg) => {
      const scale = svg.getBoundingClientRect().width / 358;
      return [...svg.querySelectorAll("text")].map((text) => [text.textContent ?? "", Math.round(parseFloat(getComputedStyle(text).fontSize) * scale * 10) / 10] as const);
    });
    expect(sizes.length).toBeGreaterThan(10);
    expect(sizes.filter(([, px]) => px < 12)).toEqual([]);
    // Bigger words still clear the author's check drawn inside Beekeeper's part.
    const c = checkCenter(LAYOUTS.tall), half = LAYOUTS.tall.size.checkSize / 2;
    const touching = await page.locator('.hive-stage svg[viewBox="0 0 358 428"]').evaluate((svg, box) => [...svg.querySelectorAll("text")]
      .filter((text) => { const b = (text as SVGGraphicsElement).getBBox(); return b.x < box.x2 && b.x + b.width > box.x1 && b.y < box.y2 && b.y + b.height > box.y1; })
      .map((text) => text.textContent), { x1: c.x - half, x2: c.x + half, y1: c.y - half, y2: c.y + half });
    expect(touching).toEqual([]);
  });
});

// The desktop row scales with the stage (928 px across at 1024, 1312 at 1440), so every width it shows at is checked.
for (const width of [1024, 1280, 1440]) {
  test.describe(`the desktop diagram at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test(`hive story: every word in the desktop diagram is 12 px or more at ${width}, and each part's words stay inside it`, async ({ page }) => {
      await page.goto(PATH);
      const nodes = Object.fromEntries((Object.keys(LAYOUTS.wide.nodes) as (keyof typeof LAYOUTS.wide.nodes)[]).map((key) => [hiveStoryCopy.flow.nodes[key].label, LAYOUTS.wide.nodes[key]]));
      const report = await page.locator('.hive-stage svg[viewBox="0 0 1312 424"]').evaluate((svg, parts) => {
        const scale = svg.getBoundingClientRect().width / 1312;
        const shown = [...svg.querySelectorAll("text")].filter((text) => getComputedStyle(text).display !== "none");
        const small = shown.map((text) => [text.textContent ?? "", Math.round(parseFloat(getComputedStyle(text).fontSize) * scale * 10) / 10] as const).filter(([, px]) => px < 12);
        const spill: string[] = [];
        for (const group of svg.querySelectorAll("g")) {
          const name = group.querySelector(":scope > text")?.textContent ?? "";
          const box = parts[name];
          if (!box) continue;
          for (const text of group.querySelectorAll(":scope > text")) {
            if (getComputedStyle(text).display === "none") continue;
            const b = (text as SVGGraphicsElement).getBBox();
            if (b.x < box.x || b.x + b.width > box.x + box.w - 6 || b.y < box.y || b.y + b.height > box.y + box.h) spill.push(text.textContent ?? "");
          }
        }
        return { count: shown.length, small, spill };
      }, nodes);
      expect(report.count).toBeGreaterThan(15);
      expect(report.small).toEqual([]);
      expect(report.spill).toEqual([]);
    });
  });
}

test("hive story: links out open in a new tab without an opener", async ({ page }) => {
  await page.goto(PATH);
  const external = page.locator('#main a[href^="https://"]');
  expect(await external.count()).toBe(hiveStoryCopy.more.products.length);
  for (const link of await external.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
