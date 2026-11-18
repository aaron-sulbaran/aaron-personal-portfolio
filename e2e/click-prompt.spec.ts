import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, waitForScene } from "./support/coil";
import { cardRow } from "./support/cards";
import { noWebgl2Api } from "./support/webgl";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { DEFAULT_KNOBS, PROMPT_VERSIONS } from "@/lib/home/dealKnobs";
import { promptPlan } from "@/lib/home/clickPrompt";
import { CARD_OPENED_KEY } from "@/lib/home/firstOpen";

// The "Click a card to open it" moment (the click prompt lab): on a first
// visit's deal a big line shows over the Coil, then shrinks into the spot under
// the Work column (under the page title on a phone) and rests there; a card
// opened once, ever, ends it for good. The page's own sampler (watchPrompt)
// records one row per animation frame from before the page's scripts run, so
// every time below is what the visitor saw, measured from the moment the deal
// began (marks.dealing, the click that the plan's milliseconds count from).
// Production builds fix the knobs at the defaults (plate, Early, today's speed);
// a test picks a version or a mode with ?coildebug=...,prompt=<v>,timing=<m>.

const { prompt, progress } = siteContent.columns;
const PLAN = promptPlan(DEFAULT_KNOBS);
const CAP_MS = COIL.deal.cutscene.capMs;
const OPENED_ONE = progress(1, 14);

type Box = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };
type Edges = { left: number; top: number; right: number; bottom: number };
type Full = { box: Box; mark: Edges | null; menu: Edges | null; quads: Point[][] | null; vw: number; vh: number };
type PromptFrame = { t: number; opacity: number; box: Box | null; host: string };
type PromptLog = {
  frames: PromptFrame[];
  marks: Record<string, number>;
  lockOff: number | null;
  clickAt: number | null;
  full: Full | null;
};
type PromptWindow = Window & { __prompt: PromptLog };

// The sampler, installed before any script of the page (so it is on the first
// frame of a fresh load too). The overlay and the hosts mount after hydration,
// so every read is guarded. The mutation observer watches `document`, not the
// html element, which does not exist yet when an init script runs.
async function watchPrompt(page: Page) {
  await page.addInitScript((menuLabel) => {
    const log: PromptLog = { frames: [], marks: {}, lockOff: null, clickAt: null, full: null };
    (window as unknown as PromptWindow).__prompt = log;
    let lockSeen = false;
    new MutationObserver(() => {
      const root = document.documentElement;
      const deal = root.dataset.deal;
      if (deal && !(deal in log.marks)) log.marks[deal] = performance.now();
      if (root.hasAttribute("data-deal-lock")) lockSeen = true;
      else if (lockSeen && log.lockOff === null) log.lockOff = performance.now();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-deal", "data-deal-lock"] });
    window.addEventListener(
      "click",
      () => {
        if (log.clickAt === null) log.clickAt = performance.now();
      },
      true,
    );
    const edges = (r: DOMRect): Edges => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const edgesOf = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? edges(el.getBoundingClientRect()) : null;
    };
    const sample = () => {
      const overlay = document.querySelector<HTMLElement>("[data-prompt-stage]");
      const text = overlay?.querySelector<HTMLElement>("[data-prompt-text]");
      let opacity = 0;
      let box: Box | null = null;
      if (overlay && text) {
        const style = getComputedStyle(overlay);
        opacity = style.visibility === "hidden" ? 0 : Number(style.opacity);
        const r = text.getBoundingClientRect();
        box = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
      const host = Array.from(document.querySelectorAll<HTMLElement>("#work [data-prompt-host]")).find((h) => h.getClientRects().length > 0);
      log.frames.push({ t: performance.now(), opacity, box, host: host?.dataset.prompt ?? "" });
      if (opacity >= 0.99 && box && !log.full) {
        const coil = (window as unknown as { __coil?: { visibleQuads?: () => { x: number; y: number }[][] } }).__coil;
        const quads = coil?.visibleQuads?.();
        log.full = {
          box,
          mark: edgesOf("[data-mark-trigger]"),
          menu: edgesOf(`[aria-label="${menuLabel}"]`),
          quads: quads ?? null,
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, siteContent.menu.ariaLabelOpen);
}

const readLog = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as PromptWindow).__prompt)) as PromptLog);
const html = (page: Page) => page.locator("html");
const dealLink = (page: Page) => page.getByRole("link", { name: siteContent.intro.teaser.deal });
const restingLine = (page: Page) => page.locator("#work [data-prompt-host]:visible [data-prompt-line]");
const restingHost = (page: Page) => page.locator("#work [data-prompt-host]:visible");
const rel = (log: PromptLog, t: number) => t - log.marks.dealing;
// A point inside a convex quad: on one side of every edge (either winding).
const inQuad = (px: number, py: number, quad: Point[]) => {
  const sides = quad.map((a, i) => {
    const b = quad[(i + 1) % quad.length];
    return (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
  });
  return sides.every((side) => side >= 0) || sides.every((side) => side <= 0);
};
const coveredShare = (box: Box, quads: Point[][]) => {
  let covered = 0;
  const cols = 40;
  const rows = 6;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const px = box.left + ((i + 0.5) / cols) * box.width;
      const py = box.top + ((j + 0.5) / rows) * box.height;
      if (quads.some((quad) => inQuad(px, py, quad))) covered++;
    }
  }
  return covered / (cols * rows);
};
const meets = (a: Edges, b: Edges) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const edgesOfBox = (b: Box): Edges => ({ left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height });

// The product of the opacities from the element up: what the visitor sees.
const seenOpacity = (locator: Locator) =>
  locator.evaluate((el) => {
    let o = 1;
    for (let node: Element | null = el; node; node = node.parentElement) o *= Number(getComputedStyle(node).opacity);
    return o;
  });
const overlayOpacity = (page: Page) =>
  page.evaluate(() => {
    const overlay = document.querySelector("[data-prompt-stage]");
    return overlay ? Number(getComputedStyle(overlay).opacity) : 0;
  });

async function expectLineShown(page: Page, text: string) {
  await expect(restingLine(page)).toHaveText(text, { timeout: 5000 });
  await expect.poll(() => seenOpacity(restingLine(page)), { timeout: 4000 }).toBe(1);
}

async function expectDealt(page: Page) {
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
}

// The latest sampled frame has the host landed (the first such frame is in the log by then).
const waitForLanded = (page: Page) =>
  page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.frames.at(-1)?.host === "landed", null, { timeout: 15_000 });
