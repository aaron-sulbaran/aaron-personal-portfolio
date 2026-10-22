import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { decodePng } from "./support/pixels";
import { COIL } from "@/lib/coil/constants";
import { sceneMs } from "@/lib/coil/dealSpeed";
import { entranceClock, fieldMask, pullPhases, pullProgress } from "@/lib/coil/entrance";
import { siteContent } from "@/lib/content";

// Where the deal could look janky (the motion spec's section 6), tested from
// frames the deal draws on its own clock: ?coildebug stepEntrance(ms) holds the
// scene at a millisecond and draws it at once, so a whole deal is walked one
// 60 Hz frame at a time and every number below is the same on every run.
// Risk 2 (at most 0.3 card a frame) is lib/coil/dealSpeed.test.ts.

const { teaser } = siteContent.intro;
const FRAME_MS = 1000 / 60;
const TOTAL_MS = sceneMs();
const HIDE_PAGE =
  "html,body{transition:none!important}body *{visibility:hidden!important}section[data-scene] canvas{visibility:visible!important}";

type CoilWindow = Window &
  typeof globalThis & {
    __coil: {
      stepEntrance: (ms: number | null) => void;
      budget: () => { css: [number, number] };
      visibleQuads: () => { x: number; y: number }[][];
      entrance: () => { elapsedMs: number | null; ended: boolean; offset: number; rebuilding: boolean };
      captureAt: (x: number, y: number) => { onCard: boolean };
      offset: () => number;
    };
    __coilFlight: { scene: { slots: () => { key: string; center: { x: number; y: number }; alpha: number }[] } };
  };

async function stageInView(page: Page) {
  await page.evaluate(() => {
    const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
    window.scrollTo({ top: stage.top + window.scrollY, behavior: "instant" });
  });
  await page.waitForTimeout(600);
}

// ---------------------------------------------------------------- risk 1: the joins

// One card's projected center through the whole deal, a frame apart: the second
// difference (the change in its per-frame step) is its acceleration. Smooth
// curves keep it small; a join that stalls, snaps or doubles back shows as a spike.
// The wheel's own spin is in it (a card on a 208 px ring at 12.5 cards a second
// accelerates inward at about 2 px a frame squared), and the helix's winding adds
// more, so the bound is a few px, and a hitch in the layout changes is many.
const SECOND_DIFFERENCE_BOUND_PX = 14;
// One join is known and not eased: the pull's winding starts at once at full rate
// when the pull passes COIL.entrance.windStart (lib/coil/entrance.ts pullPhases is
// linear there), a kick of up to about 35 px in a card's second difference over two
// frames. That is the pull Aaron approved, so it is held to its measured size here
// (a guard, not a verdict) and reported for the motion review, which can ease it.
const WIND_ONSET_BOUND_PX = 45;
const windOnsetMs = (() => {
  for (let ms = 0; ms < TOTAL_MS; ms += 1) if (pullPhases(pullProgress(entranceClock(ms))).wind > 0) return ms;
  return TOTAL_MS;
})();

