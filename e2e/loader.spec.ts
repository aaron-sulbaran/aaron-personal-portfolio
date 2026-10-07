import type { Page } from "@playwright/test";
import { LOADER } from "@/lib/loader/progress";
import { test, expect } from "./support/fixtures";
import { waitForCoil } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { cardRegion, pixelDiff, shoot, type Image } from "./support/pixels";

// The loader and the entrance (docs/coil-build-scaffold.md, slice 4): a slow
// load shows the loader with a rising number and lands its lockup ("Hi, I'm"
// over "Aaron") on the scene's in one frame; a cached load never shows the
// pane, only the resting lockup, which the canvas takes over in one frame;
// the fallback h1 never shows while a scene is on its way; the scroll lock
// over loader and entrance releases exactly once.

// The spread between the name box's darker and lighter pixels (5th to 95th
// percentile of luminance, of 255).
function luminanceSpread(image: Image) {
  const values: number[] = [];
  for (let i = 0; i < image.rgba.length; i += 4) {
    values.push(0.2126 * image.rgba[i] + 0.7152 * image.rgba[i + 1] + 0.0722 * image.rgba[i + 2]);
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.95)] - values[Math.floor(values.length * 0.05)];
}

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
// over the book.
type RestFrame = { t: number; y: number; state: string | null; floating: { cls: string; top: number }[] };

test("loader: the resting lockup stays with the hero when the page moves before the scene takes it", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.addInitScript(
    ({ scrollAt, scrollTo }) => {
      const frames: RestFrame[] = [];
      (window as unknown as { __restFrames: RestFrame[] }).__restFrames = frames;
      const underFixed = (el: Element) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (getComputedStyle(node).position === "fixed") return true;
        }
        return false;
      };
      const floating = () => {
        const found: RestFrame["floating"] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          const el = text.parentElement;
          if (!el || !(text.textContent ?? "").trimStart().startsWith("Hi, I'm")) continue;
          if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
          const r = el.getBoundingClientRect();
          const onScreen = r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
          if (onScreen && underFixed(el)) found.push({ cls: el.className, top: Math.round(r.top) });
        }
        return found;
      };
      let jumped = false;
      const sample = () => {
        const now = performance.now();
        if (!jumped && now >= scrollAt && document.body) {
          jumped = true;
          window.scrollTo({ top: scrollTo, behavior: "instant" });
        }
        const state = document.querySelector<HTMLElement>(".coil-loader")?.dataset.state ?? null;
        if (jumped) frames.push({ t: now, y: Math.round(window.scrollY), state, floating: floating() });
        if (state !== "gone" && frames.length < 3000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { scrollAt: 300, scrollTo: 1800 },
  );
  await page.goto("/?coildebug=slowscene=1500");
  // The scene idles off screen, so the wait is on the loader, not the hero.
  await page.waitForFunction(() => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone", null, {
    timeout: 30_000,
  });

  const frames = await page.evaluate(() => (window as unknown as { __restFrames: RestFrame[] }).__restFrames);
  const held = frames.filter((f) => f.state === "rest" && f.y > 1000);
  expect(held.length, "frames of the resting hold with the page moved down").toBeGreaterThan(2);
  const floating = frames.filter((f) => f.state !== "gone" && f.floating.length > 0);
  const first = floating[0];
  expect(
    floating.length,
    first ? `frames with a fixed "Hi, I'm" on screen (first at ${first.t.toFixed(0)}ms, y ${first.y}: ${JSON.stringify(first.floating)})` : "",
  ).toBe(0);

  // The hand-off still happened, from the resting hold, once the scene could take it.
  const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
  expect(events).toContain("rest");
  expect(events).toContain("handoff");
  expect(events).not.toContain("handoff-gave-up");
  expect(events).not.toContain("100");
  await expect(page.locator(".coil-loader")).toBeHidden();
  expect(frames.at(-1)!.state, "the loader handed off").toBe("gone");
  // Back at the top, the hero is whole: the scene drew the name it took.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await waitForCoil(page);
});

// The same hold, and the visitor goes down and comes back before the scene
// takes the lockup: away, the resting lockup moved with the hero; back at
// the top, it is the canvas lockup again, pixel for pixel, at the hand-off.
test("loader: a page moved and brought back during the resting hold still hands off pixel for pixel", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);
  await page.goto("/?coildebug=slowscene=1500,handoff,at=3");
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
  // Past the slow scene's hold, so the finish lands the hand-off in its own task.
  await page.waitForFunction(() => performance.now() > 1600);
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
