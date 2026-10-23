import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToFoot, waitForScene } from "./support/coil";
import { siteContent } from "@/lib/content";

// The deal (hero rework, slices 2, 4a, 4c and 4d): the cards section is closed
// until the reader deals, by the button or by scrolling, once per page load; then
// the ribbon at page 1's foot rushes in toward the button and curls into the
// wheel, which spins up, the page scrolls itself to the cards (a click only), the
// wheel flattens into the band and unfurls into the Coil, the field opens from
// under it and the columns arrive last, all on one clock. The Coil is the
// reader's the moment it unfurls, before the columns are in.
// <html data-deal> says where it is (closed, dealing, unfurled, dealt) and,
// behind ?coildebug, data-deal-entrances counts how many times it played.

const { teaser } = siteContent.intro;
const titles = siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles));
// Deal me in is a real link to the cards that the page upgrades.
const dealLink = (page: Page) => page.getByRole("link", { name: teaser.deal });
const DEAL_VALUES = ["pending", "closed", "dealing", "unfurled", "dealt"];
const backLink = (page: Page) => page.getByRole("link", { name: teaser.back });
const html = (page: Page) => page.locator("html");
const deal = (page: Page) => page.evaluate(() => document.documentElement.dataset.deal);
const entrances = (page: Page) => page.evaluate(() => Number(document.documentElement.dataset.dealEntrances));
const opacityOf = (page: Page, selector: string) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)!).opacity), selector);
const pointerEventsOf = (page: Page, selector: string) => page.evaluate((s) => getComputedStyle(document.querySelector(s)!).pointerEvents, selector);
const rectOf = (page: Page, selector: string) => page.evaluate((s) => { const r = document.querySelector(s)!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; }, selector);

// Every value the deal attribute takes, in order, from before the page's own scripts run.
async function logDeal(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __dealLog: string[] };
    w.__dealLog = [];
    new MutationObserver(() => {
      const value = document.documentElement.dataset.deal ?? "";
      if (w.__dealLog[w.__dealLog.length - 1] !== value) w.__dealLog.push(value);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-deal"] });
  });
}
const dealLog = (page: Page) => page.evaluate(() => (window as unknown as { __dealLog: string[] }).__dealLog);

async function scrollDownByHand(page: Page, until: () => Promise<boolean>, steps = 40) {
  await page.mouse.move(720, 450);
  for (let i = 0; i < steps && !(await until()); i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(60);
  }
}

test("deal: the cards section starts closed under page 1, and nothing in it answers a pointer", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await expect(html(page)).toHaveAttribute("data-deal", "closed");
  expect(await entrances(page)).toBe(0);
  // The stage draws page 1's ribbon: nothing in it takes a pointer, and the cards section's poster waits.
  expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("none");
  expect(await opacityOf(page, "#work [data-coil-poster]")).toBe(0);
  expect(await opacityOf(page, '#work [data-deal-title]')).toBe(0);
  expect(await opacityOf(page, "#work [data-deal-label]")).toBe(0);
  await expect(dealLink(page)).toBeVisible();
  await expect(page.locator("[data-coil-ribbon]")).toBeVisible();
});

test("deal: the button plays one clock, the page scrolls itself to the cards inside it, and the columns are in after", async ({ page }) => {
  await logDeal(page);
  await openHome(page, { at: "foot" });
  await dealLink(page).click();
  // The deal starts at the click, with the page still on its foot: the ribbon rushes in first, the scroll joins after the condense.
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
  expect((await rectOf(page, "#work")).top).toBeGreaterThan(100);
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
  expect(await dealLog(page)).toEqual(DEAL_VALUES);
  expect(await page.evaluate(() => (window as unknown as { __coil: { entrance: () => { ended: boolean } } }).__coil.entrance().ended)).toBe(true);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
  expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
  // A label rests at its own 80 percent (opacity-80 in CardColumns), nothing the deal left behind.
  expect(await opacityOf(page, "#work [data-deal-label]")).toBeCloseTo(0.8, 5);
  // Dealt: the stage takes pointers, the button is back for the "Back to my cards" state, and the root's smooth scroll is put back.
  expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("auto");
  expect(await opacityOf(page, "[data-intro-cta]")).toBe(1);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
  await expect(page.locator("#work h2")).toHaveText(["Work", "Builds"]);
});