const waitForFull = (page: Page) =>
  page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.frames.some((f) => f.opacity >= 0.99), null, { timeout: 15_000 });

// The home loaded and its deal state read, with or without a scene.
const waitForHome = (page: Page) => page.waitForFunction(() => document.documentElement.dataset.home === "ready", null, { timeout: 30_000 });

// A first visit's deal from page 1's foot, by the button.
async function dealFromFoot(page: Page, debug = "flight") {
  await watchPrompt(page);
  await openHome(page, { debug, at: "foot" });
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
}

function expectNeverShown(log: PromptLog) {
  expect(log.frames.filter((f) => f.opacity > 0).length, "frames with the big text showing").toBe(0);
}

test("a first visit's deal shows the big text at its time, and it shrinks into the spot under the Work column, resting as Click a card to open it", async ({ page }) => {
  await dealFromFoot(page);
  await expectDealt(page);
  await waitForLanded(page);
  const log = await readLog(page);
  const shown = log.frames.find((f) => f.opacity > 0)!;
  const full = log.frames.find((f) => f.opacity >= 0.99)!;
  const landed = log.frames.find((f) => f.host === "landed")!;
  expect(shown, "the big text showed").toBeTruthy();
  expect(rel(log, shown.t)).toBeGreaterThanOrEqual(PLAN.startMs - 50);
  expect(rel(log, shown.t)).toBeLessThanOrEqual(PLAN.startMs + 250);
  expect(full, "a frame at full opacity").toBeTruthy();
  expect(rel(log, landed.t), "the host landed in time").toBeLessThanOrEqual(PLAN.endMs + 400);
  test.info().annotations.push({
    type: "timing",
    description: JSON.stringify({ shownMs: Math.round(rel(log, shown.t)), fullMs: Math.round(rel(log, full.t)), landedMs: Math.round(rel(log, landed.t)), dealtMs: Math.round(rel(log, log.marks.dealt)) }),
  });
  await expectLineShown(page, prompt.fine);
  await expect.poll(() => overlayOpacity(page), { timeout: 3000 }).toBe(0);
  const line = await restingLine(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  });
  const last = log.frames.filter((f) => f.opacity > 0).at(-1)!.box!;
  expect(Math.abs(last.left - line.left), "the last frame sits on the line's left").toBeLessThanOrEqual(4);
  expect(Math.abs(last.width - line.width) / line.width, "and at its width").toBeLessThanOrEqual(0.06);
  expect(log.marks.dealt - log.marks.dealing, "today's bound for the deal").toBeLessThan(3200);
});

test("the first open writes the once-ever key, and after it the spot reads 1 of 14 opened", async ({ page }) => {
  await openHome(page);
  const row = cardRow(page, "ieee");
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByRole("dialog", { name: siteContent.cards.ieee.modal.title, exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), CARD_OPENED_KEY)).toBe("1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(restingLine(page)).toHaveText(OPENED_ONE, { timeout: 5000 });
});

test("a visitor who opened a card before gets no big moment, and the spot stays hidden until they open one", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "1"), CARD_OPENED_KEY);
  await dealFromFoot(page);
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  expect(await page.evaluate(() => document.querySelectorAll("[data-prompt-host][data-prompt]").length), "hosts marked by a run").toBe(0);
  const host = restingHost(page);
  expect(await seenOpacity(host)).toBe(0);
  await expect(host).toHaveAttribute("aria-hidden", "true");
});

test("no deal, no big moment: a load into /#work", async ({ page }) => {
  await watchPrompt(page);
  await page.goto("/?coildebug=flight#work");
  await waitForHome(page);
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  await expectLineShown(page, prompt.fine);
});

test("no deal, no big moment: an upward jump into #work", async ({ page }) => {
  await watchPrompt(page);
  await page.goto("/?coildebug=flight");
  await waitForScene(page);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 5000 });
  // The deal director reads direction from scroll events: let it see the bottom before the jump up.
  await nextFrames(page, 3);
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("work")!.getBoundingClientRect().top + window.scrollY, behavior: "instant" }));
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  await expectLineShown(page, prompt.fine);
});

test("no deal, no big moment: the still path", async ({ page }) => {
  await watchPrompt(page);
  await page.addInitScript(noWebgl2Api);
  await page.goto("/?coildebug=1");
  await page.waitForFunction(() => document.querySelector("section[data-scene]")?.getAttribute("data-scene") === "still", null, { timeout: 30_000 });
  await page.locator("[data-intro-cta] a").first().click();
  await expectDealt(page);
  await page.waitForTimeout(1500);
  expectNeverShown(await readLog(page));
  await expectLineShown(page, prompt.fine);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("reduced motion shows the line in its spot, with no big text", async ({ page }) => {
    await watchPrompt(page);
    await page.goto("/?coildebug=flight#work");
    await waitForHome(page);
    await expectDealt(page);
    await page.waitForTimeout(1500);
    expectNeverShown(await readLog(page));
    await expectLineShown(page, prompt.fine);
  });
});

