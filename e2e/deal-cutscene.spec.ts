import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, waitForScene } from "./support/coil";
import { noWebgl2Api } from "./support/webgl";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { coverage, dealFacts, flick, flingStream, startRecording, stopRecording, wheelStream, type Frame } from "./support/cutscene";

// The deal is a short cutscene (Aaron's hand test, 2026-10-29). Whichever way it
// starts, a scroll past the trigger or "Deal me in", the page takes the reader's
// scroll input (wheel, touch, the scroll keys) from the moment it starts until
// the Coil is unfurled, and its own eased scroll brings the page to page 2's top;
// nothing the reader does can kill that scroll or add to it. At the unfurl the
// lock lets go once the reader's input has been quiet (the tail of the fling that
// started the deal is swallowed), and in any case a few seconds after it took
// input. <html data-deal-lock> is on for exactly that long.
//
// Everything here is real input through the DevTools protocol, the path a
// device's events take: a trackpad's fling is a burst of wheels and a decaying
// tail (a page's own scrollTo is not the reader's, and plays the deal as it
// always did: e2e/deal-paths.spec.ts), a phone's is touch events and the
// browser's own momentum.

const { teaser } = siteContent.intro;
const { cutscene } = COIL.deal;
// The most the page may pass page 2's top: only a fling that has already carried it past
// (it eases back), and then no more than this (lib/home/handScroll.ts).
const OVERSHOOT_BOUND_PX = cutscene.overshootPx;
// How long the lock may hold the reader: the cap, and the timers' own slack.
const CAP_MS = cutscene.capMs;
const SLACK_MS = 450;

const dealLink = (page: Page) => page.getByRole("link", { name: teaser.deal });
const dealState = (page: Page) => page.evaluate(() => document.documentElement.dataset.deal);
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const locked = (page: Page) => page.evaluate(() => document.documentElement.hasAttribute("data-deal-lock"));

type Size = { name: string; viewport: { width: number; height: number }; phone?: boolean };
const SIZES: Size[] = [
  { name: "1280x800", viewport: { width: 1280, height: 800 } },
  { name: "390x844", viewport: { width: 390, height: 844 }, phone: true },
];
const middle = (size: Size) => ({ x: size.viewport.width / 2, y: size.viewport.height / 2 });

// Block 4 near the top of the screen: a fling from here has the whole foot and the stage's range ahead of it.
async function fromBlock4(page: Page, from = 120) {
  await page.evaluate((top) => window.scrollTo({ top: document.getElementById("story-from")!.getBoundingClientRect().top + window.scrollY - top, behavior: "instant" }), from);
  await page.waitForTimeout(300);
}

// The reader scrolls down by hand, one notch at a time, until the deal starts.
async function startDealByWheel(page: Page, cdp: CDPSession, at: { x: number; y: number }) {
  for (let i = 0; i < 120; i++) {
    if ((await dealState(page)) === "dealing") return;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY: 40 });
    await page.waitForTimeout(40);
  }
  throw new Error("the deal never started by wheel");
}

// The deal's clock has reached `ms` (the scene's own: zero at the end of the condense).
async function untilClock(page: Page, ms: number) {
  await page.waitForFunction((want) => ((window as unknown as { __coil: { entrance: () => { elapsedMs: number | null } } }).__coil.entrance().elapsedMs ?? -1e9) >= want, ms, { timeout: 10_000 });
}

const unfurledOrDealt = (page: Page) => page.waitForFunction(() => ["unfurled", "dealt"].includes(document.documentElement.dataset.deal ?? ""), null, { timeout: 15_000 });

// Frames where the page went back up under the reader: the cards section's top
// moved down the screen. (Not scrollY: when the ribbon's slot closes, the page
// is held by a scrollBy that lowers scrollY and leaves the section where it was.)
function goingUp(frames: Frame[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < frames.length; i++) if (frames[i].workTop > frames[i - 1].workTop + 0.5) out.push(`${Math.round(frames[i].t)}ms, page 2's top ${frames[i - 1].workTop.toFixed(1)} to ${frames[i].workTop.toFixed(1)}`);
  return out;
}

// How far past page 2's top the page ever went.
const pastLanding = (frames: Frame[]) => Math.max(0, -Math.min(...frames.map((f) => f.workTop)));

// The first frame on which the lock is held, and the first after it on which it is gone.
function lockSpan(frames: Frame[]) {
  const first = frames.findIndex((f) => f.lock !== null);
  const last = first < 0 ? -1 : frames.findIndex((f, i) => i > first && f.lock === null);
  return { first, last, heldMs: first >= 0 && last >= 0 ? frames[last].t - frames[first].t : Number.NaN };
}

