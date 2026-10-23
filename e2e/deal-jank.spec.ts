import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { decodePng } from "./support/pixels";
import { COIL } from "@/lib/coil/constants";
import { dealMs } from "@/lib/coil/dealSpeed";
import { entranceClock, fieldMask, pullPhases, pullProgress } from "@/lib/coil/entrance";

// Where the deal could look janky (the motion spec's section 6), tested from
// frames the deal draws on its own clock: ?coildebug stepEntrance(ms) holds the
// scene at a millisecond and draws it at once, so a whole deal is walked one
// 60 Hz frame at a time and every number below is the same on every run.
// Risk 2 (at most 0.3 card a frame) is lib/coil/dealSpeed.test.ts.

const FRAME_MS = 1000 / 60;
// The deal from the click: the condense, then the scene's own clock (lib/coil/dealSpeed.ts).
const LEAD_MS = COIL.deal.timeline.condenseMs;
const TOTAL_MS = dealMs();
const CURL_END_MS = LEAD_MS + COIL.deal.timeline.curlMs;
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

// The stage covers the first screen from the page's first pixel: at the top it is in view.
async function stageInView(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
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
// The pull's winding used to start at once at full rate when the pull passes
// COIL.entrance.windStart, a kick of up to about 35 px in a card's second difference
// over two frames (the motion review's P2). COIL.deal.timeline.windRampMs eases its
// onset in, and the onset is held to the bound the rest of the deal keeps: at the
// default ramp a card's onset reads about 13.7 px, the deal's own acceleration
// there (it is about 11 px a frame squared on either side), and no longer ramp takes
// it lower (lib/coil/windOnset.test.ts sweeps the ramp), so 12 is not reachable.
const WIND_ONSET_BOUND_PX = 14;
// No frame of the ribbon's condense, the curl, or anything after may step a card's
// center more than this, so nothing jumps.
const FRAME_STEP_BOUND_PX = 40;
const windOnsetMs = (() => {
  for (let ms = 0; ms < TOTAL_MS; ms += 1) if (pullPhases(pullProgress(entranceClock(ms - LEAD_MS))).wind > 0) return ms;
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
    // On the first screen a card may sit off the edge of the ribbon (faded out) until the row has curled into the wheel; from then on it is on screen.
    expect(track.filter((p, i) => p === null && i * FRAME_MS > CURL_END_MS + 2 * FRAME_MS).length, "frames, after the curl, where the card is out of sight").toBe(0);
    let worst = 0;
    let worstAt = 0;
    let kink = 0;
    let mostStep = 0;
    let mostStepAt = 0;
    // The most a frame steps the card through the condense and the curl (the bound's window), and through the whole deal (reported).
    let stepAfter = 0;
    for (let i = 1; i < track.length; i++) {
      if (!track[i] || !track[i - 1]) continue;
      const step = Math.hypot(track[i]!.x - track[i - 1]!.x, track[i]!.y - track[i - 1]!.y);
      if (i * FRAME_MS <= CURL_END_MS + 2 * FRAME_MS) {
        if (step > mostStep) {
          mostStep = step;
          mostStepAt = i * FRAME_MS;
        }
      } else stepAfter = Math.max(stepAfter, step);
    }
    for (let i = 1; i < track.length - 1; i++) {
      if (!track[i - 1] || !track[i] || !track[i + 1]) continue;
      const [a, b, c] = [track[i - 1]!, track[i]!, track[i + 1]!];
      const d2 = Math.hypot(c.x - 2 * b.x + a.x, c.y - 2 * b.y + a.y);
      const ms = i * FRAME_MS;
      if (ms >= windOnsetMs - 2 * FRAME_MS && ms <= windOnsetMs + 3 * FRAME_MS) kink = Math.max(kink, d2);
      else if (d2 > worst) {
        worst = d2;
        worstAt = ms;
      }
    }
    test.info().annotations.push({
      type: "second difference",
      description: `${worst.toFixed(2)} px at ${worstAt.toFixed(0)} ms; the winding's onset (${windOnsetMs} ms) ${kink.toFixed(2)} px; the most a frame steps through the condense and curl ${mostStep.toFixed(1)} px at ${mostStepAt.toFixed(0)} ms, after them ${stepAfter.toFixed(1)} px`,
    });
    expect(worst, `worst second difference ${worst.toFixed(2)} px at ${worstAt.toFixed(0)} ms`).toBeLessThanOrEqual(SECOND_DIFFERENCE_BOUND_PX);
    expect(kink, `the winding's onset at ${windOnsetMs} ms`).toBeLessThanOrEqual(WIND_ONSET_BOUND_PX);
    expect(mostStep, `no frame step over ${FRAME_STEP_BOUND_PX} px through the condense and the curl (the most is ${mostStep.toFixed(1)} px at ${mostStepAt.toFixed(0)} ms)`).toBeLessThanOrEqual(FRAME_STEP_BOUND_PX);
  });
}

