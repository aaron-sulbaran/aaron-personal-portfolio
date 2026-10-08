import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { LOADER } from "@/lib/loader/progress";
import { bakedLockupRect, stillCut } from "@/lib/coil/heroStill";
import { test, expect } from "./support/fixtures";
import { waitForCoil } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { cardRegion, luminanceSpread, pixelDiff, shoot, type Image } from "./support/pixels";
import { noWebglContext } from "./support/webgl";
import { heroSamples, restNameRect, sampleHero, spanMs, type HeroSample } from "./support/heroSamples";
import { expectHeadingHidden } from "./support/fallback";

// The loader and the entrance (docs/coil-build-scaffold.md, slice 4): a slow
// load shows the loader with a rising number and lands its lockup ("Hi, I'm"
// over "Aaron") on the scene's in one frame; a cached load never shows the
// pane, only the resting lockup, which the canvas takes over in one frame;
// the fallback h1 never shows while a scene is on its way; the scroll lock
// over loader and entrance releases exactly once.

type LoaderFrame = { event: string; data?: { shown?: number; numberHidden?: boolean } };
type Lockup = NonNullable<ReturnType<NonNullable<HookWindow["__coil"]>["api"]["nameRect"]>>;

// The lockup's two regions from the scene's own numbers: the name's gradient
// band across its ink, and the greeting's line around its ink.
function lockupRegions(t: Lockup, viewport: { width: number; height: number }) {
  const rect = (x0: number, y0: number, x1: number, y1: number) =>
    cardRegion(
      [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
      viewport,
      0,
    );
  const g = t.greeting;
  return {
    name: rect(t.left, t.gradient.top, t.left + t.width, t.gradient.top + t.gradient.height),
    greeting: rect(g.left - 3, g.baseline - 0.8 * g.fontPx, g.left + 2.8 * g.fontPx, g.baseline + 0.2 * g.fontPx),
  };
}

// Both sides of a held hand-off: the DOM lockup on the canvas field, then the
// canvas lockup the same frame the DOM one leaves. Each region within the
// slow path's tolerance, and letters on both sides (not an empty field twice).
async function expectSeamlessHandoff(page: Page, label: string, minGreetingSpread: number) {
  const target = (await page.evaluate(() => (window as HookWindow).__coil!.api.nameRect()))!;
  const regions = lockupRegions(target, page.viewportSize()!);
  const before = { name: await shoot(page, regions.name.box), greeting: await shoot(page, regions.greeting.box) };
  // The hand-off renders its frame synchronously; the freeze stops the loop
  // right after it, so the shot is that frame and not the surface growing in.
  const handedOff = await page.evaluate(() => {
    const w = window as HookWindow;
    w.__coilLoader!.finish!();
    w.__coil!.api.freeze(true);
    return w.__coilLoader!.events.some((e) => e.event === "handoff");
  });
  expect(handedOff, `${label}: the hand-off happened in the finishing task`).toBe(true);
  const after = { name: await shoot(page, regions.name.box), greeting: await shoot(page, regions.greeting.box) };
  await page.evaluate(() => (window as HookWindow).__coil!.api.freeze(false));
  for (const part of ["name", "greeting"] as const) {
    const diff = pixelDiff(before[part], after[part], after[part], regions[part]);
    test.info().annotations.push({ type: `${label} ${part}`, description: `mean ${diff.insideMean.toFixed(2)}, max ${diff.insideMax}` });
    expect(diff.insideMean, `${label}: mean difference inside the ${part}, of 255`).toBeLessThan(3);
  }
  expect(luminanceSpread(before.name), `${label}: loader side, the name box's luminance spread`).toBeGreaterThan(30);
  expect(luminanceSpread(after.name), `${label}: canvas side, the name box's luminance spread`).toBeGreaterThan(30);
  expect(luminanceSpread(before.greeting), `${label}: loader side, the greeting's luminance spread`).toBeGreaterThan(minGreetingSpread);
  expect(luminanceSpread(after.greeting), `${label}: canvas side, the greeting's luminance spread`).toBeGreaterThan(minGreetingSpread);
  return target;
}

test("loader: a throttled load shows a rising number and hands the name to the canvas without a visible change", async ({ page, cdp }) => {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 120,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  // handoff: the exit pauses on its last frame until __coilLoader.finish();
  // at=3 holds the field and the name's fill on one moment for the compare.
  await page.goto("/?coildebug=handoff,at=3");
  await page.waitForFunction(() => (window as HookWindow).__coilLoader?.events.some((e) => e.event === "exit"), null, {
    timeout: 60_000,
  });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  const events = (await page.evaluate(() => (window as HookWindow).__coilLoader!.events)) as LoaderFrame[];
  expect(events.some((e) => e.event === "skipped"), "the loader skipped").toBe(false);
  const shown = events.filter((e) => e.event === "frame").map((e) => e.data!.shown!);
  expect(new Set(shown.map((v) => v.toFixed(2))).size, "distinct progress values").toBeGreaterThan(5);
  expect(shown.every((v, i) => i === 0 || v >= shown[i - 1]), "progress never falls").toBe(true);
  expect(shown.at(-1)).toBe(1);
  const done = events.find((e) => e.event === "done");
  expect(done?.data?.numberHidden, "the number showed (the load outlived 600ms)").toBe(false);

  // Held on the exit's last frame (its timeline pauses there, exitMs after
  // the exit began): the loader's name sits on the canvas name.
  await page.waitForFunction(
    (exitMs) => {
      const exit = (window as HookWindow).__coilLoader!.events.find((e) => e.event === "exit")!;
      return performance.now() > exit.t + exitMs + 50 && !!(window as HookWindow).__coil?.api.nameRect();
    },
    LOADER.exitMs,
  );
  await expectSeamlessHandoff(page, "throttled", 12);
});

// The slow path on a cached build (the tally's items land on a schedule):
// at the exit's held last frame the loader's greeting is on screen, on the
// canvas greeting, and the hand-off changes no pixel of the lockup.
test("loader: the slow path lands the greeting with the name, pixel for pixel", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.goto("/?coildebug=slow,handoff,at=3");
  await page.waitForFunction(
    (exitMs) => {
      const w = window as HookWindow;
      const exit = w.__coilLoader?.events.find((e) => e.event === "exit");
      return !!exit && performance.now() > exit.t + exitMs + 50 && !!w.__coil?.api.nameRect();
    },
    LOADER.exitMs,
    { timeout: 30_000 },
  );
  const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
  expect(events, "the slow load showed the pane").toContain("100");
  // The greeting is in the loader at the landed frame, where the canvas draws it.
  const greet = await page.evaluate(() => {
    const el = document.querySelector(".coil-loader__greet")!;
    const r = el.getBoundingClientRect();
    return {
      text: el.textContent,
      shows: el.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
      fontPx: parseFloat(getComputedStyle(el).fontSize),
      scale: new DOMMatrixReadOnly(getComputedStyle(el.parentElement!).transform).a,
      left: r.left,
      bottom: r.bottom,
    };
  });
  const target = (await page.evaluate(() => (window as HookWindow).__coil!.api.nameRect()))!;
  expect(greet.text).toBe("Hi, I'm");
  expect(greet.shows, "the loader's greeting shows at the landed frame").toBe(true);
  expect(greet.fontPx * greet.scale, "the greeting's landed size, px").toBeCloseTo(target.greeting.fontPx, 0);
  await expectSeamlessHandoff(page, "slow", 12);
});