for (const key of ["ieee", "talos", "anthropic"] as const) {
  test(`jank 1: ${key}'s projected center has a bounded second difference through the whole deal`, async ({ page }) => {
    await openHome(page, { debug: "flight", at: "top" });
    await stageInView(page);
    const track = await page.evaluate(
      ({ key, frame, total }) => {
        const w = window as CoilWindow;
        const out: ({ x: number; y: number } | null)[] = [];
        let p1: { x: number; y: number } | null = null;
        let p2: { x: number; y: number } | null = null;
        for (let ms = 0; ms <= total + frame; ms += frame) {
          w.__coil.stepEntrance(ms);
          const slots = w.__coilFlight.scene.slots().filter((s) => s.key === key);
          if (!slots.length) {
            out.push(null);
            p2 = p1;
            p1 = null;
            continue;
          }
          // The same card as the last frame: the copy of it nearest where it is going.
          const guess: { x: number; y: number } = p1 && p2 ? { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y } : (p1 ?? slots[0].center);
          const near = (s: (typeof slots)[number]) => Math.hypot(s.center.x - guess.x, s.center.y - guess.y);
          const best = slots.reduce((a, b) => (near(b) < near(a) ? b : a));
          p2 = p1;
          p1 = { x: best.center.x, y: best.center.y };
          out.push(p1);
        }
        w.__coil.stepEntrance(null);
        return out;
      },
      { key, frame: FRAME_MS, total: TOTAL_MS },
    );
    expect(track.filter((p) => p === null).length, "frames where the card is out of sight").toBe(0);
    let worst = 0;
    let worstAt = 0;
    let kink = 0;
    for (let i = 1; i < track.length - 1; i++) {
      const [a, b, c] = [track[i - 1]!, track[i]!, track[i + 1]!];
      const d2 = Math.hypot(c.x - 2 * b.x + a.x, c.y - 2 * b.y + a.y);
      const ms = i * FRAME_MS;
      if (ms >= windOnsetMs - 2 * FRAME_MS && ms <= windOnsetMs + 3 * FRAME_MS) kink = Math.max(kink, d2);
      else if (d2 > worst) {
        worst = d2;
        worstAt = ms;
      }
    }
    test.info().annotations.push({ type: "second difference", description: `${worst.toFixed(2)} px at ${worstAt.toFixed(0)} ms; the winding's onset (${windOnsetMs} ms) ${kink.toFixed(2)} px` });
    expect(worst, `worst second difference ${worst.toFixed(2)} px at ${worstAt.toFixed(0)} ms`).toBeLessThanOrEqual(SECOND_DIFFERENCE_BOUND_PX);
    expect(kink, `the winding's onset at ${windOnsetMs} ms`).toBeLessThanOrEqual(WIND_ONSET_BOUND_PX);
  });
}

// ---------------------------------------------------------------- risk 3: the sticky stage