// The page ends on page 2's top and stays there from the first frame it is there.
function landsAndStays(frames: Frame[]): string[] {
  const out: string[] = [];
  const at = frames.findIndex((f) => Math.abs(f.workTop) < 1);
  if (at < 0) return ["the page never reached page 2's top"];
  for (const f of frames.slice(at)) if (Math.abs(f.workTop) > 1.5) out.push(`${Math.round(f.t)}ms: page 2's top at ${f.workTop.toFixed(1)}`);
  return out;
}

for (const size of SIZES) {
  test.describe(`the cutscene at ${size.name}`, () => {
    test.use({ viewport: size.viewport, deviceScaleFactor: size.phone ? 2 : 1, hasTouch: !!size.phone, isMobile: !!size.phone });

    test("a hard fling down from block 4 plays the deal and lands on page 2, and stays there", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "top" });
      const facts = await dealFacts(page);
      await fromBlock4(page);
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startRecording(page);
      // About 40 wheels of 80 to 150 px over 400 ms (a trackpad's burst), then a decaying tail for 1.5 s.
      await wheelStream(cdp, flingStream(), at);
      await unfurledOrDealt(page);
      await page.waitForTimeout(1500);
      const frames = await stopRecording(page);
      const dealing = frames.filter((f) => f.deal === "dealing");
      expect(dealing.length, "frames of the deal").toBeGreaterThan(60);
      // The fling is carried: it started the deal, and the page did not go past it down the page.
      expect(pastLanding(frames), `how far past page 2's top the page went (the bound is ${OVERSHOOT_BOUND_PX} px)`).toBeLessThanOrEqual(OVERSHOOT_BOUND_PX);
      const stays = landsAndStays(frames);
      expect(stays, stays.slice(0, 3).join("; ")).toEqual([]);
      expect(frames[frames.length - 1].deal).toMatch(/unfurled|dealt/);
      expect(await scrollY(page), "nowhere near the end of the page").toBeLessThan(facts.max - 200);
      // A fine pointer's lock is its listeners alone: the root's overflow (and so a classic scrollbar) is never toggled.
      if (!size.phone) expect(new Set(frames.map((f) => f.overflow)), "the root's overflow through the cutscene").toEqual(new Set(["visible"]));
      const held = lockSpan(frames);
      test.info().annotations.push({ type: "fling", description: `deal started at scrollY ${dealing[0].y.toFixed(0)}; past page 2's top at most ${pastLanding(frames).toFixed(1)} px; the lock held ${held.heldMs.toFixed(0)} ms` });
    });

    test("the tail of the fling is swallowed past the unfurl: the lock lets go only once the input has been quiet", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "top" });
      await fromBlock4(page);
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      // When the last wheel reached the window (the page's own clock), from before the lock's listener.
      await page.evaluate(() => {
        const w = window as unknown as { __lastWheel: number };
        w.__lastWheel = 0;
        window.addEventListener("wheel", () => (w.__lastWheel = performance.now()), { capture: true, passive: true });
      });
      await startRecording(page);
      // The burst, then a creeping tail (2 px an event) well past the unfurl, which comes about 2.3 s after the deal starts.
      const burst = flingStream({ events: 30, ms: 300, tailMs: 0 });
      const creep: [number, number][] = [];
      for (let t = 300; t < 2900; t += 16) creep.push([t, 2]);
      await wheelStream(cdp, [...burst, ...creep], at);
      await page.waitForTimeout(1200);
      const frames = await stopRecording(page);
      const lastWheel = await page.evaluate(() => (window as unknown as { __lastWheel: number }).__lastWheel);
      const span = lockSpan(frames);
      expect(span.first, "the lock was held").toBeGreaterThanOrEqual(0);
      expect(span.last, "and let go").toBeGreaterThan(span.first);
      const unfurled = frames.find((f) => f.deal !== "dealing" && f.deal !== "closed")!;
      expect(lastWheel, "wheels were still arriving after the unfurl").toBeGreaterThan(unfurled.t + 100);
      // Let go once the input had been quiet, not at the unfurl.
      expect(frames[span.last].t - lastWheel, "the lock let go this long after the last wheel").toBeGreaterThanOrEqual(cutscene.quietMs - 40);
      expect(frames[span.last].t - lastWheel, "and not much longer").toBeLessThan(cutscene.quietMs + 200);
      // The page never moved in all that: the tail never reached it.
      const stays = landsAndStays(frames);
      expect(stays, stays.slice(0, 3).join("; ")).toEqual([]);
      expect(pastLanding(frames)).toBeLessThanOrEqual(OVERSHOOT_BOUND_PX);
    });

    test("start the deal by scroll, then wheel up hard: the page never goes up and nothing slides over block 4", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startDealByWheel(page, cdp, at);
      // The wheel has formed (the ribbon's rush and its curl are over); the reader changes their mind.
      await untilClock(page, 700);
      await startRecording(page);
      await wheelStream(cdp, flingStream({ events: 14, ms: 350, tailMs: 600, sign: -1 }), at);
      await page.waitForTimeout(3000);
      const frames = await stopRecording(page);
      const hits = coverage(frames, size.viewport, true);
      expect(hits, hits.slice(0, 4).join("\n")).toEqual([]);
      // While the deal is dealing, before the Coil is unfurled, the reader's wheel moves nothing.
      const during = frames.filter((f) => f.deal === "dealing");
      expect(during.length, "frames of the deal after the reader's wheel").toBeGreaterThan(10);
      const ups = goingUp(during);
      expect(ups, `the page went back up under the reader: ${ups.slice(0, 4).join("; ")}`).toEqual([]);
      expect(Math.abs(frames[frames.length - 1].workTop), "the deal still landed on page 2's top").toBeLessThan(2);
    });

    test("the scroll keys do nothing during the lock, and scroll the page after it", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "top" });
      await fromBlock4(page);
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startDealByWheel(page, cdp, at);
      await startRecording(page);
      // The leg is over in a moment at this speed; keys during the rest of the lock.
      await page.waitForTimeout(400);
      for (const key of ["Space", "PageDown", "ArrowDown", "End", "PageUp", "Home", "ArrowUp", "Shift+Space"]) {
        await page.keyboard.press(key);
        await page.waitForTimeout(60);
      }
      await unfurledOrDealt(page);
      const frames = await stopRecording(page);
      const heldFrames = frames.filter((f) => f.lock !== null);
      expect(heldFrames.length).toBeGreaterThan(30);
      const stays = landsAndStays(heldFrames);
      expect(stays, `the keys moved the page during the lock: ${stays.slice(0, 3).join("; ")}`).toEqual([]);
      expect(pastLanding(frames)).toBeLessThanOrEqual(OVERSHOOT_BOUND_PX);
      // After it, the keys scroll the page.
      await page.waitForFunction(() => document.documentElement.dataset.deal === "dealt" && !document.documentElement.hasAttribute("data-deal-lock"), null, { timeout: 15_000 });
      await page.waitForTimeout(400);
      const before = await scrollY(page);
      await page.keyboard.press("PageDown");
      await expect.poll(() => scrollY(page), { message: "PageDown scrolls once the lock has let go" }).toBeGreaterThan(before + 100);
    });

    test("the click path: the wheel during Deal me in's scroll no longer takes it back, and Tab and Escape are untouched", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startRecording(page);
      await dealLink(page).click();
      await expect.poll(() => dealState(page)).toBe("dealing");
      await page.waitForTimeout(700);
      await wheelStream(cdp, flingStream({ events: 10, ms: 250, tailMs: 400, sign: -1 }), at);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
      await unfurledOrDealt(page);
      const frames = await stopRecording(page);
      const during = frames.filter((f) => f.deal === "dealing");
      expect(goingUp(during), "the wheel up took the page back").toEqual([]);
      const stays = landsAndStays(frames);
      expect(stays, stays.slice(0, 3).join("; ")).toEqual([]);
      expect(pastLanding(frames)).toBeLessThanOrEqual(OVERSHOOT_BOUND_PX);
      // Tab moved focus: nothing was swallowed but the scroll.
      expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    });

    test("the cap: a scene that never unfurls gives the scroll back within the cap", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startRecording(page);
      await dealLink(page).click();
      await expect.poll(() => dealState(page)).toBe("dealing");
      // Freeze the scene: its clock never runs out, so the Coil is never unfurled.
      await page.evaluate(() => (window as unknown as { __coil: { api: { freeze: (on: boolean) => void } } }).__coil.api.freeze(true));
      // The reader keeps trying to scroll for as long as the lock holds.
      const stream: [number, number][] = [];
      for (let t = 0; t < CAP_MS + 800; t += 50) stream.push([t, 20]);
      await wheelStream(cdp, stream, at);
      await page.waitForTimeout(300);
      const frames = await stopRecording(page);
      const span = lockSpan(frames);
      expect(span.first, "the lock was held").toBeGreaterThanOrEqual(0);
      expect(span.last, "and let go with the scene stalled").toBeGreaterThan(span.first);
      expect(span.heldMs, `the lock held ${span.heldMs.toFixed(0)} ms`).toBeLessThanOrEqual(CAP_MS + SLACK_MS);
      expect(span.heldMs).toBeGreaterThanOrEqual(CAP_MS - 200);
      expect(frames.slice(span.first, span.last).every((f) => f.deal === "dealing"), "the scene never unfurled while the lock held").toBe(true);
      // And the reader has the page back: a wheel moves it.
      const y = await scrollY(page);
      await page.mouse.move(at.x, at.y);
      await page.mouse.wheel(0, -300);
      await expect.poll(() => scrollY(page), { message: "a wheel moves the page after the cap" }).toBeLessThan(y - 100);
    });

    test("the cap: a hidden tab lets go at once", async ({ page }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      await dealLink(page).click();
      await expect.poll(() => dealState(page)).toBe("dealing");
      expect(await locked(page)).toBe(true);
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect.poll(() => locked(page)).toBe(false);
      await page.evaluate(() => {
        delete (document as unknown as { visibilityState?: string }).visibilityState;
      });
    });

    test("the cap: reduced motion switched on mid-deal lets go at once", async ({ page }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      await dealLink(page).click();
      await expect.poll(() => dealState(page)).toBe("dealing");
      expect(await locked(page)).toBe(true);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 2000 });
      expect(await locked(page)).toBe(false);
    });

    test("the cap: the scene dying mid-deal (its context lost) gives the scroll back within the cap", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startRecording(page);
      await dealLink(page).click();
      await expect.poll(() => dealState(page)).toBe("dealing");
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("#work canvas")!;
        canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
      });
      await page.waitForTimeout(CAP_MS + 800);
      const frames = await stopRecording(page);
      const span = lockSpan(frames);
      expect(span.last, "the lock let go").toBeGreaterThan(span.first);
      expect(span.heldMs, `the lock held ${span.heldMs.toFixed(0)} ms`).toBeLessThanOrEqual(CAP_MS + SLACK_MS);
    });
  });
}