test("deal: the Coil's canvas is a sticky stage whose rail starts above the ribbon at page 1's foot and lets go where the cards section ends", async ({ page }) => {
  await openHome(page, { at: "foot" });
  const work = await rectOf(page, "#work");
  const rail = await page.evaluate(() => {
    const r = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const slot = document.querySelector("[data-coil-ribbon]")!.getBoundingClientRect();
    return { top: r.top, height: r.height, slotMiddle: slot.top + slot.height / 2, stage: document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().height, frame: document.querySelector("[data-coil-frame]")!.getBoundingClientRect().height };
  });
  // The rail starts above the ribbon's middle (room for the wheel above it) and ends with the cards section; the stage is the section's frame tall.
  expect(rail.top).toBeLessThan(rail.slotMiddle - 100);
  expect(rail.top).toBeLessThan(work.top);
  expect(Math.abs(rail.top + rail.height - work.bottom)).toBeLessThan(2);
  expect(Math.abs(rail.stage - rail.frame)).toBeLessThan(2);
  const stageTop = () => page.evaluate(() => document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().top);
  // Before it sticks it rides the page with the ribbon.
  expect(Math.abs((await stageTop()) - rail.top)).toBeLessThan(2);
  const sectionDoc = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top + window.scrollY);
  // Inside the range it stays at the top of the screen; at the cards section it is the section.
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), sectionDoc - 40);
  await page.waitForTimeout(200);
  expect(Math.abs(await stageTop())).toBeLessThan(2);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), sectionDoc + 120);
  await page.waitForTimeout(200);
  expect(Math.abs((await stageTop()) + 120)).toBeLessThan(2);
});

test("deal: the reader's wheel during the scroll takes the page back and only the scroll, never the deal", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await page.mouse.move(720, 450);
  await dealLink(page).click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(60);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("auto");
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(200);
  const taken = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(600);
  // The tween let go: the page is where the reader left it, not still being carried to the cards.
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - taken)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
  // The deal carried on to its end on its own clock.
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
});

test("deal: a stage that leaves the screen mid-deal finishes the deal at once, never leaving the scene half dealt", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
  // The reader jumps far below the cards section: the stage is gone from the screen long before the clock's end.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 2000 });
  expect(await entrances(page)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
  expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
});

test("deal: scrolling by hand deals, and the page never stops scrolling while it plays", async ({ page }) => {
  await openHome(page, { at: "top" });
  await scrollDownByHand(page, async () => (await deal(page)) === "dealing", 60);
  expect(await deal(page)).toBe("dealing");
  // Vertical scroll is never hijacked: no lock on the body, and the wheel still moves the page.
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
});

test("deal: a load with the cards section already in view opens at once, with no deal played", async ({ page }) => {
  await logDeal(page);
  await page.goto("/?coildebug=1#work");
  await waitForScene(page);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt");
  expect(await entrances(page)).toBe(0);
  expect(await dealLog(page)).not.toContain("dealing");
});