for (const size of [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "390x844", viewport: { width: 390, height: 844 }, touch: true },
]) {
  test.describe(`jank 3: the sticky stage at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: size.touch ? 2 : 1 });

    test("the canvas maps a point to the card under it at three places in the sticky range", async ({ page }) => {
      await openHome(page, { at: "top" });
      const range = await page.evaluate(() => {
        const rail = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
        const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
        return { railDoc: rail.top + window.scrollY, size: rail.height - stage.height };
      });
      expect(range.size, "there is a sticky range").toBeGreaterThan(50);
      for (const share of [0.04, 0.5, 0.9]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), range.railDoc + range.size * share);
        // The first place also lets the wheel slide in (700 ms after it is first in view).
        await page.waitForTimeout(share < 0.1 ? 1500 : 400);
        const probe = await page.evaluate(() => {
          const w = window as CoilWindow;
          const quads = w.__coil.visibleQuads();
          const centers = quads.map((q) => ({ x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 }));
          const rect = document.querySelector("#work canvas")!.getBoundingClientRect();
          const onScreen = centers.filter((c) => c.x > rect.left + 4 && c.x < rect.right - 4 && c.y > Math.max(rect.top, 0) + 4 && c.y < Math.min(rect.bottom, innerHeight) - 4);
          const hits = onScreen.map((c) => w.__coil.captureAt(c.x, c.y).onCard);
          const left = Math.min(...centers.map((c) => c.x));
          // Far from every card: left of the whole wheel, inside the canvas.
          const miss = w.__coil.captureAt(Math.max(rect.left + 3, left - 120), Math.max(rect.top, 0) + 6);
          return { cards: onScreen.length, hits: hits.filter(Boolean).length, missOnCard: miss.onCard };
        });
        expect(probe.cards, `cards on screen at ${share}`).toBeGreaterThan(3);
        expect(probe.hits, `cards the canvas finds under their own centers at ${share} of the range`).toBe(probe.cards);
        expect(probe.missOnCard, `empty canvas at ${share}`).toBe(false);
      }
    });

    test("the canvas keeps its height through the deal and no rebuild fires", async ({ page }) => {
      await openHome(page, { at: "top" });
      await page.evaluate(() => window.scrollTo({ top: document.querySelector("[data-teaser]")!.getBoundingClientRect().top + window.scrollY - 200, behavior: "instant" }));
      await page.waitForTimeout(400);
      const read = () => page.evaluate(() => { const w = window as CoilWindow; return { css: w.__coil.budget().css.join("x"), rebuilding: w.__coil.entrance().rebuilding }; });
      const before = await read();
      await page.locator("[data-teaser] button").click();
      const seen = new Set<string>([before.css]);
      let rebuilt = before.rebuilding;
      const until = Date.now() + 8000;
      while (Date.now() < until && (await page.evaluate(() => document.documentElement.dataset.deal)) !== "dealt") {
        const now = await read();
        seen.add(now.css);
        rebuilt = rebuilt || now.rebuilding;
        await page.waitForTimeout(60);
      }
      const after = await read();
      seen.add(after.css);
      expect([...seen], "the scene's CSS size through the deal").toEqual([before.css]);
      expect(rebuilt || after.rebuilding, "a rebuild fade started").toBe(false);
    });
  });
}

// ---------------------------------------------------------------- risk 4: the mask's edge

// No halo, no fringe, no line, read as numbers (no golden images). The field's
// clock is held (?coildebug=at=), so a frame at a given ms and the same frame with
// the mask wide open (the deal's end) differ only by the mask. Each stage is drawn
// over the bare page, and every pixel clear of the cards must be the page's color
// mixed with the open field's by one share: between the two on every channel (no
// bright halo, no dark fringe) and the same share on every channel that can tell
// them apart (no tinted rim). The open frame's top edge rises from the page with no
// step.
const EDGE_FRAMES_MS = [0, 600, 1500, 1800, 2100, 2400, 3400];
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`jank 4: the mask's edge, ${colorScheme}`, () => {
    test.use({ colorScheme });

    test(`shows no halo or fringe at forced ${EDGE_FRAMES_MS.join(", ")} ms`, async ({ page }) => {
      await openHome(page, { debug: "1,at=0.5", at: "top" });
      await stageInView(page);
      await page.addStyleTag({ content: HIDE_PAGE });
      const rect = await page.evaluate(() => { const r = document.querySelector("#work canvas")!.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g)!.slice(0, 3).map(Number));
      const frameAt = async (ms: number) => {
        await page.evaluate((m) => (window as CoilWindow).__coil.stepEntrance(m), ms);
        await page.waitForTimeout(80);
        const quads = await page.evaluate(() => (window as CoilWindow).__coil.visibleQuads());
        const image = decodePng(await page.screenshot({ clip: rect, scale: "css", caret: "initial" }));
        const boxes = quads.map((q) => {
          const xs = q.map((p) => p.x - rect.x);
          const ys = q.map((p) => p.y - rect.y);
          return { x0: Math.min(...xs) - 12, x1: Math.max(...xs) + 12, y0: Math.min(...ys) - 12, y1: Math.max(...ys) + 12 };
        });
        return { image, boxes };
      };
      const open = await frameAt(TOTAL_MS + 200);
      const pixel = (image: typeof open.image, x: number, y: number) => {
        const i = (y * image.width + x) * 4;
        return [image.rgba[i], image.rgba[i + 1], image.rgba[i + 2]];
      };
      for (const ms of EDGE_FRAMES_MS) {
        const shown = await frameAt(ms);
        const label = `${colorScheme} at ${ms} ms`;
        const covered = (x: number, y: number) => [...shown.boxes, ...open.boxes].some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
        const mask = fieldMask(entranceClock(ms), { width: rect.width, height: rect.height });
        let checked = 0;
        let edge = 0;
        for (let y = 0; y < shown.image.height; y += 6) {
          for (let x = 0; x < shown.image.width; x += 6) {
            if (covered(x, y)) continue;
            checked++;
            const got = pixel(shown.image, x, y);
            const field = pixel(open.image, x, y);
            const shares: number[] = [];
            for (let c = 0; c < 3; c++) {
              const lo = Math.min(paper[c], field[c]) - 3;
              const hi = Math.max(paper[c], field[c]) + 3;
              if (got[c] < lo || got[c] > hi) throw new Error(`${label}: halo or fringe at ${x},${y}: channel ${c} is ${got[c]}, outside the page's ${paper[c]} and the field's ${field[c]}`);
              if (Math.abs(field[c] - paper[c]) >= 25) shares.push((got[c] - paper[c]) / (field[c] - paper[c]));
            }
            if (shares.length >= 2 && Math.max(...shares) - Math.min(...shares) > 0.15) throw new Error(`${label}: a tinted rim at ${x},${y}: shares ${shares.map((v) => v.toFixed(2))} of the field over the page`);
            const distance = Math.hypot(x - mask.cx, y - mask.cy);
            if (mask.radius > 0 && mask.radius < 1e5 && distance > mask.radius - mask.feather && distance < mask.radius) edge++;
          }
        }
        expect(checked, `${label}: pixels checked`).toBeGreaterThan(2000);
        // The frames with the edge on the canvas really had one to check.
        if (ms === 1800 || ms === 2100) expect(edge, `${label}: pixels inside the feather`).toBeGreaterThan(40);
      }
      // The open field rises from the page down its top edge with no step.
      const fade = COIL.deal.open.topFadePx;
      for (let x = 20; x < open.image.width - 20; x += 60) {
        if (open.boxes.some((b) => x >= b.x0 && x <= b.x1 && b.y0 <= fade + 12)) continue;
        expect(Math.max(...pixel(open.image, x, 0).map((v, c) => Math.abs(v - paper[c]))), `${colorScheme}: the top row at x ${x} is the page's`).toBeLessThanOrEqual(4);
        for (let y = 1; y <= fade + 8; y++) {
          const [p, q] = [pixel(open.image, x, y - 1), pixel(open.image, x, y)];
          for (let c = 0; c < 3; c++) expect(Math.abs(q[c] - p[c]), `${colorScheme}: a step down the top edge at x ${x}, y ${y}`).toBeLessThanOrEqual(5);
        }
      }
      await page.evaluate(() => (window as CoilWindow).__coil.stepEntrance(null));
    });
  });
}