// The slow path with the page moved under it: the pane and its ground are
// fixed children of a root that is a container (size containment only, so
// not their containing block); they still cover the viewport at 1800px.
test("loader: the slow path's pane covers the viewport with the page moved down", async ({ page }) => {
  await page.goto("/?coildebug=slow");
  await page.waitForFunction(() => {
    const bg = document.querySelector(".coil-loader__bg");
    return !!bg && getComputedStyle(bg).opacity === "1" && bg.checkVisibility({ visibilityProperty: true });
  });
  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: "instant" }));
  await page.waitForFunction(() => Math.abs(window.scrollY - 1800) < 1);
  const cover = await page.evaluate(() => ({
    state: document.querySelector<HTMLElement>(".coil-loader")!.dataset.state ?? null,
    paneTop: document.querySelector(".coil-loader__pane")!.getBoundingClientRect().top,
    hit: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".coil-loader") != null,
  }));
  expect(cover.state, "the pane is still up").toBeNull();
  expect(cover.paneTop, "the pane's top, px from the viewport's").toBe(0);
  expect(cover.hit, "the viewport's center hits the loader").toBe(true);
});

// The slow path with the page moved away while the pane is up: the canvas
// lockup is off screen, so the exit takes the plain fade instead of flying
// the lockup off screen and giving up on the hand-off 1.5s later.
test("loader: a slow load with the page moved away fades out instead of landing off screen", async ({ page }) => {
  await page.goto("/?coildebug=slow");
  await page.waitForFunction(() => {
    const bg = document.querySelector(".coil-loader__bg");
    return !!bg && getComputedStyle(bg).opacity === "1";
  });
  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: "instant" }));
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone", null, {
    timeout: 30_000,
  });
  const events = await page.evaluate(() =>
    (window as HookWindow).__coilLoader!.events.map((e) => e.event).filter((event) => event !== "frame"),
  );
  expect(events, "the slow load showed the pane").toContain("100");
  expect(events, "the exit took the plain fade").toContain("fade");
  expect(events, "no continuity exit toward an off-screen lockup").not.toContain("exit");
  expect(events, "no hand-off given up").not.toContain("handoff-gave-up");
});