test("a Menu link to Work from page 1 plays the big moment with the deal", async ({ page }) => {
  await watchPrompt(page);
  await openHome(page, { debug: "flight", at: "top" });
  await page.getByRole("button", { name: siteContent.menu.ariaLabelOpen }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Work", exact: true }).click();
  await expectDealt(page);
  await waitForLanded(page);
  const log = await readLog(page);
  expect(log.frames.some((f) => f.opacity >= 0.99), "a frame at full opacity").toBe(true);
  expect(log.frames.some((f) => f.host === "landed")).toBe(true);
});

test("Hold keeps the cutscene's lock until the shrink ends, and never past the 3.8 s cap", async ({ page }) => {
  await dealFromFoot(page, "flight,timing=hold");
  const plan = promptPlan(DEFAULT_KNOBS, { mode: "hold" });
  await expectDealt(page);
  await waitForLanded(page);
  await page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.lockOff !== null, null, { timeout: 10_000 });
  const log = await readLog(page);
  const release = rel(log, log.lockOff!);
  expect(release).toBeGreaterThanOrEqual(Math.min(plan.endMs, CAP_MS) - 150);
  expect(release).toBeLessThanOrEqual(CAP_MS + 450);
  expect(rel(log, log.frames.find((f) => f.host === "landed")!.t)).toBeLessThanOrEqual(plan.endMs + 400);
  test.info().annotations.push({ type: "hold", description: `lock released ${Math.round(release)} ms from the click (plan end ${Math.round(plan.endMs)}, cap ${CAP_MS})` });
});

test("After gives the scroll back as today", async ({ page }) => {
  await dealFromFoot(page, "flight,timing=after");
  await expectDealt(page);
  await page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.lockOff !== null, null, { timeout: 10_000 });
  const log = await readLog(page);
  expect(log.lockOff! - log.marks.unfurled).toBeLessThanOrEqual(600);
});