// ---------------------------------------------------------------- risk 5: the clock and the end

test("jank 5: under 6x CPU throttle the master's clock keeps pace with real time", async ({ page, cdp }) => {
  await openHome(page, { at: "top" });
  await page.evaluate(() => window.scrollTo({ top: document.querySelector("[data-teaser]")!.getBoundingClientRect().top + window.scrollY - 200, behavior: "instant" }));
  await page.waitForTimeout(500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.evaluate(() => {
    const w = window as CoilWindow & { __drift: { t: number; clock: number }[] };
    w.__drift = [];
    const tick = () => {
      const e = w.__coil.entrance();
      if (e.elapsedMs !== null && e.elapsedMs >= 0) w.__drift.push({ t: performance.now(), clock: e.elapsedMs });
      if (document.documentElement.dataset.deal !== "dealt") requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator("[data-teaser] button").click();
  await page.waitForFunction(() => document.documentElement.dataset.deal === "dealt", null, { timeout: 30_000 });
  const samples = await page.evaluate(() => (window as CoilWindow & { __drift: { t: number; clock: number }[] }).__drift);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  expect(samples.length).toBeGreaterThan(10);
  // The clock against the wall over the whole deal. The scene reads the clock once a
  // frame, so a sample is up to a frame old (about 20 ms of offset at 1x as well); what
  // would show a lag is a clock that falls further behind the wall as the deal goes on
  // (GSAP's lagSmoothing trails the timeline after a stall). The end-to-end deficit is
  // held to two frames, and the deal needs no lagSmoothing(0): a stall long enough for
  // GSAP to trim only makes the whole choreography, its scroll and its columns
  // included, wait on the one clock, never skip.
  const [first, last] = [samples[0], samples.at(-1)!];
  const deficit = last.clock - first.clock - (last.t - first.t);
  const intervals = samples.slice(1).map((s, i) => s.t - samples[i].t).sort((a, b) => a - b);
  test.info().annotations.push({
    type: "clock against the wall under 6x CPU throttle",
    description: `end-to-end deficit ${deficit.toFixed(1)} ms over ${samples.length} frames, median interval ${intervals[Math.floor(intervals.length / 2)].toFixed(1)} ms, longest ${intervals.at(-1)!.toFixed(1)} ms`,
  });
  expect(Math.abs(deficit), `the clock fell ${deficit.toFixed(1)} ms behind the wall`).toBeLessThanOrEqual(2 * FRAME_MS);
});

test("jank 5: the last deal frame matches the first rested frame, and the strand carries on at the idle pace", async ({ page }) => {
  await openHome(page, { debug: "1", at: "top" });
  await stageInView(page);
  await page.addStyleTag({ content: HIDE_PAGE });
  const rect = await page.evaluate(() => { const r = document.querySelector("#work canvas")!.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  const shot = async (ms: number) => {
    await page.evaluate((m) => (window as CoilWindow).__coil.stepEntrance(m), ms);
    await page.waitForTimeout(60);
    return decodePng(await page.screenshot({ clip: rect, scale: "css", caret: "initial" }));
  };
  const last = await shot(TOTAL_MS - FRAME_MS);
  const rested = await shot(TOTAL_MS);
  let sum = 0;
  let strong = 0;
  for (let i = 0; i < last.rgba.length; i += 4) {
    let worst = 0;
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(last.rgba[i + c] - rested.rgba[i + c]));
    sum += worst;
    if (worst > 24) strong++;
  }
  const pixels = last.rgba.length / 4;
  expect(sum / pixels, "mean difference, of 255").toBeLessThan(1.5);
  expect(strong / pixels, "share of pixels that differ by more than 24").toBeLessThan(0.002);
  // The strand's step per frame either side of the end is the idle pace's, within 5 percent.
  const offsetAt = async (ms: number) => {
    await page.evaluate((m) => (window as CoilWindow).__coil.stepEntrance(m), ms);
    return page.evaluate(() => (window as CoilWindow).__coil.offset());
  };
  const idlePerFrame = (COIL.idleCardsPerSecond * FRAME_MS) / 1000;
  for (const from of [TOTAL_MS - 2 * FRAME_MS, TOTAL_MS, TOTAL_MS + 6 * FRAME_MS]) {
    const step = (await offsetAt(from + FRAME_MS)) - (await offsetAt(from));
    expect(step / idlePerFrame, `the strand's step per frame from ${from.toFixed(0)} ms, against idle`).toBeGreaterThan(0.95);
    expect(step / idlePerFrame).toBeLessThan(1.05);
  }
  await page.evaluate(() => (window as CoilWindow).__coil.stepEntrance(null));
});

test("jank 5: after a real deal the conveyor keeps the idle pace with no hitch at the hand-off", async ({ page }) => {
  await openHome(page, { at: "top" });
  await page.evaluate(() => window.scrollTo({ top: document.querySelector("[data-teaser]")!.getBoundingClientRect().top + window.scrollY - 200, behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const w = window as CoilWindow & { __rest: { t: number; offset: number }[] };
    w.__rest = [];
    const tick = () => {
      const e = w.__coil.entrance();
      if (e.ended) w.__rest.push({ t: performance.now(), offset: e.offset });
      if (w.__rest.length < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator("[data-teaser] button").click();
  await page.waitForFunction(() => (window as CoilWindow & { __rest: unknown[] }).__rest.length >= 120, null, { timeout: 20_000 });
  const rest = await page.evaluate(() => (window as CoilWindow & { __rest: { t: number; offset: number }[] }).__rest);
  const speed = ((rest.at(-1)!.offset - rest[0].offset) / (rest.at(-1)!.t - rest[0].t)) * 1000;
  expect(speed / COIL.idleCardsPerSecond, "cards a second over the first two seconds of rest, against idle").toBeGreaterThan(0.95);
  expect(speed / COIL.idleCardsPerSecond).toBeLessThan(1.05);
  void teaser;
});