test("deal: nothing opens and no wheel is captured before the Coil unfurls, and from the unfurl the Coil takes a fresh wheel gesture at once, no pointer move needed", async ({ page }) => {
  await openHome(page, { at: "foot" });
  const { width, height } = page.viewportSize()!;
  const centre = { x: Math.round(width / 2), y: Math.round(height / 2) };
  // A keyboard deal, so the pointer can be parked where the Coil will be and never moves again.
  await dealLink(page).focus();
  await page.mouse.move(centre.x, centre.y);
  await page.keyboard.press("Enter");
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 10_000 });
  // While it is dealing and before it unfurls a wheel over the stage is the page's, and nothing opens.
  await page.mouse.wheel(0, 20);
  expect(await page.evaluate(() => (window as unknown as { __coil: { captured: number } }).__coil.captured)).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForFunction(() => ["unfurled", "dealt"].includes(document.documentElement.dataset.deal ?? ""), null, { timeout: 20_000 });
  // The page's own scroll to the cards is over, and the pointer has not moved since: the Coil is the reader's from the unfurl, before the columns are in.
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  const probe = await page.evaluate(({ x, y }) => (window as unknown as { __coil: { captureAt: (x: number, y: number) => { onCard: boolean } } }).__coil.captureAt(x, y), centre);
  expect(probe.onCard, "the parked pointer is over the Coil").toBe(true);
  const offsetBefore = await page.evaluate(() => (window as unknown as { __coil: { offset: () => number } }).__coil.offset());
  // A fresh gesture: the wheel has been quiet for far longer than the gesture gap.
  const stateAtGesture = await page.evaluate(() => document.documentElement.dataset.deal);
  await page.mouse.wheel(0, 120);
  expect(await page.evaluate(() => (window as unknown as { __coil: { captured: number } }).__coil.captured), `a wheel gesture at ${stateAtGesture}`).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __coil: { owner: () => string } }).__coil.owner())).toBe("coil");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __coil: { offset: () => number } }).__coil.offset()), { message: "the Coil turns under the wheel" }).not.toBeCloseTo(offsetBefore, 1);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
});

test("deal: the Coil takes the wheel while the columns are still arriving: the stage takes the pointer at the unfurl, and the titles at the end", async ({ page }) => {
  await logDeal(page);
  await openHome(page, { at: "foot" });
  await dealLink(page).click();
  await page.waitForFunction(() => document.documentElement.dataset.deal === "unfurled", null, { timeout: 20_000 });
  // From the unfurl the stage takes pointers (the Coil), while the titles still wait for the columns.
  expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("auto");
  expect(await pointerEventsOf(page, "#work [data-deal-title]")).toBe("none");
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await pointerEventsOf(page, "#work [data-deal-title]")).not.toBe("none");
  expect(await dealLog(page)).toEqual(DEAL_VALUES);
});

test("deal: the Coil is unfurled by about 2 s after the click and the columns are in by about 2.6 s", async ({ page }) => {
  await logDeal(page);
  await openHome(page, { at: "foot" });
  await page.evaluate(() => {
    const w = window as unknown as { __marks: Record<string, number> };
    w.__marks = {};
    new MutationObserver(() => {
      const value = document.documentElement.dataset.deal ?? "";
      w.__marks[value] ??= performance.now();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-deal"] });
  });
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  const marks = await page.evaluate(() => (window as unknown as { __marks: Record<string, number> }).__marks);
  const clicked = marks.dealing;
  expect(clicked).toBeGreaterThan(0);
  test.info().annotations.push({ type: "timings", description: `click to unfurled ${(marks.unfurled - clicked).toFixed(0)} ms, to dealt ${(marks.dealt - clicked).toFixed(0)} ms` });
  expect(marks.unfurled - clicked, "click to unfurled").toBeGreaterThan(1700);
  expect(marks.unfurled - clicked, "click to unfurled").toBeLessThan(2400);
  expect(marks.dealt - clicked, "click to dealt").toBeGreaterThan(2300);
  expect(marks.dealt - clicked, "click to dealt").toBeLessThan(3100);
});

test("deal: scrolling back up shows page 1 as it was, with Back to my cards, and the cards stay dealt both ways", async ({ page }) => {
  await logDeal(page);
  await openHome(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const back = backLink(page);
  await page.evaluate(() => document.querySelector("[data-intro-cta]")!.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(back).toBeVisible();
  await expect(dealLink(page)).toHaveCount(0);
  // Page 1 is whole: the name drawn with its gradient (the canvas, never a flat fill), all four blocks, the wave, and the ribbon's emptied room closed.
  await expect(page.locator("[data-name-stage]")).toHaveAttribute("data-name-canvas", "on");
  await expect(page.locator("[data-block-text]")).toHaveCount(4);
  await expect(page.locator("#listen")).toBeAttached();
  await expect(page.locator("[data-coil-ribbon][data-gone]")).toHaveCount(1);
  // Nothing of page 2 sits inside page 1: the stage has let go, and no title or card canvas is over it.
  const inside = await page.evaluate(() => {
    const intro = document.querySelector("#about")!.getBoundingClientRect();
    const overlaps = (selector: string) => [...document.querySelectorAll(selector)].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < intro.bottom - 1 && r.bottom > intro.top + 1; });
    return { stage: overlaps("#work [data-coil-stage]"), titles: overlaps("#work [data-deal-title]"), canvas: overlaps("#work canvas") };
  });
  expect(inside).toEqual({ stage: false, titles: false, canvas: false });
  // The button leads to the cards with no replay.
  await back.click();
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("work")!.getBoundingClientRect().top + window.scrollY, behavior: "instant" }));
  await page.waitForTimeout(600);
  expect(await entrances(page)).toBe(1);
  expect(await deal(page)).toBe("dealt");
  expect(await dealLog(page)).toEqual(DEAL_VALUES);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
});

