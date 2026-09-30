import { LOADER } from "@/lib/loader/progress";
import { test, expect } from "./support/fixtures";
import { waitForCoil } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { cardRegion, pixelDiff, shoot, type Image } from "./support/pixels";

// The loader and the entrance (docs/coil-build-scaffold.md, slice 4): a slow
// load shows the loader with a rising number and lands its name on the
// scene's in one frame; a cached load skips it; the scroll lock over loader
// and entrance releases exactly once.

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
  const name = (await page.evaluate(() => (window as HookWindow).__coil!.api.nameRect()))!;
  const outline = [
    { x: name.left, y: name.gradient.top },
    { x: name.left + name.width, y: name.gradient.top },
    { x: name.left + name.width, y: name.gradient.top + name.gradient.height },
    { x: name.left, y: name.gradient.top + name.gradient.height },
  ];
  const region = cardRegion(outline, page.viewportSize()!, 0);
  const loaderName = await shoot(page, region.box);
  await page.evaluate(() => {
    (window as HookWindow).__coilLoader!.finish!();
  });
  await page.waitForFunction(() => (window as HookWindow).__coilLoader!.events.some((e) => e.event === "handoff"));
  const canvasName = await shoot(page, region.box);

  const diff = pixelDiff(loaderName, canvasName, canvasName, region);
  expect(diff.insideMean, "mean difference inside the name, of 255").toBeLessThan(3);
  // And the name is there on both sides: letters against the field, not an empty field twice.
  expect(luminanceSpread(loaderName), "loader side: luminance spread in the name box").toBeGreaterThan(30);
  expect(luminanceSpread(canvasName), "canvas side: luminance spread in the name box").toBeGreaterThan(30);
});

test("loader: a cached load skips the loader, and the scroll lock releases exactly once", async ({ page }) => {
  await page.goto("/?coildebug=1");
  await waitForCoil(page);

  await page.reload();
  await waitForCoil(page);

  const loader = await page.evaluate(() => {
    const w = window as HookWindow;
    return { events: w.__coilLoader!.events.map((e) => e.event), locks: w.__coilLoader!.locks.map((e) => e.event) };
  });
  expect(loader.events).toContain("skipped");
  expect(loader.events).not.toContain("exit");
  expect(loader.events).not.toContain("fade");
  await expect(page.locator(".coil-loader")).toBeHidden();

  // The first entry is the state when the log started (the lock not yet
  // engaged); after it the lock engages once and releases once, never again.
  expect(loader.locks, "lock states, in order").toEqual(["unlocked", "locked", "unlocked"]);
});