const SIZES = [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, phone: false },
  { name: "390x844", viewport: { width: 390, height: 844 }, phone: true },
];
for (const size of SIZES) {
  test.describe(`the big text at ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.phone, hasTouch: size.phone });

    for (const version of PROMPT_VERSIONS) {
      test(`${version} at ${size.name} stays clear of the logo, the Menu pill and the edges at its biggest`, async ({ page }) => {
        await dealFromFoot(page, `flight,prompt=${version}${version === "calm" ? `,timing=${size.phone ? "early" : "hold"}` : ""}`);
        await waitForFull(page);
        const { full } = await readLog(page);
        expect(full, "the first frame at 0.99").toBeTruthy();
        const box = edgesOfBox(full!.box);
        expect(full!.mark, "the logo is on the page").toBeTruthy();
        expect(full!.menu, "the Menu pill is on the page").toBeTruthy();
        expect(meets(box, full!.mark!), "the logo").toBe(false);
        expect(meets(box, full!.menu!), "the Menu pill").toBe(false);
        expect(box.left, "the left edge").toBeGreaterThanOrEqual(15);
        expect(box.right, "the right edge").toBeLessThanOrEqual(full!.vw - 15);
        const probe = await page.evaluate(() => {
          const el = document.createElement("div");
          el.style.backgroundColor = "var(--color-background)";
          document.body.append(el);
          const color = getComputedStyle(el).backgroundColor;
          el.remove();
          return color;
        });
        if (version === "plate") {
          const plate = await page.evaluate(() => getComputedStyle(document.querySelector("[data-prompt-plate]")!).backgroundColor);
          expect(plate, "the plate is the background token").toBe(probe);
        }
        if (version === "outline") {
          const style = await page.evaluate(() => {
            const cs = getComputedStyle(document.querySelector("[data-prompt-text]")!);
            return { stroke: cs.webkitTextStrokeColor, order: cs.paintOrder };
          });
          expect(style.stroke, "the outline is the background token").toBe(probe);
          expect(style.order.startsWith("stroke"), "stroke paints first").toBe(true);
        }
        if (version === "calm") {
          expect(full!.quads, "the scene's quads are readable").toBeTruthy();
          expect(coveredShare(full!.box, full!.quads!), "the share of the text over a card").toBeLessThanOrEqual(0.05);
        }
      });
    }
  });
}

test.describe("the calm big text at Early, 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("calm at Early is off the cards as it arrives", async ({ page }) => {
    await dealFromFoot(page, "flight,prompt=calm,timing=early");
    await waitForFull(page);
    const { full } = await readLog(page);
    expect(full, "the first frame at 0.99").toBeTruthy();
    expect(full!.quads, "the scene's quads are readable").toBeTruthy();
    expect(coveredShare(full!.box, full!.quads!), "the share of the text over a card").toBeLessThanOrEqual(0.05);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("on a phone the line reads Tap a card to open it and rests inside the first screen", async ({ page }) => {
    await dealFromFoot(page);
    await expectDealt(page);
    await waitForLanded(page);
    await expectLineShown(page, prompt.coarse);
    const rects = await page.evaluate(() => {
      const visibleLine = Array.from(document.querySelectorAll("#work [data-prompt-host] [data-prompt-line]")).find((el) => el.getClientRects().length > 0);
      const title = Array.from(document.querySelectorAll("#work button[data-card]")).find((el) => el.getClientRects().length > 0);
      return { line: visibleLine!.getBoundingClientRect().bottom, title: title!.getBoundingClientRect().top, height: window.innerHeight };
    });
    expect(rects.line, "inside the first screen").toBeLessThanOrEqual(rects.height);
    expect(rects.line, "above the first title").toBeLessThanOrEqual(rects.title);
  });
});

test("opening a card while the big text plays retires it at once", async ({ page }) => {
  await dealFromFoot(page, "flight,timing=after");
  await page.waitForFunction(
    () => {
      const frames = (window as unknown as PromptWindow).__prompt.frames;
      return document.documentElement.dataset.deal === "dealt" && (frames.at(-1)?.opacity ?? 0) >= 0.99;
    },
    null,
    { timeout: 20_000 },
  );
  // The zero is the card's click, not the Deal link's.
  await page.evaluate(() => {
    (window as unknown as PromptWindow).__prompt.clickAt = null;
  });
  const premise = await readLog(page);
  expect(premise.frames.some((f) => f.opacity >= 0.99), "the text was at full opacity before the card click").toBe(true);
  await cardRow(page, "ieee").click();
  await page.waitForTimeout(700);
  const log = await readLog(page);
  expect(log.clickAt, "the click was seen").not.toBeNull();
  const after = log.frames.filter((f) => f.t > log.clickAt! + 150);
  expect(after.length, "frames after the window").toBeGreaterThan(5);
  expect(after.filter((f) => f.opacity > 0).length, "frames still showing it").toBe(0);
  expect(log.frames.some((f) => f.host === "landed"), "a landing").toBe(false);
  await page.keyboard.press("Escape");
  await expect(restingLine(page)).toHaveText(OPENED_ONE, { timeout: 5000 });
});

test("a reader who scrolls mid-shrink takes the big text away with the page", async ({ page }) => {
  await dealFromFoot(page, "flight,timing=after");
  const plan = promptPlan(DEFAULT_KNOBS, { mode: "after" });
  await page.waitForFunction(
    () => {
      const frames = (window as unknown as PromptWindow).__prompt.frames;
      const last = frames.at(-1);
      const widest = Math.max(0, ...frames.filter((f) => f.opacity > 0).map((f) => f.box?.width ?? 0));
      return !!last?.box && last.opacity > 0 && widest > 0 && last.box.width < widest * 0.9;
    },
    null,
    { timeout: 20_000, polling: "raf" },
  );
  const scrolled = await page.evaluate(() => {
    const frames = (window as unknown as PromptWindow).__prompt.frames;
    const topBefore = frames.at(-1)!.box!.top;
    const at = performance.now();
    window.scrollBy({ top: window.innerHeight, behavior: "instant" });
    return { topBefore, at, height: window.innerHeight };
  });
  await waitForLanded(page);
  const log = await readLog(page);
  // The sampler's frame callback runs ahead of GSAP's ticker, so the first frames after the scroll can still show the old transform: read one 50 ms later.
  const next = log.frames.find((f) => f.t > scrolled.at + 50 && f.opacity > 0);
  expect(next, "a frame after the scroll").toBeTruthy();
  expect(next!.box!.top, "the text went with the page").toBeLessThanOrEqual(scrolled.topBefore - 0.6 * scrolled.height);
  expect(rel(log, log.frames.find((f) => f.host === "landed")!.t)).toBeLessThanOrEqual(plan.endMs + 400);
});

test("reduced motion switched on mid-prompt hides the big text and rests the line at once", async ({ page }) => {
  await dealFromFoot(page);
  await page.waitForFunction(() => ((window as unknown as PromptWindow).__prompt.frames.at(-1)?.opacity ?? 0) >= 0.99, null, { timeout: 15_000, polling: "raf" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(async () => [await overlayOpacity(page), await seenOpacity(restingLine(page))], { timeout: 300, intervals: [16] })
    .toEqual([0, 1]);
  await expect(restingLine(page)).toHaveText(prompt.fine);
});

// Version D, the spotlight: a dimmed, blurred page under the big line, the Coil
// standing still, and the pointer kept off the page until the line lands.
const SPOTLIGHT = "flight,prompt=spotlight";
const SPOTLIGHT_PLAN = promptPlan({ ...DEFAULT_KNOBS }, { version: "spotlight" });

// What a token resolves to, read through a probe element (never a color string).
const tokenColor = (page: Page, property: "color" | "backgroundColor", token: string) =>
  page.evaluate(
    ([prop, name]) => {
      const el = document.createElement("div");
      el.style.setProperty(prop === "color" ? "color" : "background-color", `var(${name})`);
      document.body.append(el);
      const cs = getComputedStyle(el);
      const value = prop === "color" ? cs.color : cs.backgroundColor;
      el.remove();
      return value;
    },
    [property, token] as const,
  );
const scrimOpacity = (page: Page) =>
  page.evaluate(() => {
    const scrim = document.querySelector<HTMLElement>("[data-prompt-scrim]");
    if (!scrim) return 0;
    const style = getComputedStyle(scrim);
    return style.visibility === "hidden" ? 0 : Number(style.opacity);
  });

for (const size of SIZES) {
  test.describe(`D, the spotlight, at ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.phone, hasTouch: size.phone });

    test(`D: the page dims and blurs under the spotlight, the Coil stands still, and the line lands at ${size.name}`, async ({ page }) => {
      await dealFromFoot(page, SPOTLIGHT);
      await waitForFull(page);
      const { full } = await readLog(page);
      expect(full, "the first frame at 0.99").toBeTruthy();
      const scrim = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>("[data-prompt-scrim]")!;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const text = document.querySelector("[data-prompt-stage][data-version='spotlight'] [data-prompt-text]");
        return {
          rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          filter: cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"),
          background: cs.backgroundColor,
          opacity: Number(cs.opacity),
          inkOnStage: text ? getComputedStyle(text).color : null,
        };
      });
      expect(scrim.rect, "the scrim covers the viewport").toEqual({ left: 0, top: 0, right: full!.vw, bottom: full!.vh });
      expect(scrim.opacity, "the scrim is up").toBeGreaterThan(0.9);
      expect(scrim.filter, "the scrim blurs").toMatch(/blur\(/);
      expect(scrim.background, "the scrim is the spotlight token").toBe(await tokenColor(page, "backgroundColor", "--spotlight-scrim"));
      expect(scrim.inkOnStage, "the text is the spotlight ink").toBe(await tokenColor(page, "color", "--spotlight-ink"));

      // The scene is frozen under the scrim: the first quad's first point holds still across 300 ms.
      expect(full!.quads, "the scene's quads are readable").toBeTruthy();
      const first = full!.quads![0][0];
      const later = await page.evaluate(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const coil = (window as unknown as { __coil?: { visibleQuads?: () => { x: number; y: number }[][] } }).__coil;
        return coil?.visibleQuads?.()[0]?.[0] ?? null;
      });
      expect(later, "the quads are still readable").toBeTruthy();
      expect(Math.abs(later!.x - first.x), "the first quad's x").toBeLessThanOrEqual(0.5);
      expect(Math.abs(later!.y - first.y), "the first quad's y").toBeLessThanOrEqual(0.5);

      await expectDealt(page);
      await waitForLanded(page);
      const log = await readLog(page);
      expect(rel(log, log.frames.find((f) => f.host === "landed")!.t), "the line lands in time").toBeLessThanOrEqual(SPOTLIGHT_PLAN.endMs + 400);
      await expect.poll(() => scrimOpacity(page), { timeout: 3000 }).toBe(0);
      await expectLineShown(page, size.phone ? prompt.coarse : prompt.fine);

      const title = page.locator("#work button[data-card]:visible").first();
      await title.scrollIntoViewIfNeeded();
      const hit = await title.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const found = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return found === el || (found !== null && el.contains(found));
      });
      expect(hit, "a card title is what is under its own center").toBe(true);
    });
  });
}

