import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { INTRO_LOADING, openHome, waitForScene } from "./support/coil";
import { noWebgl2Api } from "./support/webgl";
import { siteContent } from "@/lib/content";

// The deal's other paths and its edges (hero rework, slices 4b to 4d): reduced
// motion (no canvas; the ribbon's still row at page 1's foot; Deal me in
// jumps; the switch live both ways), no WebGL (the still stays; the deal fades
// in under the eased scroll), the phone (no blank band between page 1's foot
// and the cards), a deal that ends with the reader inside the sticky range, the
// button's label, and a load that finds the cards in view.

const { teaser } = siteContent.intro;
const html = (page: Page) => page.locator("html");
const dealState = (page: Page) => page.evaluate(() => document.documentElement.dataset.deal);
const entrances = (page: Page) => page.evaluate(() => Number(document.documentElement.dataset.dealEntrances));
const rectOf = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, width: r.width };
  }, selector);
// Deal me in (a real link to the cards that the page upgrades), and Back to my cards in its place.
const teaserButton = (page: Page) => page.locator("[data-intro-cta] a").first();

async function waitForHero(page: Page, scene: "on" | "still") {
  await page.waitForFunction(
    ([want, LOADING]) =>
      document.documentElement.dataset.home === "ready" &&
      document.querySelector("section[data-scene]")?.getAttribute("data-scene") === want &&
      !LOADING.includes(document.documentElement.dataset.introLoader ?? ""),
    [scene, INTRO_LOADING] as const,
    { timeout: 30_000 },
  );
}

async function stillDecoded(page: Page) {
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>("[data-ribbon-still] img")].filter((el) => el.getClientRects().length > 0);
    return imgs.length > 0 && imgs.some((img) => img.complete && img.naturalWidth > 0);
  });
}

// ---------------------------------------------------------------- reduced motion

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("no canvas, the ribbon's still row at page 1's foot, and Deal me in jumps to the dealt cards", async ({ page }) => {
    await page.goto("/?coildebug=1");
    await waitForHero(page, "still");
    await expect(page.locator("#work canvas")).toHaveCount(0);
    // Dealt from the first paint (nothing to play), the invitation not yet spent.
    await expect(html(page)).toHaveAttribute("data-deal", "dealt");
    await expect(page.locator("[data-ribbon-still]")).toBeVisible();
    await stillDecoded(page);
    await expect(teaserButton(page)).toHaveText(new RegExp(teaser.deal));
    await teaserButton(page).click();
    // The jump is instant: the cards section's top is at the top of the screen at once.
    await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 3000 });
    expect(await dealState(page)).toBe("dealt");
    expect(await entrances(page), "no deal played").toBe(0);
    expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
    for (const title of siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles))) {
      await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
    }
    // The still stays in the slot: with no scene it never closes up.
    expect(await page.locator("[data-coil-ribbon]").evaluate((el) => el.hasAttribute("data-gone"))).toBe(false);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(teaserButton(page)).toHaveText(new RegExp(teaser.back));
  });

  test("switched off live, the scene comes back at rest and nothing plays", async ({ page }) => {
    await page.goto("/?coildebug=1");
    await waitForHero(page, "still");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await waitForHero(page, "on");
    await expect(html(page)).toHaveAttribute("data-deal", "dealt");
    expect(await entrances(page)).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __coil: { entrance: () => { ended: boolean } } }).__coil.entrance().ended)).toBe(true);
  });
});

// Reduced motion switched on in the middle of the deal: dealt at once, both halves
// of it (the scene's clock and the page's), nothing left half done.
test("reduced motion switched on mid-deal lands dealt with no orphan state, and off again plays nothing", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await teaserButton(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
  await page.waitForTimeout(900);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 2000 });
  const left = await page.evaluate(() => ({
    scrollBehavior: document.documentElement.style.scrollBehavior,
    titleStyle: document.querySelector("#work [data-deal-title]")!.getAttribute("style"),
    teaserStyle: document.querySelector("[data-intro-cta]")!.getAttribute("style"),
    lead: getComputedStyle(document.getElementById("work")!).getPropertyValue("--run-lead"),
    scene: document.querySelector("section[data-scene]")!.getAttribute("data-scene"),
  }));
  expect(left.scrollBehavior).toBe("");
  expect(left.titleStyle ?? "").toBe("");
  expect(left.teaserStyle ?? "").toBe("");
  expect(left.lead).toBe("0px");
  expect(left.scene).toBe("still");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await waitForHero(page, "on");
  expect(await entrances(page), "one deal in the whole load").toBe(1);
  expect(await dealState(page)).toBe("dealt");
});