// ---------------------------------------------------------------- a finger

test.describe("the cutscene under a finger (390x844)", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const at = { x: 195, y: 560 };

  test("a drag that starts the deal: the finger carries on and the page lands on page 2, never past it", async ({ page, cdp }) => {
    await openHome(page, { debug: "flight", at: "top" });
    await fromBlock4(page, 160);
    await startRecording(page);
    let y = at.y + 200;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y }] });
    // A steady drag, 14 px every 16 ms (about 875 px/s), until the deal starts, then 40 more moves with the finger still down.
    let started = -1;
    for (let i = 0; i < 600; i++) {
      y -= 14;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: at.x, y }] });
      await page.waitForTimeout(16);
      if (started < 0 && (await dealState(page)) === "dealing") started = i;
      if (started >= 0 && i >= started + 40) break;
      if (y < 60) {
        // The finger reached the top of the screen: lift it and put it down again lower, as a hand does.
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        y = at.y + 200;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y }] });
      }
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(started, "the deal started under the finger").toBeGreaterThanOrEqual(0);
    await unfurledOrDealt(page);
    await page.waitForTimeout(800);
    const frames = await stopRecording(page);
    expect(pastLanding(frames), `how far past page 2's top (bound ${OVERSHOOT_BOUND_PX} px)`).toBeLessThanOrEqual(OVERSHOOT_BOUND_PX);
    const stays = landsAndStays(frames);
    expect(stays, stays.slice(0, 3).join("; ")).toEqual([]);
  });

  test("a fast flick down: the deal plays and the page lands on page 2, and the browser's momentum never carries it past", async ({ page, cdp }) => {
    await openHome(page, { debug: "flight", at: "top" });
    await fromBlock4(page, 160);
    await startRecording(page);
    // A long fast flick (1,400 px at 5,000 px/s, then the browser's own momentum): the finger is still
    // moving when the deal starts, and the page would be carried far past page 2 without the lock.
    await flick(cdp, { x: at.x, y: at.y + 250 }, -1400, 5000);
    await unfurledOrDealt(page);
    await page.waitForTimeout(1500);
    const frames = await stopRecording(page);
    expect(frames.some((f) => f.deal === "dealing"), "the flick started the deal").toBe(true);
    expect(pastLanding(frames), `how far past page 2's top (bound ${OVERSHOOT_BOUND_PX} px)`).toBeLessThanOrEqual(OVERSHOOT_BOUND_PX);
    const stays = landsAndStays(frames);
    expect(stays, stays.slice(0, 3).join("; ")).toEqual([]);
  });

  test("a flick up mid-deal moves nothing, and nothing slides over block 4", async ({ page, cdp }) => {
    await openHome(page, { debug: "flight", at: "foot" });
    await page.mouse.move(at.x, at.y);
    await startRecording(page);
    await dealLink(page).click();
    await expect.poll(() => dealState(page)).toBe("dealing");
    await page.waitForFunction(() => ((window as unknown as { __coil: { entrance: () => { elapsedMs: number | null } } }).__coil.entrance().elapsedMs ?? -1e9) >= 600, null, { timeout: 10_000 });
    await flick(cdp, { x: at.x, y: at.y - 100 }, 600, 4000);
    await page.waitForTimeout(2800);
    const frames = await stopRecording(page);
    const during = frames.filter((f) => f.deal === "dealing");
    expect(during.length).toBeGreaterThan(10);
    expect(goingUp(during), "the flick up took the page back").toEqual([]);
    const hits = coverage(frames, { width: 390, height: 844 }, true);
    expect(hits, hits.slice(0, 4).join("\n")).toEqual([]);
    expect(Math.abs(frames[frames.length - 1].workTop)).toBeLessThan(2);
  });

  test("the lock holds the root still for touch: overflow hidden while it lasts, put back after, and the deal's own scroll still moves the page", async ({ page }) => {
    await openHome(page, { debug: "flight", at: "foot" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("visible");
    await startRecording(page);
    await dealLink(page).click();
    await expect.poll(() => dealState(page)).toBe("dealing");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("hidden");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe("none");
    await page.waitForFunction(() => document.documentElement.dataset.deal === "dealt", null, { timeout: 15_000 });
    await expect.poll(() => locked(page)).toBe(false);
    const frames = await stopRecording(page);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("visible");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe("auto");
    expect(Math.abs(frames[frames.length - 1].workTop), "the deal's own scroll moved the page to page 2's top under overflow hidden").toBeLessThan(2);
  });
});