// A warm load inside the guard: the resting lockup, already the landed pose,
// is the canvas lockup at the hand-off (held there by ?coildebug=handoff).
test("loader: the resting lockup is the canvas lockup at the hand-off", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.goto("/?coildebug=handoff,at=3");
  await page.waitForFunction(
    () => {
      const w = window as HookWindow;
      return (
        !!w.__coilLoader?.events.some((e) => e.event === "rest") &&
        !!w.__coilLoader.finish &&
        !!w.__coil?.api.nameRect() &&
        document.querySelector<HTMLElement>("section[data-scene]")?.dataset.scene === "on"
      );
    },
    null,
    { timeout: 30_000 },
  );
  const target = (await page.evaluate(() => (window as HookWindow).__coil!.api.nameRect()))!;
  const sizes = await page.evaluate(() =>
    [".coil-loader__rest-name", ".coil-loader__rest-greet"].map((sel) => parseFloat(getComputedStyle(document.querySelector(sel)!).fontSize)),
  );
  expect(sizes[0], "the resting name's size, px").toBeCloseTo(target.fontPx, 1);
  expect(sizes[1], "the resting greeting's size, px").toBeCloseTo(target.greeting.fontPx, 1);
  await expectSeamlessHandoff(page, "resting", 12);
});

// A scene slow to take the resting lockup (a software GPU, a throttled CPU, a
// tab restored in the background) while the page moves under the hold: the
// scroll lock stops wheels and swipes, not a script, an anchor jump or
// find-in-page. ?coildebug=slowscene holds the hand-off for 1.5s; the page
// jumps to 1800px at 300ms. Every frame from the jump to the hand-off: no
// "Hi, I'm" on screen under a fixed ancestor, so nothing of the hero floats
// over the book. The greeting comes from the copy, and the resting greeting
// must have been found at all, so a copy change cannot pass this vacuously.
type RestFrame = {
  t: number;
  y: number;
  state: string | null;
  restGreeting: boolean;
  floating: { cls: string; top: number }[];
};

test("loader: the resting lockup stays with the hero when the page moves before the scene takes it", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.addInitScript(
    ({ scrollAt, scrollTo, greeting }) => {
      const frames: RestFrame[] = [];
      (window as unknown as { __restFrames: RestFrame[] }).__restFrames = frames;
      const underFixed = (el: Element) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (getComputedStyle(node).position === "fixed") return true;
        }
        return false;
      };
      const scan = () => {
        const found: RestFrame["floating"] = [];
        let restGreeting = false;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          const el = text.parentElement;
          if (!el || !(text.textContent ?? "").trimStart().startsWith(greeting)) continue;
          if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          if (el.classList.contains("coil-loader__rest-greet")) restGreeting = true;
          const r = el.getBoundingClientRect();
          const onScreen = r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
          if (onScreen && underFixed(el)) found.push({ cls: el.className, top: Math.round(r.top) });
        }
        return { found, restGreeting };
      };
      let jumped = false;
      const sample = () => {
        const now = performance.now();
        if (!jumped && now >= scrollAt && document.readyState !== "loading" && document.querySelector(".coil-loader")) {
          jumped = true;
          window.scrollTo({ top: scrollTo, behavior: "instant" });
        }
        const state = document.querySelector<HTMLElement>(".coil-loader")?.dataset.state ?? null;
        if (jumped) {
          const { found, restGreeting } = scan();
          frames.push({ t: now, y: Math.round(window.scrollY), state, restGreeting, floating: found });
        }
        if (state !== "gone" && frames.length < 3000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { scrollAt: 300, scrollTo: 1800, greeting: siteContent.hero.greeting },
  );
  await page.goto("/?coildebug=slowscene=1500");
  // The scene idles off screen, so the wait is on the loader, not the hero.
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone", null, {
    timeout: 30_000,
  });

  const frames = await page.evaluate(() => (window as unknown as { __restFrames: RestFrame[] }).__restFrames);
  const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
  expect(events, "the load rested (a busy run that took the slow path never did)").toContain("rest");
  expect(frames.filter((f) => f.restGreeting).length, "frames where the resting greeting was found at all").toBeGreaterThan(0);
  const held = frames.filter((f) => f.state === "rest" && f.y > 1000);
  expect(held.length, "frames of the resting hold with the page moved down").toBeGreaterThan(2);
  const floating = frames.filter((f) => f.state !== "gone" && f.floating.length > 0);
  const first = floating[0];
  expect(
    floating.length,
    first ? `frames with a fixed greeting on screen (first at ${first.t.toFixed(0)}ms, y ${first.y}: ${JSON.stringify(first.floating)})` : "",
  ).toBe(0);

  // The hand-off still happened, from the resting hold, once the scene could take it.
  expect(events).toContain("handoff");
  expect(events).not.toContain("handoff-gave-up");
  expect(events).not.toContain("100");
  await expect(page.locator(".coil-loader")).toBeHidden();
  expect(frames.at(-1)!.state, "the loader handed off").toBe("gone");
  // Back at the top, the hero is whole: the scene drew the name it took.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await waitForCoil(page);
});