// ---------------------------------------------------------------- no WebGL

test.describe("no WebGL", () => {
  test("the ribbon's still row stays, and the deal fades the cards in under the eased scroll", async ({ page }) => {
    await page.addInitScript(noWebgl2Api);
    await page.goto("/?coildebug=1");
    await waitForHero(page, "still");
    await expect(html(page)).toHaveAttribute("data-deal", "closed");
    await expect(page.locator("[data-ribbon-still]")).toBeVisible();
    await stillDecoded(page);
    const startY = await page.evaluate(() => window.scrollY);
    await teaserButton(page).click();
    await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
    // The stage cross-fades in (it starts clear), and the page scrolls itself on an ease: it is still short of the section partway.
    expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector("#work [data-coil-stage]")!).opacity))).toBeLessThan(1);
    await page.waitForTimeout(900);
    const mid = await page.evaluate(() => ({ y: window.scrollY, top: document.getElementById("work")!.getBoundingClientRect().top, behavior: document.documentElement.style.scrollBehavior }));
    expect(mid.y).toBeGreaterThan(startY);
    expect(mid.top).toBeGreaterThan(5);
    expect(mid.behavior).toBe("auto");
    await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 10_000 });
    expect(await rectOf(page, "#work")).toMatchObject({ top: expect.closeTo(0, 0) });
    expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector("#work [data-coil-stage]")!).opacity))).toBe(1);
    expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
    expect(await entrances(page)).toBe(1);
  });
});

// ---------------------------------------------------------------- the button's label

test("the label stays Deal me in until the deal is over, then reads Back to my cards", async ({ page }) => {
  await openHome(page, { at: "foot" });
  const label = () => teaserButton(page).evaluate((el) => el.firstChild?.textContent ?? "");
  expect(await label()).toBe(teaser.deal);
  await teaserButton(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
  // While the button fades out and the deal plays, it still reads Deal me in.
  for (const wait of [0, 300, 500, 500]) {
    await page.waitForTimeout(wait);
    if ((await dealState(page)) !== "dealing") break;
    expect(await label()).toBe(teaser.deal);
  }
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 15_000 });
  await expect.poll(label).toBe(teaser.back);
  expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector("[data-intro-cta]")!).opacity))).toBe(1);
});

// ---------------------------------------------------------------- a load that finds the cards in view

test("a load into #work opens the cards at once: dealt, the field and the columns there, no deal played", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __dealLog: string[] };
    w.__dealLog = [];
    new MutationObserver(() => {
      const value = document.documentElement.dataset.deal ?? "";
      if (w.__dealLog[w.__dealLog.length - 1] !== value) w.__dealLog.push(value);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-deal"] });
  });
  await page.goto("/?coildebug=1#work");
  await page.waitForFunction(() => document.documentElement.dataset.home === "ready" && document.documentElement.dataset.deal === "dealt");
  // Not a blank section waiting for the scene: the field's poster or the scene and the columns, at once.
  const first = await page.evaluate(() => ({
    titles: Number(getComputedStyle(document.querySelector("#work [data-deal-title]")!).opacity),
    poster: Number(getComputedStyle(document.querySelector("#work [data-coil-poster]")!).opacity),
    pointer: getComputedStyle(document.querySelector("#work [data-coil-stage]")!).pointerEvents,
  }));
  expect(first.titles).toBe(1);
  expect(first.poster).toBe(1);
  expect(first.pointer).toBe("auto");
  expect(await entrances(page)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __dealLog: string[] }).__dealLog)).toEqual(["pending", "dealt"]);
  await waitForScene(page);
  expect(await entrances(page)).toBe(0);
});

// ---------------------------------------------------------------- a deal that ends inside the sticky range