// ---------------------------------------------------------------- what stays as it was

// Every moment <html data-deal-lock> is on, from before the page's own scripts run.
async function logLock(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __lockSeen: number };
    w.__lockSeen = 0;
    new MutationObserver(() => {
      if (document.documentElement.hasAttribute("data-deal-lock")) w.__lockSeen += 1;
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-deal-lock"] });
  });
}
const lockSeen = (page: Page) => page.evaluate(() => (window as unknown as { __lockSeen: number }).__lockSeen);

// Layout shifts from the first frame.
async function recordShifts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: number[]; __shiftTimes: number[] };
    w.__shifts = [];
    w.__shiftTimes = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; startTime: number; hadRecentInput: boolean }[]) {
        if (entry.hadRecentInput) continue;
        w.__shifts.push(entry.value);
        w.__shiftTimes.push(entry.startTime);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}
const shifted = (page: Page) => page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts.reduce((sum, value) => sum + value, 0));

test.describe("no lock where there is no cutscene", () => {
  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("Deal me in jumps, dealt at once, and the scroll is never held", async ({ page }) => {
      await logLock(page);
      await page.goto("/?coildebug=1");
      await page.waitForFunction(() => document.documentElement.dataset.home === "ready" && document.querySelector("section[data-scene]")?.getAttribute("data-scene") === "still", null, { timeout: 30_000 });
      await page.locator("[data-intro-cta] a").first().click();
      await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 3000 });
      expect(await lockSeen(page), "the lock was never taken").toBe(0);
    });
  });

  test("a load into /#work opens the cards at once, with no lock", async ({ page }) => {
    await logLock(page);
    await page.goto("/?coildebug=1#work");
    await waitForScene(page);
    await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt");
    expect(await lockSeen(page)).toBe(0);
  });

  test("a Menu link to Work plays the deal as it always did: a page's own scroll is not the reader's, so no lock and no scroll of the deal's own", async ({ page }) => {
    await logLock(page);
    await openHome(page, { debug: "flight", at: "top" });
    await page.getByRole("button", { name: siteContent.menu.ariaLabelOpen }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Work", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
    await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 130, null, { timeout: 8000 });
    expect(await lockSeen(page), "the Menu's own smooth scroll is left alone").toBe(0);
  });

  test("a script's scrollTo into the zone plays the deal without the lock", async ({ page }) => {
    await logLock(page);
    await openHome(page, { debug: "flight", at: "foot" });
    const facts = await dealFacts(page);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), facts.stickY + facts.range * 0.3);
    await expect(page.locator("html")).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
    await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
    expect(await lockSeen(page)).toBe(0);
  });

  test("no WebGL: the existing path, the reader's scroll is never held", async ({ page }) => {
    await logLock(page);
    await page.addInitScript(noWebgl2Api);
    await page.goto("/?coildebug=1");
    await page.waitForFunction(() => document.documentElement.dataset.home === "ready" && document.querySelector("section[data-scene]")?.getAttribute("data-scene") === "still", null, { timeout: 30_000 });
    await page.locator("[data-intro-cta] a").first().click();
    await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 15_000 });
    expect(await lockSeen(page)).toBe(0);
  });
});