// A held hand-off (?coildebug=handoff), and the visitor goes down and comes back before the scene
// takes the lockup: away, the resting lockup moved with the hero; back at
// the top, it is the canvas lockup again, pixel for pixel, at the hand-off.
test("loader: a page moved and brought back during the resting hold still hands off pixel for pixel", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.goto("/?coildebug=handoff,at=3");
  await page.waitForFunction(
    () => {
      const w = window as HookWindow;
      return (
        !!w.__coilLoader?.events.some((e) => e.event === "rest") &&
        !!w.__coilLoader.finish &&
        !!w.__coil?.api.nameRect() &&
        document.querySelector<HTMLElement>("section[data-scene]")?.dataset.scene === "on"
      );
    },
    null,
    { timeout: 30_000 },
  );
  const greetTop = () => page.evaluate(() => document.querySelector(".coil-loader__rest-greet")!.getBoundingClientRect().top);
  const atTop = await greetTop();
  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: "instant" }));
  await page.waitForFunction(() => Math.abs(window.scrollY - 1800) < 1);
  const away = await greetTop();
  expect(away - atTop, "the resting greeting moved with the page, px").toBeCloseTo(-1800, 0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY === 0);
  expect(await greetTop(), "the resting greeting back at the top, px").toBeCloseTo(atTop, 0);
  await expectSeamlessHandoff(page, "scrolled back", 12);
});

test("loader: a cached load never shows the pane, and the scroll lock releases exactly once", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);

  await page.reload();
  await waitForCoil(page);

  const loader = await page.evaluate(() => {
    const w = window as HookWindow;
    return { events: w.__coilLoader!.events.map((e) => e.event), locks: w.__coilLoader!.locks.map((e) => e.event) };
  });
  expect(loader.events).toContain("rest");
  expect(loader.events).toContain("handoff");
  expect(loader.events).not.toContain("100");
  expect(loader.events).not.toContain("exit");
  expect(loader.events).not.toContain("fade");
  await expect(page.locator(".coil-loader")).toBeHidden();

  // The first entry is the state when the log started (the lock not yet
  // engaged); after it the lock engages once and releases once, never again.
  expect(loader.locks, "lock states, in order").toEqual(["unlocked", "locked", "unlocked"]);
});

// Every frame of a warm reload at the top, from navigation until the loader
// hands the lockup to the canvas: the fallback h1 never shows while a scene is
// on its way, and the loader's resting lockup ("Hi, I'm" over "Aaron", where
// the canvas will draw them) is on screen instead.
type HeroFrame = { t: number; scene: string | null; gone: boolean; h1: boolean | null; greeting: boolean; name: boolean };