test("deal: a reload deals again", async ({ page }) => {
  await logDeal(page);
  await openHome(page);
  expect(await entrances(page)).toBe(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.reload();
  await waitForScene(page);
  // Back at the top of a fresh page load: closed, and the button invites again at page 1's foot.
  await expect(html(page)).toHaveAttribute("data-deal", "closed");
  expect(await entrances(page)).toBe(0);
  await scrollToFoot(page);
  await expect(dealLink(page)).toBeVisible();
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
  expect(await dealLog(page)).toEqual(DEAL_VALUES);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("deal: the cards are simply there, with no entrance, and the button still leads to them", async ({ page }) => {
    await page.goto("/?coildebug=1");
    await expect(html(page)).toHaveAttribute("data-deal", "dealt");
    expect(await entrances(page)).toBe(0);
    expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
    expect(await opacityOf(page, "#work [data-deal-label]")).toBeGreaterThan(0.7);
    expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("auto");
    // Unspent: page 1 still invites.
    await dealLink(page).click();
    await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 5000 });
    await expect(html(page)).toHaveAttribute("data-deal", "dealt");
    expect(await entrances(page)).toBe(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(backLink(page)).toBeVisible();
  });
});

test("deal: reduced motion turned on live deals at once, and off again leaves it dealt", async ({ page }) => {
  await openHome(page, { at: "top" });
  await expect(html(page)).toHaveAttribute("data-deal", "closed");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(html(page)).toHaveAttribute("data-deal", "dealt");
  expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(300);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt");
  expect(await entrances(page)).toBe(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("deal: nothing is hidden, the page shows the dealt state", async ({ page }) => {
    await page.goto("/");
    await expect(html(page)).not.toHaveAttribute("data-deal", /.+/);
    for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
    expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
    expect(await opacityOf(page, "#work [data-deal-label]")).toBeGreaterThan(0.7);
    expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("auto");
  });
});

test("deal: the lab panel is not in a production build", async ({ page }) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (response) => {
    if (/\.js(\?|$)/.test(response.url()) && response.status() < 400) scripts.push(response.text().catch(() => ""));
  });
  await openHome(page, { at: "top" });
  await expect(page.locator("[data-deal-lab]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deal lab" })).toHaveCount(0);
  const bodies = await Promise.all(scripts);
  expect(bodies.length).toBeGreaterThan(0);
  expect(bodies.filter((body) => body.includes("Replay the deal"))).toEqual([]);
});