// The moment of the first input, and the lock's release, both on the page's own clock.
const armPressClock = (page: Page, event: "pointerdown" | "wheel" | "keydown") =>
  page.evaluate((type) => {
    const w = window as unknown as { __pressAt: number | null };
    w.__pressAt = null;
    window.addEventListener(type, () => (w.__pressAt ??= performance.now()), true);
  }, event);
const pressAt = (page: Page) => page.evaluate(() => (window as unknown as { __pressAt: number | null }).__pressAt);

async function expectFastForwarded(page: Page) {
  await waitForLanded(page);
  await page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.lockOff !== null, null, { timeout: 5_000 });
  const log = await readLog(page);
  const at = await pressAt(page);
  expect(at, "the input was seen").not.toBeNull();
  const landed = log.frames.find((f) => f.host === "landed")!;
  expect(landed.t - at!, "the line lands within 450 ms of the input").toBeLessThanOrEqual(450);
  expect(log.lockOff! - at!, "the scroll lock lets go within 600 ms of the input").toBeLessThanOrEqual(600);
}

test("D: a click during the spotlight fast-forwards it, gives the scroll back and opens nothing", async ({ page }) => {
  await dealFromFoot(page, SPOTLIGHT);
  await waitForFull(page);
  await armPressClock(page, "pointerdown");
  // The center of a visible card title: the scrim covers it while up, so nothing may open.
  const title = await page.evaluate(() => {
    const view = { w: window.innerWidth, h: window.innerHeight };
    for (const el of document.querySelectorAll<HTMLElement>("#work button[data-card]")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= view.w && r.top >= 0 && r.bottom <= view.h) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return null;
  });
  expect(title, "a card title is in view").not.toBeNull();
  await page.mouse.click(title!.x, title!.y);
  await expectFastForwarded(page);
  await page.waitForTimeout(400);
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

test("D: Escape fast-forwards it", async ({ page }) => {
  await dealFromFoot(page, SPOTLIGHT);
  await waitForFull(page);
  await armPressClock(page, "keydown");
  await page.keyboard.press("Escape");
  await expectFastForwarded(page);
});

test("D: a wheel during the spotlight fast-forwards it and gives the scroll back", async ({ page }) => {
  await dealFromFoot(page, SPOTLIGHT);
  await waitForFull(page);
  const view = page.viewportSize()!;
  await page.mouse.move(view.width / 2, view.height / 2);
  // Stamped, not listened for: the lock swallows wheels with stopImmediatePropagation, so a listener would only see one that got through.
  await page.evaluate(() => ((window as unknown as { __pressAt: number | null }).__pressAt = performance.now()));
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(30);
  }
  await expectFastForwarded(page);
});

test("D: Hold's lock under the spotlight lets go by the cap", async ({ page }) => {
  await dealFromFoot(page, `${SPOTLIGHT},timing=hold`);
  await expectDealt(page);
  await waitForLanded(page);
  await page.waitForFunction(() => (window as unknown as PromptWindow).__prompt.lockOff !== null, null, { timeout: 10_000 });
  const log = await readLog(page);
  const release = rel(log, log.lockOff!);
  expect(release).toBeGreaterThanOrEqual(Math.min(SPOTLIGHT_PLAN.endMs, CAP_MS) - 150);
  expect(release).toBeLessThanOrEqual(CAP_MS + 450);
  expect(rel(log, log.frames.find((f) => f.host === "landed")!.t)).toBeLessThanOrEqual(SPOTLIGHT_PLAN.endMs + 400);
});

test("D: reduced motion switched on mid-spotlight drops the scrim at once", async ({ page }) => {
  await dealFromFoot(page, SPOTLIGHT);
  await page.waitForFunction(() => ((window as unknown as PromptWindow).__prompt.frames.at(-1)?.opacity ?? 0) >= 0.99, null, { timeout: 15_000, polling: "raf" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(async () => [await overlayOpacity(page), await scrimOpacity(page), await seenOpacity(restingLine(page))], { timeout: 300, intervals: [16] })
    .toEqual([0, 0, 1]);
  await expect(restingLine(page)).toHaveText(prompt.fine);
});

test("D: dealt does not move", async ({ page }) => {
  await dealFromFoot(page, SPOTLIGHT);
  await expectDealt(page);
  const log = await readLog(page);
  expect(log.marks.dealt - log.marks.dealing, "today's bound for the deal").toBeLessThan(3200);
});

// Versions E and F (docs/superpowers/plans/2026-11-14-click-a-card-e-and-f.md): a start size taken from
// the page title, and for F a dim around a lit Coil that never takes the pointer.
const startToTitle = (page: Page) =>
  page.evaluate(() => {
    const text = document.querySelector("[data-prompt-text]")!;
    const title = [...document.querySelectorAll("#work [data-page-title]")].find((element) => element.getClientRects().length > 0)!;
    return parseFloat(getComputedStyle(text).fontSize) / parseFloat(getComputedStyle(title).fontSize);
  });
const dimState = (page: Page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("[data-prompt-dim]")!);
    return { opacity: cs.visibility === "hidden" ? 0 : Number(cs.opacity), pointer: cs.pointerEvents, image: cs.backgroundImage, filter: cs.backdropFilter || "none" };
  });

for (const size of SIZES) {
  test.describe(`E and F at ${size.name}`, () => {
    test.use({ viewport: size.viewport, isMobile: size.phone, hasTouch: size.phone });

    for (const version of ["quiet", "lit"] as const) {
      test(`${version} starts at no more than 1.5 page titles at ${size.name}`, async ({ page }) => {
        await dealFromFoot(page, `flight,prompt=${version}`);
        await waitForFull(page);
        expect(await startToTitle(page)).toBeLessThanOrEqual(1.5 + 0.01);
      });
    }

    test(`F: the dim frames the lit Coil without blurring or taking the pointer, and lifts as the line lands at ${size.name}`, async ({ page }) => {
      await dealFromFoot(page, "flight,prompt=lit");
      await waitForFull(page);
      const up = await dimState(page);
      expect(up.opacity, "the dim is up").toBeGreaterThan(0.9);
      expect(up.pointer, "the dim never takes the pointer").toBe("none");
      expect(up.image, "an oval of light over the Coil").toMatch(/radial-gradient/);
      expect(up.filter, "no blur").toBe("none");
      await waitForLanded(page);
      await expect.poll(async () => (await dimState(page)).opacity, { timeout: 1000 }).toBe(0);
      await expect(restingLine(page)).toHaveText(size.phone ? prompt.coarse : prompt.fine);
    });

    test(`F: a card pressed while the dim is up opens at ${size.name}`, async ({ page }) => {
      await dealFromFoot(page, "flight,prompt=lit");
      await waitForFull(page);
      const at = await page.evaluate(() => {
        const quads = (window as unknown as { __coil?: { visibleQuads?: () => { x: number; y: number }[][] } }).__coil?.visibleQuads?.() ?? [];
        let best: { x: number; y: number; d: number } | null = null;
        for (const quad of quads) {
          const c = quad.reduce((sum, p) => ({ x: sum.x + p.x / quad.length, y: sum.y + p.y / quad.length }), { x: 0, y: 0 });
          const d = Math.hypot(c.x - innerWidth / 2, c.y - innerHeight / 2);
          if (!best || d < best.d) best = { ...c, d };
        }
        return best;
      });
      expect(at, "a card near the middle").toBeTruthy();
      expect((await dimState(page)).opacity, "pressed while the dim is up").toBeGreaterThan(0);
      if (size.phone) await page.touchscreen.tap(at!.x, at!.y);
      else {
        // A fine pointer opens the card it hovers: let a frame pick it first.
        await page.mouse.move(at!.x, at!.y, { steps: 4 });
        await page.waitForTimeout(250);
        await page.mouse.click(at!.x, at!.y);
      }
      await expect(page.locator("[role=dialog]")).toBeVisible({ timeout: 3000 });
    });
  });
}

// Version G, the lit title (docs/superpowers/plans/2026-11-16-click-a-card-g-lit-title.md): over F's dim, E's plate as
// a pill in the chrome's row, placed by measuring the cards so it never meets one while it can be read; on a phone
// (too shallow a top row for a title) the line grows where it rests, under the page title.
// From 768 px wide the lab's "G: where" picks its place: where the line rests in the Work column ("column", Aaron's
// pick of 2026-11-17 and the default), the top row on its plate ("row") or the top row as words only ("bare"). A phone
// always plays it in place, so it runs the default only.
const G_SIZES = [...SIZES, { name: "768x1024", viewport: { width: 768, height: 1024 }, phone: false }, { name: "1280x720", viewport: { width: 1280, height: 720 }, phone: false }];
const G_PLACES = ["row", "bare", "column"] as const;
for (const size of G_SIZES) {
  for (const place of G_PLACES.filter((choice) => choice === "column" || !size.phone)) {
    test.describe(`G, the lit title, ${place}, at ${size.name}`, () => {
      test.use({ viewport: size.viewport, isMobile: size.phone, hasTouch: size.phone });

      test(`G (${place}): the big line meets no card while it can be read, sits where its screen puts it, and lands at ${size.name}`, async ({ page }) => {
        await dealFromFoot(page, `flight,prompt=title,place=${place}`);
        await waitForFull(page);
        // Every frame from full strength until the shrink begins: the line's box (its pill, where it has one) against the cards as drawn.
        const hold = await page.evaluate(
          () =>
            new Promise<{
              frames: number;
              touching: number;
              minAir: number;
              plated: boolean;
              box: { left: number; top: number; bottom: number };
              menuTop: number;
              lineLeft: number;
              listBottom: number;
              titleBottom: number;
              columnsTop: number;
              stageBottom: number;
              ratio: number;
              dim: number;
              dimPointer: string;
              dimZ: number;
              pageShown: number;
            }>((resolve) => {
              type Point = { x: number; y: number };
              const axes = (shape: Point[]) => shape.map((a, i) => ({ x: -(shape[(i + 1) % shape.length].y - a.y), y: shape[(i + 1) % shape.length].x - a.x }));
              const meet = (a: Point[], b: Point[]) =>
                [...axes(a), ...axes(b)].every((axis) => {
                  const pa = a.map((p) => p.x * axis.x + p.y * axis.y);
                  const pb = b.map((p) => p.x * axis.x + p.y * axis.y);
                  return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
                });
              const grown = (box: DOMRect, by: number): Point[] => [
                { x: box.left - by, y: box.top - by },
                { x: box.right + by, y: box.top - by },
                { x: box.right + by, y: box.bottom + by },
                { x: box.left - by, y: box.bottom + by },
              ];
              const shown = <T extends Element>(selector: string) => [...document.querySelectorAll<T>(selector)].find((element) => element.getClientRects().length > 0)!;
              const coil = (window as unknown as { __coil: { visibleQuads: () => Point[][] } }).__coil;
              const stage = document.querySelector<HTMLElement>("[data-prompt-stage]")!;
              const plate = document.querySelector<HTMLElement>("[data-prompt-plate]")!;
              const text = document.querySelector<HTMLElement>("[data-prompt-text]")!;
              const plated = getComputedStyle(plate).display !== "none";
              const boxOf = () => (plated ? plate : text).getBoundingClientRect();
              const title = shown<HTMLElement>("#work [data-page-title]");
              const dim = getComputedStyle(document.querySelector("[data-prompt-dim]")!);
              const first = boxOf();
              // What the visitor sees of an element: the product of the opacities from it up.
              const seen = (element: Element | null) => {
                let opacity = 1;
                for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
                return opacity;
              };
              const page2 = [title, ...document.querySelectorAll("#work [data-deal-label], #work [data-deal-title]")].filter((element) => element.getClientRects().length > 0);
              const out = {
                frames: 0,
                touching: 0,
                minAir: 60,
                plated,
                box: { left: first.left, top: first.top, bottom: first.bottom },
                menuTop: document.querySelector("[data-menu-pill]")!.getBoundingClientRect().top,
                lineLeft: shown<HTMLElement>("#work [data-prompt-host] [data-prompt-line]").getBoundingClientRect().left,
                listBottom: shown<HTMLElement>("#work [data-prompt-host]").previousElementSibling?.getBoundingClientRect().bottom ?? 0,
                titleBottom: title.getBoundingClientRect().bottom,
                columnsTop: shown<HTMLElement>("#work h3[data-deal-label]").getBoundingClientRect().top,
                stageBottom: document.querySelector("[data-coil-stage]")!.getBoundingClientRect().bottom,
                ratio: parseFloat(getComputedStyle(text).fontSize) / parseFloat(getComputedStyle(title).fontSize),
                dim: dim.visibility === "hidden" ? 0 : Number(dim.opacity),
                dimPointer: dim.pointerEvents,
                dimZ: Number(dim.zIndex),
                pageShown: 0,
              };
              const tick = () => {
                if (new DOMMatrix(getComputedStyle(stage).transform).a < 0.9995) return resolve(out);
                out.pageShown = Math.max(out.pageShown, ...page2.map(seen));
                const box = boxOf();
                const quads = coil.visibleQuads();
                out.frames += 1;
                if (quads.some((quad) => meet(grown(box, 0), quad))) out.touching += 1;
                let air = 0;
                while (air < 60 && !quads.some((quad) => meet(grown(box, air + 1), quad))) air += 1;
                out.minAir = Math.min(out.minAir, air);
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            }),
        );
        // Line first holds its full size for 600 ms (36 frames at 60 a second); the other places' Hold is the same plan.
        expect(hold.frames, "frames of the readable hold").toBeGreaterThan(14);
        expect(hold.touching, "frames in which the big line meets a card").toBe(0);
        if (size.phone) {
          expect(hold.plated, "a phone's big line has no plate").toBe(false);
          expect(Math.abs(hold.box.left - hold.lineLeft), "it grows from the resting line's left edge").toBeLessThanOrEqual(1);
          expect(hold.box.top, "under the Coil's canvas, where no card is ever drawn").toBeGreaterThanOrEqual(hold.stageBottom);
          expect(hold.box.top, "clear of the page title above").toBeGreaterThanOrEqual(hold.titleBottom + 2);
          expect(hold.box.bottom, "clear of the columns below").toBeLessThanOrEqual(hold.columnsTop - 2);
          expect(hold.ratio, "the start size in page titles").toBeLessThanOrEqual(1.15 + 0.01);
          expect(hold.ratio, "bigger than the line it grows from").toBeGreaterThan(0.9);
        } else if (place === "column") {
          expect(hold.plated, "in the column the big line has no plate").toBe(false);
          expect(Math.abs(hold.box.left - hold.lineLeft), "it grows from the resting line's left edge").toBeLessThanOrEqual(1);
          expect(hold.box.top, "clear of the Work list above").toBeGreaterThanOrEqual(hold.listBottom + 2);
          expect(hold.minAir, "the least air between the line and a card, px").toBeGreaterThanOrEqual(3);
          expect(hold.ratio, "the start size in page titles").toBeLessThanOrEqual(1.5 + 0.01);
        } else {
          expect(hold.plated, place === "row" ? "the pill" : "words only: no plate").toBe(place === "row");
          // Words only keeps the pill's measured place: the text sits the plate's inset below the Menu pill's top.
          if (place === "row") expect(Math.abs(hold.box.top - hold.menuTop), "the pill hangs from the Menu pill's row").toBeLessThanOrEqual(0.5);
          else expect(hold.box.top, "in the Menu pill's row").toBeGreaterThanOrEqual(hold.menuTop);
          expect(hold.minAir, "the least air between the pill and a card, px").toBeGreaterThanOrEqual(3);
          expect(hold.ratio, "the start size in page titles").toBeLessThanOrEqual(1.5 + 0.01);
        }
        // A phone's dim only ever covered the page under the band, and that page waits for the line: no dim there.
        if (size.phone) expect(hold.dim, "no dim on a phone while the page waits").toBe(0);
        else expect(hold.dim, "F's dim is up behind it").toBeGreaterThan(0.9);
        expect(hold.dimPointer, "the dim never takes the pointer").toBe("none");
        expect(hold.dimZ, "the dim sits under the logo and the Menu pill").toBeLessThan(40);
        // The line first: while it is read, the page's title, its labels and its lists have not come in.
        expect(hold.pageShown, "the most any of the page title, the labels and the lists showed while the line was read").toBe(0);
        test.info().annotations.push({ type: "G", description: `${place} at ${size.name}: ${hold.frames} frames, least air ${hold.minAir} px, ${hold.ratio.toFixed(2)} page titles` });
        await waitForLanded(page);
        await expect.poll(async () => (await dimState(page)).opacity, { timeout: 1000 }).toBe(0);
        await expect(restingLine(page)).toHaveText(size.phone ? prompt.coarse : prompt.fine);
        // Then the page: every list in, and the deal over.
        await expectDealt(page);
        expect(await seenOpacity(page.locator("#work [data-deal-title]:visible").last()), "the last title, once dealt").toBe(1);
      });
    });
  }
}

// G's order (Aaron's recordings, 2026-11-18): the line is read beside the lit Coil first, and the page's title and
// lists come in half way through its shrink. A line landed early takes them with it; After keeps the deal's own order.
const G_PLAN = promptPlan({ ...DEFAULT_KNOBS }, { version: "title" });
const lastTitle = (page: Page) => page.locator("#work [data-deal-title]:visible").last();

test("G: the columns start half way through the line's shrink, never before", async ({ page }) => {
  await dealFromFoot(page, "flight,prompt=title");
  expect(G_PLAN.columnsAtMs, "the plan has the columns wait").toBe(Math.round((G_PLAN.shrinkStartMs + G_PLAN.shrinkEndMs) / 2));
  const firstSeenAt = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const label = [...document.querySelectorAll<HTMLElement>("#work [data-deal-label]")].find((element) => element.getClientRects().length > 0)!;
        const tick = () => (Number(getComputedStyle(label).opacity) > 0.02 ? resolve(performance.now()) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
  );
  const log = await readLog(page);
  // The click comes a frame or two before "dealing" is written, so the bound is a little loose below and above.
  expect(rel(log, firstSeenAt), "the first label shows, ms from the deal's start").toBeGreaterThan(G_PLAN.shrinkStartMs - 40);
  expect(rel(log, firstSeenAt), "and soon after the shrink's middle").toBeLessThan(G_PLAN.columnsAtMs! + 250);
  await expectDealt(page);
});

test("G: a key under the dim lands the line and brings the columns in with it", async ({ page }) => {
  await dealFromFoot(page, "flight,prompt=title");
  await waitForFull(page);
  await page.keyboard.press("Escape");
  const firstSeenAt = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const label = [...document.querySelectorAll<HTMLElement>("#work [data-deal-label]")].find((element) => element.getClientRects().length > 0)!;
        const tick = () => (Number(getComputedStyle(label).opacity) > 0.02 ? resolve(performance.now()) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
  );
  const log = await readLog(page);
  expect(rel(log, firstSeenAt), "the first label shows before the line would even have begun to shrink on its own").toBeLessThan(G_PLAN.shrinkStartMs);
  await waitForLanded(page);
  await expect.poll(() => seenOpacity(lastTitle(page)), { timeout: 2000 }).toBe(1);
  await expectDealt(page);
});

test("G on After keeps the deal's own order: the lists are in before the line", async ({ page }) => {
  await dealFromFoot(page, "flight,prompt=title,timing=after");
  await waitForFull(page);
  expect(await seenOpacity(page.locator("#work [data-deal-title]:visible").first()), "the first title, as the line reaches full strength").toBeGreaterThan(0.5);
  await waitForLanded(page);
  await expectDealt(page);
});