test("loader: a warm reload never shows the fallback heading; the resting lockup holds until the canvas takes it", async ({
  page,
}) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.addInitScript(() => {
    const frames: HeroFrame[] = [];
    (window as unknown as { __heroFrames: HeroFrame[] }).__heroFrames = frames;
    const shows = (el: Element | null) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const sample = () => {
      const hero = document.querySelector<HTMLElement>("section[data-scene]");
      const loader = document.querySelector<HTMLElement>(".coil-loader");
      const gone = !!loader && loader.dataset.state === "gone";
      const h1 = document.getElementById("hero-heading");
      frames.push({
        t: performance.now(),
        scene: hero?.dataset.scene ?? null,
        gone,
        h1: h1 ? shows(h1) : null,
        greeting: shows(document.querySelector(".coil-loader__rest-greet")),
        name: shows(document.querySelector(".coil-loader__rest-name")),
      });
      if (!gone && frames.length < 2000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.reload();
  await waitForCoil(page);

  const frames = await page.evaluate(() => (window as unknown as { __heroFrames: HeroFrame[] }).__heroFrames);
  const pending = frames.filter((f) => f.h1 !== null && !f.gone);
  expect(pending.length, "frames sampled before the hand-off").toBeGreaterThan(2);
  const h1Shown = pending.filter((f) => f.h1);
  expect(h1Shown.length, `frames showing the fallback h1 (first at ${h1Shown[0]?.t.toFixed(0)}ms)`).toBe(0);
  const bare = pending.filter((f) => !f.greeting || !f.name);
  expect(bare.length, `frames without the resting lockup (first at ${bare[0]?.t.toFixed(0)}ms)`).toBe(0);
  // The sampling ran up to the hand-off: the loader left only once the canvas drew.
  const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
  expect(events, "the warm reload took the fast path").toContain("rest");
  expect(frames.at(-1)!.gone, "the loader handed off").toBe(true);
  expect(frames.at(-1)!.scene, "the scene was drawing at the hand-off").toBe("on");
});

// No WebGL (the Chrome setting: the API is there, no context starts): the
// resting lockup is up from the first frames, the h1 never shows under it,
// the still fades in under the lockup at the composite's ink, then the lockup
// fades out over lockupFadeMs onto the name the still bakes behind its cards,
// and the h1 stays visually hidden.
// The init script denies every context; a GPU-less launch cannot be set per
// describe (it forces a new worker), and e2e/no-webgl.spec.ts covers that launch.
test.describe("no WebGL", () => {
  const goneLoader = () => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone";

  // A cached load of the still path, sampled every frame.
  async function warmStillLoad(page: Page) {
    await page.addInitScript(noWebglContext);
    await sampleHero(page);
    await page.goto("/?coildebug=1");
    await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
    await page.reload();
    await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
    return (await heroSamples(page)).filter((s) => s.state !== null);
  }

  // Ink boxes in viewport px, and how much of b a covers.
  type Ink = { x0: number; y0: number; x1: number; y1: number };
  type InkMetrics = { inkW: number; inkL: number; capR: number; base: number };
  const area = (b: Ink) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
  const covers = (a: Ink, b: Ink) =>
    area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) }) / area(b);
  // The resting name's ink box from its drawn text box (line-height 1: its height is its size).
  function restInkBox(r: NonNullable<HeroSample["restBox"]>, m: InkMetrics): Ink {
    const x0 = r.left - m.inkL * r.height;
    const baseline = r.top + m.base * r.height;
    return { x0, y0: baseline - m.capR * r.height, x1: x0 + m.inkW * r.height, y1: baseline };
  }
  // The name the visible still bakes, where it shows: the recorded rects
  // (lib/coil/heroStill.rects.ts) through cover in the still's box, its ink
  // box from the face's metrics the loader measured; the greeting's line.
  async function bakedLockup(page: Page) {
    const at = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>("[data-hero-still]")!;
      const r = box.getBoundingClientRect();
      const img = [...box.querySelectorAll("img")].find((el) => el.getClientRects().length > 0);
      const root = getComputedStyle(document.querySelector(".coil-loader")!);
      const metric = (key: string) => Number(root.getPropertyValue(`--${key}`));
      return { w: box.clientWidth, h: box.clientHeight, x: r.left, y: r.top, src: img?.currentSrc ?? "", m: { inkW: metric("inkW"), inkL: metric("inkL"), capR: metric("capR"), base: metric("base") } };
    });
    const cut = stillCut(at.w / at.h);
    expect(at.src, "the picture shows the cut the box's aspect names").toMatch(new RegExp(`-${cut}\\.`));
    const b = bakedLockupRect(cut, at.w, at.h);
    const baseline = b.baseline + at.y;
    const name: Ink = { x0: b.left + at.x, y0: baseline - at.m.capR * b.fontPx, x1: b.left + at.x + b.width, y1: baseline };
    const g = { left: b.greeting.left + at.x, baseline: b.greeting.baseline + at.y, fontPx: b.greeting.fontPx };
    const greeting: Ink = { x0: g.left - 3, y0: g.baseline - 0.8 * g.fontPx, x1: g.left + 2.8 * g.fontPx, y1: g.baseline + 0.25 * g.fontPx };
    return { name, greeting, m: at.m };
  }
  // Every frame with the still showing under the resting lockup (its fade in
  // and the lockup's fade out): how much of the baked name's ink box the
  // resting name's covers, and of the resting name's the baked one's (the
  // lesser), so a name too large fails as one too small does.
  function coverUnderStill(samples: HeroSample[], baked: Awaited<ReturnType<typeof bakedLockup>>) {
    return samples
      .filter((s) => s.rest && s.state !== "gone" && s.still > 0)
      .map((s) => {
        const ink = restInkBox(s.restBox!, baked.m);
        return { t: s.t, still: s.still, share: Math.min(covers(ink, baked.name), covers(baked.name, ink)) };
      });
  }

  test("loader: a warm load holds the resting lockup and hands it to the hero still", async ({ page }) => {
    const samples = await warmStillLoad(page);
    expect(samples.length, "frames sampled").toBeGreaterThan(2);
    expect(samples.slice(0, 3).every((s) => s.state !== "gone" && s.rest), "the resting lockup in the first frames").toBe(true);
    const goneAt = samples.findIndex((s) => s.state === "gone");
    expect(goneAt, "a frame with the loader gone").toBeGreaterThan(0);
    const h1Shown = samples.filter((s) => s.h1);
    expect(h1Shown.length, `frames showing the h1 (first at ${h1Shown[0]?.t.toFixed(0)}ms)`).toBe(0);
    expect(samples[goneAt].ready, "the still marked decoded by the frame the loader has gone").toBe(true);
    const leaked = samples.filter((s) => s.rest && !s.dissolve && s.state !== "gone" && s.still !== 0);
    expect(leaked.length, "frames with the still showing before the hand-off").toBe(0);
    expect(samples.at(-1)!.state).toBe("gone");
    const lastHeld = samples.filter((s) => s.dissolve && s.state !== "gone" && s.rest).at(-1);
    expect(lastHeld, "a hand-off frame with the lockup up").toBeDefined();
    expect(lastHeld!.still, "the still under the lockup's last frames").toBeGreaterThan(0.5);
    expect(lastHeld!.stillReady, "the still had decoded under the lockup").toBe(true);
    const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
    expect(events).toContain("dissolve");
    expect(events.indexOf("dissolve")).toBeLessThan(events.indexOf("lockup-fade"));
    expect(events.indexOf("lockup-fade")).toBeLessThan(events.indexOf("still-handoff"));
    expect(events, "the pane never armed").not.toContain("100");
    // The box shows the wide cut at its own aspect: the resting lockup is
    // already on the baked name, so there is no landing.
    expect(events, "no landing at the cut's own aspect").not.toContain("still-land");
    const shares = coverUnderStill(samples, await bakedLockup(page));
    expect(spanMs(shares), "frames with the still under the lockup, at least 80ms of them").toBeGreaterThanOrEqual(80);
    expect(Math.min(...shares.map((f) => f.share)), "the resting name over the baked name in every such frame").toBeGreaterThanOrEqual(0.98);
  });

  test("loader: once the still is in, the resting lockup fades out over lockupFadeMs onto the baked name", async ({ page }) => {
    const samples = await warmStillLoad(page);
    const composite = samples[0].restOpacity;
    const frameMs = samples.slice(1).map((s, i) => s.t - samples[i].t).sort((a, b) => a - b)[Math.floor((samples.length - 1) / 2)];
    const stillIn = samples.findIndex((s) => s.state !== "gone" && s.still === 1);
    expect(stillIn, "a frame with the still at 1 under the lockup").toBeGreaterThan(0);
    // Through the still's fade the lockup holds the composite's ink.
    const early = samples.slice(0, stillIn).filter((s) => Math.abs(s.restOpacity - composite) > 1e-3);
    expect(early.map((s) => `${s.t.toFixed(0)}ms ${s.restOpacity.toFixed(3)}`), "frames before the still is in with the lockup off its composite ink").toEqual([]);
    const zeroAt = samples.findIndex((s, i) => i >= stillIn && (s.restOpacity === 0 || s.state === "gone"));
    const fade = samples.slice(stillIn, zeroAt + 1);
    const rises = fade.filter((s, i) => i > 0 && s.restOpacity > fade[i - 1].restOpacity + 1e-4);
    const took = samples[zeroAt].t - samples[stillIn].t;
    test.info().annotations.push({
      type: "resting lockup opacity from the still at 1",
      description: `${fade.map((s) => `${(s.t - samples[stillIn].t).toFixed(0)}ms ${s.restOpacity.toFixed(3)}${s.state === "gone" ? " gone" : ""}`).join(", ")}; frame ${frameMs.toFixed(1)}ms, composite ${composite.toFixed(3)}`,
    });
    expect(rises.map((s) => s.t.toFixed(0)), "frames where the lockup's opacity rose").toEqual([]);
    expect(spanMs(fade.filter((s) => s.restOpacity > 0 && s.restOpacity < composite - 1e-3)), "frames in the middle of the fade, at least 80ms of them").toBeGreaterThanOrEqual(80);
    expect(took, "the lockup reached 0 within lockupFadeMs plus two frames").toBeLessThanOrEqual(LOADER.lockupFadeMs + 2 * frameMs + 1);
    expect(took, "the lockup took about lockupFadeMs to reach 0").toBeGreaterThanOrEqual(LOADER.lockupFadeMs - 2 * frameMs);
    expect(samples[zeroAt].locked, "the scroll lock released by the time the lockup reaches 0").toBe(false);
    expect(samples.slice(stillIn).filter((s) => s.locked).length, "frames locked after the still is in").toBe(0);
    expect(await page.evaluate(() => document.documentElement.dataset.home), "the home ready").toBe("ready");
    // The baked name where the resting lockup's name was.
    const box = await restNameRect(page);
    const spread = luminanceSpread(await shoot(page, box));
    test.info().annotations.push({ type: "baked name spread", description: `${spread.toFixed(1)} over ${box.width}x${box.height} at ${box.x},${box.y}` });
    expect(spread, "the name box's luminance spread with the loader gone").toBeGreaterThan(30);
    await expectHeadingHidden(page);
  });

  // The decode hold of ?coildebug=handoff, released: the pane-less dissolve
  // starts and the still's fade runs.
  async function heldDissolve(page: Page) {
    await page.addInitScript(noWebglContext);
    await page.goto("/?coildebug=1");
    await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
    // handoff: the hand-off waits on __coilLoader.finish() once the still has decoded, then again before the lockup fades out.
    await page.goto("/?coildebug=handoff");
    await page.waitForFunction(() => (window as HookWindow).__coilLoader?.events.some((e) => e.event === "still-held"), null, { timeout: 30_000 });
  }
  const restBox = (page: Page) =>
    page.evaluate(() => {
      const r = document.querySelector(".coil-loader__rest-name")!.getBoundingClientRect();
      return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
    });
  const restInk = (page: Page) => page.locator(".coil-loader__rest").evaluate((el) => Number(getComputedStyle(el).opacity));

  test("loader: the still fades in under the resting lockup at the composite's ink and the name never weakens", async ({ page }) => {
    await heldDissolve(page);
    const box = await restBox(page);
    const composite = await restInk(page);
    const rest = luminanceSpread(await shoot(page, box));
    await page.evaluate(() => (window as HookWindow).__coilLoader!.finish!());
    // The still's fade, held and stepped through.
    await page.waitForFunction(() => document.querySelector("[data-hero-still]")!.getAnimations().length > 0);
    await page.evaluate(() => {
      const fade = document.querySelector("[data-hero-still]")!.getAnimations()[0];
      fade.pause();
      (window as unknown as { __fade: Animation }).__fade = fade;
    });
    const spreads = [`rest ${rest.toFixed(1)}`];
    for (const ms of [0, 100, 200, 300, LOADER.stillFadeMs - 1]) {
      await page.evaluate((t) => ((window as unknown as { __fade: Animation }).__fade.currentTime = t), ms);
      const spread = luminanceSpread(await shoot(page, box));
      spreads.push(`${ms}ms ${spread.toFixed(1)}`);
      expect(spread, `name box spread at ${ms}ms of the fade`).toBeGreaterThanOrEqual(rest - 2);
      expect(await restInk(page), `the lockup's ink at ${ms}ms of the fade`).toBeCloseTo(composite, 5);
    }
    await page.evaluate(() => (window as unknown as { __fade: Animation }).__fade.finish());
    await expect.poll(() => page.locator("[data-hero-still]").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await restInk(page), "the lockup's ink with the still in, held").toBeCloseTo(composite, 5);
    expect(await page.locator(".coil-loader").getAttribute("data-state"), "held: the lockup waits on finish()").not.toBe("gone");
    // The second finish() starts the lockup's fade; the loader goes at its end.
    await page.evaluate(() => (window as HookWindow).__coilLoader!.finish!());
    await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
    const after = luminanceSpread(await shoot(page, box));
    test.info().annotations.push({ type: "name box spread", description: `${spreads.join(", ")}, gone ${after.toFixed(1)}; composite ink ${composite.toFixed(3)}` });
    expect(after, "name box spread after the lockup left, the baked name").toBeGreaterThan(30);
  });
  // A box taller than the wide cut: cover scales the still by height, so the
  // baked name sits larger and elsewhere than the resting lockup's pose.
  test.describe("a hero taller than its still's cut", () => {
    test.use({ viewport: { width: 1440, height: 1200 } });

    test("loader: the resting lockup lands on the baked name before the still fades in, and fades out on it", async ({ page }) => {
      const samples = await warmStillLoad(page);
      const baked = await bakedLockup(page);
      const restInk = restInkBox(samples[0].restBox!, baked.m);
      const atRest = Math.min(covers(restInk, baked.name), covers(baked.name, restInk));
      const leaked = samples.filter((s) => s.rest && !s.dissolve && s.state !== "gone" && s.still !== 0);
      expect(leaked.length, "frames with the still showing before the dissolve").toBe(0);
      const shares = coverUnderStill(samples, baked);
      const stillIn = shares.findIndex((f) => f.still === 1);
      const fade = shares.slice(stillIn);
      test.info().annotations.push({
        type: "baked name covered by the resting name",
        description: `at rest ${atRest.toFixed(3)}; still fading in ${shares.slice(0, stillIn).map((f) => f.share.toFixed(3)).join(" ")}; lockup fading out ${fade.map((f) => f.share.toFixed(3)).join(" ")}`,
      });
      expect(atRest, "the resting pose is off the baked name (the case under test)").toBeLessThan(0.9);
      expect(stillIn, "a frame with the still at 1 under the lockup").toBeGreaterThan(0);
      expect(spanMs(fade), "frames of the lockup's fade, at least 80ms of them").toBeGreaterThanOrEqual(80);
      const off = shares.filter((f) => f.share < 0.95);
      expect(off.map((f) => `${f.t.toFixed(0)}ms ${f.share.toFixed(3)}`), "frames with the still showing and the resting name off the baked one").toEqual([]);
      const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
      expect(events, "the landing ran").toContain("still-land");
      expect(events.indexOf("still-land"), "the landing before the dissolve").toBeLessThan(events.indexOf("dissolve"));
      expect(events.indexOf("dissolve")).toBeLessThan(events.indexOf("lockup-fade"));
      await expectHeadingHidden(page);
    });

    test("loader: halfway through the lockup's fade the name region shows one name", async ({ page }) => {
      await heldDissolve(page);
      const rest = await page.evaluate(() =>
        [".coil-loader__rest-name", ".coil-loader__rest-greet"].map((selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
        }),
      );
      // The first finish(): the landing, then the still's fade under the landed lockup.
      await page.evaluate(() => (window as HookWindow).__coilLoader!.finish!());
      await expect.poll(() => page.locator("[data-hero-still]").evaluate((el) => getComputedStyle(el).opacity), { timeout: 5000 }).toBe("1");
      const baked = await bakedLockup(page);
      // The second finish(): the lockup's fade, held at its middle (a held hand-off arms no backup timer).
      await page.evaluate(() => (window as HookWindow).__coilLoader!.finish!());
      await page.waitForFunction(() => document.querySelector(".coil-loader__rest")!.getAnimations().length > 0);
      await page.evaluate((ms) => {
        const fade = document.querySelector(".coil-loader__rest")!.getAnimations()[0];
        fade.pause();
        fade.currentTime = ms;
        (window as unknown as { __fade: Animation }).__fade = fade;
      }, LOADER.lockupFadeMs / 2);
      const pad = 12;
      const all = [baked.name, baked.greeting, ...rest];
      const vp = page.viewportSize()!;
      const x = Math.max(0, Math.floor(Math.min(...all.map((b) => b.x0)) - pad));
      const y = Math.max(0, Math.floor(Math.min(...all.map((b) => b.y0)) - pad));
      const region = { x, y, width: Math.min(vp.width, Math.ceil(Math.max(...all.map((b) => b.x1)) + pad)) - x, height: Math.min(vp.height, Math.ceil(Math.max(...all.map((b) => b.y1)) + pad)) - y };
      const mid = await shoot(page, region);
      // The same frame with the lockup all but gone: what the lockup adds is the difference.
      await page.evaluate((ms) => ((window as unknown as { __fade: Animation }).__fade.currentTime = ms), LOADER.lockupFadeMs - 0.01);
      const bare = await shoot(page, region);
      expect(await page.locator(".coil-loader").getAttribute("data-state"), "held: the fade paused, the loader still up").not.toBe("gone");
      const lockup = lockupPixels(mid, bare, region, [baked.name, baked.greeting]);
      test.info().annotations.push({
        type: "lockup pixels mid-fade",
        description: `inside the baked boxes ${lockup.inside}, outside ${lockup.outside}, share ${(lockup.outside / Math.max(1, lockup.inside)).toFixed(4)}; region ${region.width}x${region.height} at ${region.x},${region.y}`,
      });
      expect(lockup.inside, "the lockup's pixels on the baked name (it is really there)").toBeGreaterThan(500);
      expect(lockup.outside / lockup.inside, "lockup pixels outside the baked name and greeting, against inside").toBeLessThan(0.01);
      await page.evaluate(() => (window as unknown as { __fade: Animation }).__fade.finish());
      await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
    });
  });
});

