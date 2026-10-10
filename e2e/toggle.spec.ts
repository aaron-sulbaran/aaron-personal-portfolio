import type { Page } from "@playwright/test";
import { siteContent, strandCards } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import { test, expect } from "./support/fixtures";
import { coilPoints, nextFrames, openHome } from "./support/coil";
import { settled } from "./support/fallback";
import type { HookWindow } from "./support/hooks";
import { decodePng, type Image } from "./support/pixels";
import { noWebgl2Api } from "./support/webgl";
// The Coil and Band toggle (lab log, "Controls lab"): a capsule at the
// hero's bottom left that pulls the coil into the entrance's band and back,
// shown only while a scene runs and the entrance has rested.
const labels = siteContent.hero.shapeToggle;
const toggle = (page: Page) => page.getByRole("group", { name: labels.ariaLabel });
const half = (page: Page, name: string) => toggle(page).getByRole("button", { name, exact: true });
const shape = (page: Page) => page.evaluate(() => (window as HookWindow).__coil!.shape());
const cardCount = async (page: Page) => Number((await page.evaluate(() => (window as HookWindow).__coil!.budget())).cards);
async function waitForPull(page: Page, pull: 0 | 1) {
  await page.waitForFunction((p) => (window as HookWindow).__coil!.shape().pull === p, pull, { timeout: 5_000 });
  await nextFrames(page, 2);
}
test("toggle: hidden through the loader and the entrance, then shown with Coil pressed", async ({ page }) => {
  await page.addInitScript(() => {
    const seen: boolean[] = ((window as unknown as { __toggleSeen: boolean[] }).__toggleSeen = []);
    const tick = () => {
      const el = document.querySelector("[data-shape-toggle]");
      if (document.documentElement.dataset.home !== "ready") seen.push(!!el && el.checkVisibility({ visibilityProperty: true }));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openHome(page);
  const before = await page.evaluate(() => (window as unknown as { __toggleSeen: boolean[] }).__toggleSeen);
  expect(before.length, "frames sampled before ready").toBeGreaterThan(0);
  expect(before.filter(Boolean), "frames showing the toggle before ready").toEqual([]);
  await expect(toggle(page)).toBeVisible();
  await expect(half(page, labels.coil)).toHaveAttribute("aria-pressed", "true");
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "false");
  expect(await shape(page)).toMatchObject({ target: "coil", pull: 1 });
});
test("toggle: Band pulls the coil into the entrance's band over the pull, Coil winds it back", async ({ page }) => {
  await openHome(page);
  const cards = await cardCount(page);
  await page.evaluate(() => {
    const w = window as HookWindow & { __held?: number[] };
    const held: number[] = (w.__held = []);
    const tick = () => {
      const now = w.__coil!.shape();
      if (now.progress > 0 && now.progress < 1) held.push(w.__coil!.offset());
      if (now.pull !== 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const startedAt = await page.evaluate(() => performance.now());
  await half(page, labels.band).click();
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(() => (window as HookWindow).__coil!.shape().pull === 0, null, { timeout: 5_000 });
  const tookMs = (await page.evaluate(() => performance.now())) - startedAt;
  expect(tookMs, "the switch animates over the pull").toBeGreaterThan(COIL.toggle.durationMs * 0.8);
  await nextFrames(page, 2);
  const band = await shape(page);
  expect(band.angStep).toBeCloseTo(band.bandAngStep, 9);
  expect(band.shown, "one copy of each card").toBe(cards);
  const held = await page.evaluate(() => (window as unknown as { __held: number[] }).__held);
  expect(held.length, "frames sampled mid-switch").toBeGreaterThan(10);
  expect(new Set(held).size, "the strand holds through the switch").toBe(1);
  await half(page, labels.coil).click();
  await waitForPull(page, 1);
  const coil = await shape(page);
  expect(coil.angStep).toBe(coil.restAngStep);
  expect(coil.shown).toBeGreaterThan(cards);
});
// A held book row's card at the front of the band: its drawn copy within a
// facing step of the strand's center, and the card picked at its center.
async function expectRowAtBandFront(page: Page, key: string) {
  const at = await page.evaluate((k) => {
    const w = window as HookWindow;
    const slot = w.__coil!.api.slotOfKey(k);
    const info = slot >= 0 ? w.__coilFlight!.scene.slot(slot) : null;
    return info && { u: info.u, alpha: info.alpha, picked: w.__coil!.api.cardAt(info.center.x, info.center.y)?.key ?? null };
  }, key);
  expect(at, `${key} is drawn in the band`).not.toBeNull();
  expect(Math.abs(at!.u), `${key} sits at the band's front`).toBeLessThanOrEqual(1.01);
  expect(at!.picked, `${key} is the card at its own center`).toBe(key);
}
test("toggle: a held book row keeps its card at the front across a switch", async ({ page }) => {
  await openHome(page, { debug: "flight" });
  const focus = (key: string) => page.evaluate((k) => (window as HookWindow).__coil!.api.focusCard(k), key);
  const toCoil = async () => {
    await half(page, labels.coil).click();
    await waitForPull(page, 1);
    await page.waitForTimeout(800);
  };
  // (a) Held on the coil at rest, then the band: the landing aims the row's card again.
  const first = strandCards[2].key;
  await focus(first);
  await page.waitForTimeout(800);
  await half(page, labels.band).click();
  await waitForPull(page, 0);
  await page.waitForTimeout(800);
  await expectRowAtBandFront(page, first);
  // The same with the row's glide still under way at the press: the switch
  // holds the strand where the glide had got to, and the landing finishes the aim.
  await toCoil();
  const across = strandCards[(2 + strandCards.length / 2) % strandCards.length].key;
  const gliding = await page.evaluate((k) => {
    const w = window as HookWindow;
    w.__coil!.api.focusCard(k);
    document.querySelector<HTMLButtonElement>('[data-shape-toggle] [data-seg="band"]')!.click();
    return w.__coilFlight!.scene.state().glide;
  }, across);
  expect(gliding, "the row's glide is under way at the press").toBe(true);
  await waitForPull(page, 0);
  await page.waitForTimeout(800);
  await expectRowAtBandFront(page, across);
  // (b) A row focused mid-switch: its glide waits for the landing.
  await toCoil();
  const second = strandCards[7].key;
  await half(page, labels.band).click();
  const focusedAt = await page.evaluate(
    (k) =>
      new Promise<number>((resolve) => {
        const w = window as HookWindow;
        const tick = () => {
          const { progress } = w.__coil!.shape();
          if (progress > 0 && progress < 1) {
            w.__coil!.api.focusCard(k);
            resolve(progress);
          } else requestAnimationFrame(tick);
        };
        tick();
      }),
    second,
  );
  expect(focusedAt, "focused mid-switch").toBeGreaterThan(0);
  expect(focusedAt, "focused mid-switch").toBeLessThan(1);
  await waitForPull(page, 0);
  await page.waitForTimeout(800);
  await expectRowAtBandFront(page, second);
});
test("toggle: the keyboard reaches each half and Space or Enter picks it", async ({ page }) => {
  await openHome(page);
  await half(page, labels.coil).focus();
  await page.keyboard.press("Tab");
  await expect(half(page, labels.band)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(half(page, labels.band)).toHaveAttribute("aria-pressed", "true");
  await waitForPull(page, 0);
  await page.keyboard.press("Shift+Tab");
  await expect(half(page, labels.coil)).toBeFocused();
  await page.keyboard.press("Enter");
  await waitForPull(page, 1);
});
test("toggle: cross-fades its seat to the unwound list's Coil control, and comes back in the band", async ({ page }) => {
  await openHome(page);
  await half(page, labels.band).click();
  await waitForPull(page, 0);
  await page.evaluate(() => {
    const seat: number[][] = ((window as unknown as { __seat: number[][] }).__seat = []);
    const op = (sel: string) => Number(getComputedStyle(document.querySelector(sel)!).opacity);
    const tick = () => {
      seat.push([op("[data-shape-toggle]"), op("section[data-scene] button.fx")]);
      if (seat.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(() => (window as HookWindow).__coil!.api.unwind(true));
  await page.waitForFunction(() => (window as HookWindow).__coil!.unwindState().progress === 1, null, { timeout: 5_000 });
  await expect(toggle(page)).toBeHidden();
  const seat = await page.evaluate(() => (window as unknown as { __seat: number[][] }).__seat);
  expect(seat.filter(([a, b]) => Math.abs(a + b - 1) > 0.01), "one cross-fade, the seat never empty").toEqual([]);
  // The wind-back: the toggle stays held until the latch lets go: shown and
  // hit-testable, its halves aria-disabled and dead, so a press mid-hold
  // changes nothing and never falls through to a card under it.
  const isHeld = () =>
    page.evaluate(() => {
      const segs = [...document.querySelectorAll("[data-shape-toggle] [data-seg]")];
      return segs.length === 2 && segs.every((seg) => seg.getAttribute("aria-disabled") === "true");
    });
  await page.evaluate(() => {
    const w = window as HookWindow & { __back?: [boolean, boolean][]; __press?: { latched: boolean; onToggle: boolean } };
    const back: [boolean, boolean][] = (w.__back = []);
    const tick = () => {
      const { latched } = w.__coil!.unwindState();
      const segs = [...document.querySelectorAll("[data-shape-toggle] [data-seg]")];
      back.push([latched, segs.length === 2 && segs.every((seg) => seg.getAttribute("aria-disabled") === "true")]);
      if (latched) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const onClick = (event: MouseEvent) => {
      w.__press = { latched: w.__coil!.unwindState().latched, onToggle: !!(event.target as Element).closest("[data-shape-toggle]") };
    };
    document.addEventListener("click", onClick, { capture: true, once: true });
  });
  const coilHalf = await page.evaluate(() => {
    const r = document.querySelector('[data-shape-toggle] [data-seg="coil"]')!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.evaluate(() => (window as HookWindow).__coil!.api.unwind(false));
  await nextFrames(page, 2); // the list's Coil control leaves the seat on the next frame
  await page.mouse.click(coilHalf.x, coilHalf.y);
  const press = await page.evaluate(() => (window as unknown as { __press?: { latched: boolean; onToggle: boolean } }).__press);
  expect(press, "the press lands on the toggle while the strand is latched").toEqual({ latched: true, onToggle: true });
  await page.waitForFunction(() => !(window as HookWindow).__coil!.unwindState().latched, null, { timeout: 5_000 });
  await nextFrames(page, 2);
  const back = await page.evaluate(() => (window as unknown as { __back: [boolean, boolean][] }).__back);
  const latchedFrames = back.filter(([latched]) => latched);
  expect(latchedFrames.length, "frames sampled while latched").toBeGreaterThan(10);
  expect(latchedFrames.filter(([, held]) => !held), "the toggle is held while the strand is latched").toEqual([]);
  expect(await isHeld(), "held no longer").toBe(false);
  expect(await page.evaluate(() => document.querySelector("[data-shape-toggle]")!.closest("[inert]") !== null)).toBe(false);
  await expect(half(page, labels.band), "the press mid-hold changed nothing").toHaveAttribute("aria-pressed", "true");
  expect((await shape(page)).target).toBe("band");
  await expect(page.getByRole("dialog"), "no card opened under the toggle").toHaveCount(0);
  await expect(toggle(page)).toBeVisible();
  expect(await shape(page)).toMatchObject({ pull: 0, shown: await cardCount(page) });
});
test("toggle: on a phone-width pane the first-visit line clears it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const overlap = await page.evaluate((text) => {
    const line = document.querySelector<HTMLElement>("[data-hint-line]")!;
    line.textContent = text;
    const a = line.getBoundingClientRect();
    const b = document.querySelector("[data-shape-toggle]")!.getBoundingClientRect();
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }, siteContent.hero.hints.tapCard);
  expect(overlap).toBe(0);
});
// The overlay (and the toggle in it) is always rendered; without a scene the
// toggle is inert and invisible on its own (and the overlay's root hides it
// too), so it is neither seen nor reachable.
async function expectNoToggle(page: Page) {
  await page.goto("/");
  await settled(page);
  await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
  const el = page.locator("[data-shape-toggle]");
  await expect(el).toHaveCount(1);
  await expect(el, "the toggle itself is inert").toHaveAttribute("inert", "");
  await expect(el).toBeHidden();
  await expect(toggle(page)).toBeHidden();
}
test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("toggle: no scene, no toggle", async ({ page }) => expectNoToggle(page));
});
test("toggle: the still fallback (no WebGL 2) has no toggle", async ({ page }) => {
  await page.addInitScript(noWebgl2Api);
  await expectNoToggle(page);
});
function maxChannelDelta(a: Image, b: Image) {
  let max = 0;
  for (let i = 0; i < a.rgba.length; i++) if ((i & 3) !== 3) max = Math.max(max, Math.abs(a.rgba[i] - b.rgba[i]));
  return max;
}
function differingPixels(a: Image, b: Image, threshold = 24) {
  let count = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    const d = Math.abs(a.rgba[i] - b.rgba[i]) + Math.abs(a.rgba[i + 1] - b.rgba[i + 1]) + Math.abs(a.rgba[i + 2] - b.rgba[i + 2]);
    if (d > threshold) count++;
  }
  return count;
}
test("toggle: a card flown from the band lands back in the band", async ({ page }) => {
  // ?coildebug=still pins the conveyor: the idle drift (about 0.09 cards a
  // second) would otherwise move every card some 4px in the time the scene
  // runs around the flight, on the coil as in the band.
  await openHome(page, { debug: "still" });
  const cards = await cardCount(page);
  await half(page, labels.band).click();
  await waitForPull(page, 0);
  const { card } = await coilPoints(page);
  await page.mouse.move(card.x - 20, card.y + 10);
  await page.mouse.move(card.x, card.y);
  await page.waitForFunction(() => (window as HookWindow).__coil!.hovered() >= 0);
  await page.waitForTimeout(800); // the hover lift settles (6.5/s), so the landing carries the same lift
  const slot = (await page.evaluate(({ x, y }) => (window as HookWindow).__coil!.api.cardAt(x, y), card))!.slot;
  const quadBefore = (await page.evaluate((s) => (window as HookWindow).__coil!.api.quadOf(s), slot))!;
  await page.mouse.click(card.x, card.y);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(700); // the flight out (520ms) before the close, as a visitor looks
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  await nextFrames(page, 3);
  const landed = await shape(page);
  expect(landed).toMatchObject({ pull: 0, shown: cards });
  expect(landed.angStep).toBeCloseTo(landed.bandAngStep, 9);
  const quadAfter = (await page.evaluate((s) => (window as HookWindow).__coil!.api.quadOf(s), slot))!;
  for (let i = 0; i < 4; i++) expect(Math.hypot(quadAfter[i].x - quadBefore[i].x, quadAfter[i].y - quadBefore[i].y)).toBeLessThan(4);
});
test("toggle: a round trip to the band leaves the hero's still frame as it was", async ({ page }) => {
  // ?coildebug=still holds the field, the name surface's clock and the conveyor,
  // so the frame repeats; the keyboard drives the toggle so no pointer stirs
  // the name; the toggle and the cursor are masked.
  await openHome(page, { debug: "still" });
  const canvas = page.locator("section[data-scene] canvas");
  const mask = [page.locator("[data-shape-toggle]"), page.locator(".z-\\[100\\]")];
  // The frame repeats only once the loader has gone (its resting lockup sits
  // over the canvas until then) and the name's surface has grown over the
  // loader's solid name (scene/name.ts, uSurfIn): both run in real time after
  // the hand-off, still mode or not.
  await page.waitForFunction(
    () => {
      const loader = document.querySelector<HTMLElement>(".coil-loader");
      return (!loader || loader.dataset.state === "gone") && (window as HookWindow).__coil!.nameFx().surfIn === 1;
    },
    null,
    { timeout: 5_000 },
  );
  await nextFrames(page, 3);
  const before = decodePng(await canvas.screenshot({ mask }));
  await half(page, labels.band).focus();
  await page.keyboard.press("Space");
  await waitForPull(page, 0);
  const band = decodePng(await canvas.screenshot({ mask }));
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Space");
  await waitForPull(page, 1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await nextFrames(page, 3);
  const after = decodePng(await canvas.screenshot({ mask }));
  expect(differingPixels(before, band), "the band draws a different frame").toBeGreaterThan(1000);
  expect(maxChannelDelta(before, after), "the coil after a round trip").toBeLessThanOrEqual(2);
});
