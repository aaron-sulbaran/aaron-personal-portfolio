import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, waitForScene } from "./support/coil";
import { siteContent } from "@/lib/content";

// The deal (hero rework, slice 2): the cards section is closed until the
// reader deals, by the button or by scrolling to it, once per page load; then
// the cards fly into the Coil, the section opens around them and the columns
// arrive last. <html data-deal> says where it is (closed, dealing, dealt) and,
// behind ?coildebug, data-deal-entrances counts how many times it played.

const { fork } = siteContent.intro;
const titles = siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles));
const html = (page: Page) => page.locator("html");
const deal = (page: Page) => page.evaluate(() => document.documentElement.dataset.deal);
const entrances = (page: Page) => page.evaluate(() => Number(document.documentElement.dataset.dealEntrances));
const opacityOf = (page: Page, selector: string) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)!).opacity), selector);

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

test("deal: the cards section starts closed, and nothing in it answers a pointer", async ({ page }) => {
  await openHome(page, { at: "top" });
  await expect(html(page)).toHaveAttribute("data-deal", "closed");
  expect(await entrances(page)).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#work [data-coil-stage]")!).clipPath)).toMatch(/circle\(0px/);
  expect(await opacityOf(page, '#work [data-deal-title]')).toBe(0);
  expect(await opacityOf(page, "#work [data-deal-label]")).toBe(0);
  await expect(page.getByRole("button", { name: fork.deal })).toBeVisible();
  await expect(page.getByText(fork.scroll)).toBeVisible();
});

test("deal: the button scrolls to the cards, the Coil's entrance plays once there, and the columns are in after", async ({ page }) => {
  await logDeal(page);
  await openHome(page, { at: "top" });
  await page.getByRole("button", { name: fork.deal }).click();
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
  // The entrance played on the arrival (it never started before the scroll got there).
  expect(await dealLog(page)).toEqual(["pending", "closed", "dealing", "dealt"]);
  expect(await page.evaluate(() => (window as unknown as { __coil: { entrance: () => { ended: boolean } } }).__coil.entrance().ended)).toBe(true);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toBeVisible();
  expect(await opacityOf(page, "#work [data-deal-title]")).toBe(1);
  // A label rests at its own 80 percent (opacity-80 in CardColumns), nothing the deal left behind.
  expect(await opacityOf(page, "#work [data-deal-label]")).toBeCloseTo(0.8, 5);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#work [data-coil-stage]")!).clipPath)).toBe("none");
  await expect(page.locator("#work h2")).toHaveText(["Work", "Builds"]);
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

test("deal: a load with the cards section already in view deals at once", async ({ page }) => {
  await logDeal(page);
  await page.goto("/?coildebug=1#work");
  await waitForScene(page);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await entrances(page)).toBe(1);
  expect(await dealLog(page)).toContain("dealing");
});

test("deal: nothing opens and no wheel is captured until the entrance completes", async ({ page }) => {
  await openHome(page, { at: "top" });
  await page.getByRole("button", { name: fork.deal }).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealing", { timeout: 10_000 });
  // A pointer on a title, and on the Coil, while the cards are still being dealt.
  const title = page.locator('#work button[data-card="ieee"]');
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

test("deal: scrolling back up shows Back to my cards, and the cards stay dealt both ways", async ({ page }) => {
  await logDeal(page);
  await openHome(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const back = page.getByRole("button", { name: fork.back });
  await expect(back).toBeVisible();
  await expect(page.getByRole("button", { name: fork.deal })).toHaveCount(0);
  await expect(page.getByText(fork.scroll)).toBeHidden();
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
  await expect(page.getByRole("button", { name: fork.deal })).toBeVisible();
  await page.getByRole("button", { name: fork.deal }).click();
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
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("#work [data-coil-stage]")!).clipPath)).toBe("none");
    // Unspent: the fork still invites.
    await page.getByRole("button", { name: fork.deal }).click();
    await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 5000 });
    await expect(html(page)).toHaveAttribute("data-deal", "dealt");
    expect(await entrances(page)).toBe(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.getByRole("button", { name: fork.back })).toBeVisible();
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
    expect(await page.evaluate(() => getComputedStyle(document.querySelector("#work [data-coil-stage]")!).clipPath)).toBe("none");
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