// The pixels the lockup adds mid-fade (any channel more than LOCKUP_DELTA
// apart from the same frame with it all but gone; the still under it does
// not move), inside the given ink boxes padded by LOCKUP_EDGE (antialiased
// edges) and outside them. The landed lockup's letters sit on the baked ones,
// so it adds pixels only where cards cover the baked name and at the glyphs'
// edges; a lockup off the baked name adds a second cluster outside.
const LOCKUP_DELTA = 4;
const LOCKUP_EDGE = 3;
function lockupPixels(mid: Image, bare: Image, region: { x: number; y: number }, boxes: { x0: number; y0: number; x1: number; y1: number }[]) {
  let inside = 0;
  let outside = 0;
  for (let py = 0; py < mid.height; py++) {
    for (let px = 0; px < mid.width; px++) {
      const i = (py * mid.width + px) * 4;
      const d = Math.max(Math.abs(mid.rgba[i] - bare.rgba[i]), Math.abs(mid.rgba[i + 1] - bare.rgba[i + 1]), Math.abs(mid.rgba[i + 2] - bare.rgba[i + 2]));
      if (d <= LOCKUP_DELTA) continue;
      const x = region.x + px + 0.5;
      const y = region.y + py + 0.5;
      const near = boxes.some((b) => x >= b.x0 - LOCKUP_EDGE && x <= b.x1 + LOCKUP_EDGE && y >= b.y0 - LOCKUP_EDGE && y <= b.y1 + LOCKUP_EDGE);
      if (near) inside++;
      else outside++;
    }
  }
  return { inside, outside };
}
