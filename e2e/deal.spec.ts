import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, waitForScene } from "./support/coil";
import { siteContent } from "@/lib/content";

// The deal (hero rework, slices 2, 4a and 4c): the cards section is closed until
// the reader deals, by the button or by scrolling, once per page load; then the
// ribbon on the first screen condenses and curls into the wheel, which spins up,
// the page scrolls itself to the cards (a click only), the wheel flattens into
// the band and unfurls into the Coil, the field opens around it and the columns
// arrive last, all on one clock.
// <html data-deal> says where it is (closed, dealing, dealt) and, behind
// ?coildebug, data-deal-entrances counts how many times it played.

const { teaser } = siteContent.intro;
const titles = siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles));
// Deal me in is a real link to the cards that the page upgrades.
const dealLink = (page: Page) => page.getByRole("link", { name: teaser.deal });
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

test("deal: the cards section starts closed under the first screen, and nothing in it answers a pointer", async ({ page }) => {
  await openHome(page, { at: "top" });
  await expect(html(page)).toHaveAttribute("data-deal", "closed");
  expect(await entrances(page)).toBe(0);
  // The stage draws the first screen (the name, the ribbon, the field): nothing in it takes a pointer, and the cards section's poster waits.
  expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("none");
  expect(await opacityOf(page, "#work [data-coil-poster]")).toBe(0);
  expect(await opacityOf(page, '#work [data-deal-title]')).toBe(0);
  expect(await opacityOf(page, "#work [data-deal-label]")).toBe(0);
  await expect(dealLink(page)).toBeVisible();
  await expect(page.locator("[data-coil-ribbon]")).toBeVisible();
});

test("deal: the button plays one clock, the page scrolls itself to the cards inside it, and the columns are in after", async ({ page }) => {
  await logDeal(page);
  await openHome(page, { at: "top" });
  await dealLink(page).click();
  // The deal starts at the click, with the page still on the first screen: the ribbon condenses first, the scroll joins after the condense.
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 5000 });
  expect((await rectOf(page, "#work")).top).toBeGreaterThan(100);
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
  expect(await dealLog(page)).toEqual(["pending", "closed", "dealing", "dealt"]);
  expect(await page.evaluate(() => (window as unknown as { __coil: { entrance: () => { ended: boolean } } }).__coil.entrance().ended)).toBe(true);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
  expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
  // A label rests at its own 80 percent (opacity-80 in CardColumns), nothing the deal left behind.
  expect(await opacityOf(page, "#work [data-deal-label]")).toBeCloseTo(0.8, 5);
  // Dealt: the stage takes pointers, the first screen's text is back for the "Back to my cards" state, and the root's smooth scroll is put back.
  expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("auto");
  expect(await opacityOf(page, "[data-first-blocks]")).toBe(1);
  expect(await opacityOf(page, "[data-first-cta]")).toBe(1);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
  await expect(page.locator("#work h2")).toHaveText(["Work", "Builds"]);
});

test("deal: the Coil's canvas is a sticky stage that covers the first screen from the page's first pixel and lets go where the cards section ends", async ({ page }) => {
  await openHome(page, { at: "top" });
  const work = await rectOf(page, "#work");
  const rail = await page.evaluate(() => {
    const r = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const f = document.querySelector("[data-first-screen]")!.getBoundingClientRect();
    return { top: r.top, height: r.height, firstTop: f.top, stage: document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().height, viewport: window.innerHeight };
  });
  // The rail starts where the first screen does and ends with the cards section; the stage is a screen tall (or the section, if taller).
  expect(Math.abs(rail.top - rail.firstTop)).toBeLessThan(2);
  expect(Math.abs(rail.top + rail.height - work.bottom)).toBeLessThan(2);
  expect(Math.abs(rail.stage - Math.max(work.height, rail.viewport))).toBeLessThan(2);
  expect(rail.top).toBeLessThanOrEqual(0);
  const stageTop = () => page.evaluate(() => document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().top);
  const sectionDoc = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top + window.scrollY);
  // At the top it covers the first screen; inside the range it stays at the top of the screen; at the cards section it is the section.
  expect(Math.abs(await stageTop())).toBeLessThan(2);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), sectionDoc / 2);
  await page.waitForTimeout(200);
  expect(Math.abs(await stageTop())).toBeLessThan(2);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), sectionDoc + 120);
  await page.waitForTimeout(200);
  expect(Math.abs((await stageTop()) + 120)).toBeLessThan(2);
});

test("deal: the reader's wheel during the scroll takes the page back and only the scroll, never the deal", async ({ page }) => {
  await openHome(page, { at: "top" });
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
  await openHome(page, { at: "top" });
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
  await scrollDownByHand(page, async () => (await deal(page)) === "dealing");
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

test("deal: nothing opens and no wheel is captured until the entrance completes", async ({ page }) => {
  await openHome(page, { at: "top" });
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 10_000 });
  // A pointer on a title, and on the Coil, while the cards are still being dealt (the page's own scroll has brought the section up).
  const title = page.locator('#work button[data-card="ieee"]');
  await page.waitForFunction(() => document.getElementById("work")!.getBoundingClientRect().top < 120, null, { timeout: 8000 });
  const box = (await title.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(720, 450);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // A wheel over the Coil is the page's, not the Coil's.
  await page.mouse.wheel(0, 40);
  expect(await page.evaluate(() => (window as unknown as { __coil: { captured: number } }).__coil.captured)).toBe(0);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  await title.click();
  await expect(page.getByRole("dialog", { name: siteContent.cards.ieee.modal.title, exact: true })).toBeVisible();
});

test("deal: scrolling back up shows the name, the text and Back to my cards, and the cards stay dealt both ways", async ({ page }) => {
  await logDeal(page);
  await openHome(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const back = backLink(page);
  await expect(back).toBeVisible();
  await expect(dealLink(page)).toHaveCount(0);
  // The first screen's name is there in the after state (the page's own heading, with the field as its fill), and the ribbon's room has closed.
  await expect(page.locator("[data-name-visual]").first()).toBeVisible();
  await expect(page.locator("[data-coil-ribbon][data-gone]")).toHaveCount(1);
  // The button leads to the cards with no replay.
  await back.click();
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("work")!.getBoundingClientRect().top + window.scrollY, behavior: "instant" }));
  await page.waitForTimeout(600);
  expect(await entrances(page)).toBe(1);
  expect(await deal(page)).toBe("dealt");
  expect(await dealLog(page)).toEqual(["pending", "closed", "dealing", "dealt"]);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
});

test("deal: a reload deals again", async ({ page }) => {
  await logDeal(page);
  await openHome(page);
  expect(await entrances(page)).toBe(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.reload();
  await waitForScene(page);
  // Back at the top of a fresh page load: closed, and the button invites again.
  await expect(html(page)).toHaveAttribute("data-deal", "closed");
  expect(await entrances(page)).toBe(0);
  await expect(dealLink(page)).toBeVisible();
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
  expect(await dealLog(page)).toEqual(["pending", "closed", "dealing", "dealt"]);
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
    // Unspent: the first screen still invites.
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