test("a deal that ends with the reader inside the sticky range lets the stage go: it never covers page 1", async ({ page }) => {
  await openHome(page, { at: "foot" });
  // Scroll by hand to just past where the deal triggers (18 percent of the range), then stop.
  const range = await page.evaluate(() => {
    const rail = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
    return { railDoc: rail.top + window.scrollY, size: rail.height - stage.height };
  });
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), range.railDoc + range.size * 0.3);
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
  // Pinned over page 1 while it plays.
  expect(Math.abs((await rectOf(page, "[data-coil-sticky]")).top)).toBeLessThan(2);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 15_000 });
  // Dealt: the lead is let go and the stage glides down to the section, where it stays.
  await page.waitForFunction(() => Math.abs(document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().top - document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 3000 });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("work")!).getPropertyValue("--run-lead"))).toBe("0px");
  // The glide clears its transform when it lands.
  await page.waitForFunction(() => !(document.querySelector("[data-coil-sticky]")!.getAttribute("style") ?? "").includes("transform"), null, { timeout: 3000 });
  // Page 1's button is not under the stage, and it answers a click.
  const button = await rectOf(page, "[data-intro-cta] a");
  const stage = await rectOf(page, "[data-coil-sticky]");
  expect(button.bottom <= stage.top + 1 || button.top >= stage.bottom, "the button is clear of the stage").toBe(true);
  await page.evaluate(() => document.querySelector("[data-intro-cta]")!.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(300);
  const hit = await page.evaluate(() => {
    const b = document.querySelector("[data-intro-cta] a")!.getBoundingClientRect();
    return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest("a")?.textContent ?? null;
  });
  expect(hit).toContain(teaser.back);
});

// ---------------------------------------------------------------- the phone

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  test("page 1's foot meets the dealt cards with no blank band, and the slot closes only once it is above the reader", async ({ page }) => {
    await openHome(page, { at: "foot" });
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-input", "coarse");
    const slotBefore = await rectOf(page, "[data-coil-ribbon]");
    expect(slotBefore.height).toBeGreaterThan(100);
    await teaserButton(page).click();
    await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
    // The slot is above the reader (the click scrolled to the section): it closes up and the page is held, the section still at the top.
    await page.waitForFunction(() => document.querySelector("[data-coil-ribbon]")!.hasAttribute("data-gone"), null, { timeout: 5000 });
    expect(Math.abs((await rectOf(page, "#work")).top)).toBeLessThan(2);
    // Scrolled back up: page 1 ends where the cards begin, no empty screen between them.
    await page.evaluate(() => window.scrollTo({ top: document.getElementById("work")!.getBoundingClientRect().top + window.scrollY - 500, behavior: "instant" }));
    await page.waitForTimeout(300);
    const first = await rectOf(page, "#about");
    const work = await rectOf(page, "#work");
    expect(work.top - first.bottom, "the gap between page 1 and the cards").toBeLessThan(2);
    expect(await rectOf(page, "[data-coil-ribbon]")).toMatchObject({ height: 0 });
    // Page 1's last line is on the same screen as the first cards.
    expect(work.top).toBeLessThan(844);
    expect(first.bottom).toBeGreaterThan(0);
  });

  test("the canvas keeps one size through the deal (the toolbar cannot resize it), and a drag does nothing before it is dealt", async ({ page }) => {
    await openHome(page, { at: "foot" });
    const size = () => page.evaluate(() => { const r = document.querySelector("#work canvas")!.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
    const before = await size();
    const offsetBefore = await page.evaluate(() => (window as unknown as { __coil: { offset: () => number } }).__coil.offset());
    // A horizontal drag over the ribbon before the deal: touch drag is off until dealt.
    const slot = await rectOf(page, "[data-coil-ribbon]");
    const cdp = await page.context().newCDPSession(page);
    const y = slot.top + slot.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 60, y }] });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 60 + i * 40, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as unknown as { __coil: { drag: () => { dragging: boolean } } }).__coil.drag().dragging)).toBe(false);
    const turned = (await page.evaluate(() => (window as unknown as { __coil: { offset: () => number } }).__coil.offset())) - offsetBefore;
    // Only the ribbon's own slow drift (about 0.13 card a second) in the 0.3 s or so that passed.
    expect(Math.abs(turned)).toBeLessThan(1.2);
    await teaserButton(page).click();
    const seen = new Set<string>();
    const until = Date.now() + 5000;
    while (Date.now() < until && (await dealState(page)) !== "dealt") {
      seen.add(await size());
      await page.waitForTimeout(100);
    }
    seen.add(await size());
    expect([...seen], "the canvas's size through the deal").toEqual([before]);
  });
});