// The condense and the curl, on their own: the ribbon's cards (every one on screen, followed
// by their keys) through the gaps closing and the row curling into the wheel, a frame
// apart. A card steps a few px a frame in the drift and the condense, never over the
// bound, and its second difference stays the deal's ordinary few px.
test("jank 1: the ribbon's condense and curl move the cards around the middle smoothly, a frame at a time", async ({ page }) => {
  await openHome(page, { debug: "flight", at: "top" });
  await stageInView(page);
  const result = await page.evaluate(
    ({ curlEnd, frame }) => {
      const w = window as CoilWindow;
      const width = document.querySelector("#work canvas")!.getBoundingClientRect().width;
      // The cards in the middle of the row at the click: every one of them is on screen through the condense and the curl.
      w.__coil.stepEntrance(0);
      const keys = w.__coilFlight.scene
        .slots()
        .filter((s) => Math.abs(s.center.x - width / 2) < width * 0.3)
        .map((s) => s.key);
      const tracks = new Map<string, { x: number; y: number }[]>(keys.map((key) => [key, []]));
      for (let ms = 0; ms <= curlEnd + 4 * frame; ms += frame) {
        w.__coil.stepEntrance(ms);
        const slots = w.__coilFlight.scene.slots();
        for (const [key, list] of tracks) {
          const copies = slots.filter((s) => s.key === key);
          if (!copies.length) {
            list.push({ x: Number.NaN, y: Number.NaN });
            continue;
          }
          const guess = list.at(-1);
          const near = (s: (typeof copies)[number]) => (guess && Number.isFinite(guess.x) ? Math.hypot(s.center.x - guess.x, s.center.y - guess.y) : 0);
          const best = copies.reduce((a, b) => (near(b) < near(a) ? b : a));
          list.push({ x: best.center.x, y: best.center.y });
        }
      }
      w.__coil.stepEntrance(null);
      return [...tracks.entries()].map(([key, points]) => ({ key, points }));
    },
    { curlEnd: CURL_END_MS, frame: FRAME_MS },
  );
  expect(result.length, "cards around the middle").toBeGreaterThan(3);
  let mostStep = 0;
  let worstSecond = 0;
  for (const { key, points } of result) {
    expect(points.filter((p) => !Number.isFinite(p.x)).length, `${key} stays on screen through the condense and the curl`).toBe(0);
    for (let i = 1; i < points.length; i++) mostStep = Math.max(mostStep, Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    for (let i = 1; i < points.length - 1; i++) {
      worstSecond = Math.max(worstSecond, Math.hypot(points[i + 1].x - 2 * points[i].x + points[i - 1].x, points[i + 1].y - 2 * points[i].y + points[i - 1].y));
    }
  }
  test.info().annotations.push({ type: "condense and curl", description: `${result.length} cards: the most a frame steps ${mostStep.toFixed(1)} px, the worst second difference ${worstSecond.toFixed(1)} px` });
  expect(mostStep, `a frame steps a card ${mostStep.toFixed(1)} px`).toBeLessThanOrEqual(FRAME_STEP_BOUND_PX);
  expect(worstSecond, `second difference ${worstSecond.toFixed(1)} px`).toBeLessThanOrEqual(SECOND_DIFFERENCE_BOUND_PX);
});

// ---------------------------------------------------------------- risk 3: the sticky stage

for (const size of [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "390x844", viewport: { width: 390, height: 844 }, touch: true },
]) {
  test.describe(`jank 3: the sticky stage at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch, deviceScaleFactor: size.touch ? 2 : 1 });

    test("the canvas maps a point to the card under it at three places in the sticky range", async ({ page }) => {
      await openHome(page, { debug: "flight", at: "top" });
      const range = await page.evaluate(() => {
        const rail = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
        const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
        return { railDoc: rail.top + window.scrollY, size: rail.height - stage.height };
      });
      expect(range.size, "there is a sticky range").toBeGreaterThan(50);
      for (const share of [0.04, 0.5, 0.9]) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), range.railDoc + range.size * share);
        await page.waitForTimeout(400);
        const probe = await page.evaluate(() => {
          const w = window as CoilWindow;
          // The cards the canvas may pick: whole enough (the ribbon's edges fade out, and a faded card is not pickable).
          const centers = w.__coilFlight.scene.slots().map((s) => s.center);
          const rect = document.querySelector("#work canvas")!.getBoundingClientRect();
          const onScreen = centers.filter((c) => c.x > rect.left + 4 && c.x < rect.right - 4 && c.y > Math.max(rect.top, 0) + 4 && c.y < Math.min(rect.bottom, innerHeight) - 4);
          const hits = onScreen.map((c) => w.__coil.captureAt(c.x, c.y).onCard);
          const left = Math.min(...centers.map((c) => c.x));
          // Far from every card: left of the whole wheel, inside the canvas.
          const miss = w.__coil.captureAt(Math.max(rect.left + 3, left - 120), Math.max(rect.top, 0) + 6);
          return { cards: onScreen.length, hits: hits.filter(Boolean).length, missOnCard: miss.onCard };
        });
        expect(probe.cards, `cards on screen at ${share}`).toBeGreaterThanOrEqual(2);
        expect(probe.hits, `cards the canvas finds under their own centers at ${share} of the range`).toBe(probe.cards);
        expect(probe.missOnCard, `empty canvas at ${share}`).toBe(false);
      }
    });

    test("the canvas keeps its height through the deal and no rebuild fires", async ({ page }) => {
      await openHome(page, { at: "top" });
      await page.waitForTimeout(400);
      const read = () => page.evaluate(() => { const w = window as CoilWindow; return { css: w.__coil.budget().css.join("x"), rebuilding: w.__coil.entrance().rebuilding }; });
      const before = await read();
      await page.locator("[data-first-cta] a").first().click();
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
// the field wide open (the deal's end) differ only by the faded patch behind the
// paragraphs, which the opening circle lifts, and by the name's letters. Each stage is
// drawn over the bare page, and every pixel clear of the cards and the name must be the
// page's color mixed with the open field's by one share: between the two on every
// channel (no bright halo, no dark fringe) and the same share on every channel that can
// tell them apart (no tinted rim). The open frame's top edge rises from the page with no
// step.
const EDGE_FRAMES_MS = [0, 600, 900, 1100, 1500, 2100, 3000, 4000];
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`jank 4: the mask's edge, ${colorScheme}`, () => {
    test.use({ colorScheme });

    test(`shows no halo or fringe at forced ${EDGE_FRAMES_MS.join(", ")} ms`, async ({ page }) => {
      await openHome(page, { debug: "1,at=0.5", at: "top" });
      await stageInView(page);
      await page.addStyleTag({ content: HIDE_PAGE });
      const rect = await page.evaluate(() => { const r = document.querySelector("#work canvas")!.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g)!.slice(0, 3).map(Number));
      // The name's lockup (the h1's box, the greeting included): its letters are not the field.
      const name = await page.evaluate(() => {
        const r = document.querySelector("[data-coil-name]")!.getBoundingClientRect();
        const c = document.querySelector("#work canvas")!.getBoundingClientRect();
        return { x0: r.left - c.left - 24, y0: r.top - c.top - 24, x1: r.right - c.left + 24, y1: r.bottom - c.top + 24 };
      });
      const origin = { x: (name.x0 + name.x1) / 2, y: (name.y0 + name.y1) / 2 };
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
        const covered = (x: number, y: number) =>
          [...shown.boxes, ...open.boxes, name].some((b) => x >= (b as { x0: number }).x0 && x <= (b as { x1: number }).x1 && y >= (b as { y0: number }).y0 && y <= (b as { y1: number }).y1);
        const mask = fieldMask(entranceClock(ms - LEAD_MS), { width: rect.width, height: rect.height }, COIL, origin);
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
        if (ms === 900 || ms === 1100) expect(edge, `${label}: pixels inside the feather`).toBeGreaterThan(40);
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
  await page.locator("[data-first-cta] a").first().click();
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
  const next = await shot(TOTAL_MS + FRAME_MS);
  // How far apart two frames are: the mean of the worst channel's difference, and the share of
  // pixels that differ by more than 24 (the cards' edges moving a pixel with the strand).
  const apart = (a: typeof last, b: typeof last) => {
    let sum = 0;
    let strong = 0;
    for (let i = 0; i < a.rgba.length; i += 4) {
      let worst = 0;
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(a.rgba[i + c] - b.rgba[i + c]));
      sum += worst;
      if (worst > 24) strong++;
    }
    const pixels = a.rgba.length / 4;
    return { mean: sum / pixels, strong: strong / pixels };
  };
  // The last deal frame against the first rested frame, as close as two rested frames are to each other.
  const handoff = apart(last, rested);
  const baseline = apart(rested, next);
  test.info().annotations.push({
    type: "hand-off against two rested frames",
    description: `mean ${handoff.mean.toFixed(2)} against ${baseline.mean.toFixed(2)} of 255; strong share ${(handoff.strong * 100).toFixed(2)}% against ${(baseline.strong * 100).toFixed(2)}%`,
  });
  expect(handoff.mean, "mean difference, of 255").toBeLessThan(Math.max(1.5, baseline.mean * 1.5));
  expect(handoff.strong, "share of pixels that differ by more than 24").toBeLessThan(Math.max(0.002, baseline.strong * 2));
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
  await page.locator("[data-first-cta] a").first().click();
  await page.waitForFunction(() => (window as CoilWindow & { __rest: unknown[] }).__rest.length >= 120, null, { timeout: 20_000 });
  const rest = await page.evaluate(() => (window as CoilWindow & { __rest: { t: number; offset: number }[] }).__rest);
  const speed = ((rest.at(-1)!.offset - rest[0].offset) / (rest.at(-1)!.t - rest[0].t)) * 1000;
  expect(speed / COIL.idleCardsPerSecond, "cards a second over the first two seconds of rest, against idle").toBeGreaterThan(0.95);
  expect(speed / COIL.idleCardsPerSecond).toBeLessThan(1.05);
});