// ---------------------------------------------------------------- the room, and CLS

// "Back to my cards" had the foot's old room above it before the ribbon's own beat was added (eca8851): 2.5rem on a phone,
// the story's gap (3rem) from a tablet up. With the ribbon's room closed it has them again.
for (const size of SIZES) {
  test.describe(`the foot's room and layout shift at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: !!size.phone, isMobile: !!size.phone });
    const want = size.phone ? 40 : 48;

    test("with the ribbon's room closed, Back to my cards has the room it had before eca8851", async ({ page }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      const room = () =>
        page.evaluate(() => {
          const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
          return { cta: rect("[data-intro-cta]").top - rect("[data-intro-late]").bottom, gone: document.querySelector("[data-coil-ribbon]")!.hasAttribute("data-gone") };
        });
      const open = await room();
      expect(open.gone).toBe(false);
      expect(open.cta, "the foot with the ribbon's room open: the beat above the slot, the slot, the button's gap").toBeGreaterThan(want + 100);
      await dealLink(page).click();
      await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
      await page.waitForFunction(() => document.querySelector("[data-coil-ribbon]")!.hasAttribute("data-gone"), null, { timeout: 5000 });
      expect((await room()).cta, "block 4 to the button once the slot is closed").toBeCloseTo(want, 0);
    });

    test("a load into /#work has the closed foot's room from the first paint", async ({ page }) => {
      await page.goto("/?coildebug=1#work");
      await waitForScene(page);
      await page.waitForTimeout(500);
      const gap = await page.evaluate(() => document.querySelector("[data-intro-cta]")!.getBoundingClientRect().top - document.querySelector("[data-intro-late]")!.getBoundingClientRect().bottom);
      expect(gap).toBeCloseTo(want, 0);
    });

    test("layout shift stays 0 on / and on /#work, and the lock moves nothing: the layout's width is the same through the cutscene", async ({ page, cdp }) => {
      await recordShifts(page);
      await openHome(page, { debug: "flight", at: "top" });
      await page.waitForTimeout(1500);
      expect(await shifted(page), "cumulative layout shift on / after it has loaded").toBeLessThan(0.001);
      await page.evaluate(() => ((window as unknown as { __shifts: number[] }).__shifts.length = 0));
      await fromBlock4(page);
      const at = middle(size);
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startRecording(page);
      await wheelStream(cdp, flingStream(), at);
      await expect(page.locator("html")).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
      const frames = await stopRecording(page);
      // The lock never changes the layout's width: no scrollbar comes or goes (a fine pointer's lock is listeners alone; a phone's has overlay scrollbars).
      expect(new Set(frames.map((f) => f.clientWidth)), "the root's client width through the cutscene").toEqual(new Set([frames[0].clientWidth]));
      // And no shift is the lock's: none within 100 ms of its being taken or let go.
      const span = lockSpan(frames);
      const shifts = await page.evaluate(() => (window as unknown as { __shiftTimes: number[] }).__shiftTimes);
      for (const at of [frames[span.first].t, frames[span.last].t]) {
        expect(shifts.filter((t) => t >= at - 50 && t <= at + 100), `layout shifts around the lock at ${Math.round(at)} ms`).toEqual([]);
      }
      const second = await page.context().newPage();
      await recordShifts(second);
      await second.goto("/?coildebug=1#work");
      await waitForScene(second);
      await second.waitForTimeout(1500);
      expect(await shifted(second), "cumulative layout shift on /#work").toBeLessThan(0.001);
    });
  });
}
