import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToFoot, waitForScene } from "./support/coil";
import { siteContent } from "@/lib/content";

// The deal (hero rework, slices 2, 4a, 4c and 4d): the cards section is closed
// until the reader deals, by the button or by scrolling, once per page load; then
// the ribbon at page 1's foot rushes in toward the button and curls into the
// wheel, which spins up, the page scrolls itself to the cards (the cutscene: the
// click's or the reader's own scroll's, e2e/deal-cutscene.spec.ts), the
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
  // A label rests at the stylesheet's full opacity: nothing the deal left behind.
  expect(await opacityOf(page, "#work [data-deal-label]")).toBe(1);
  // Dealt: the stage takes pointers, the button is back for the "Back to my cards" state, and the root's smooth scroll is put back.
  expect(await pointerEventsOf(page, "#work [data-coil-stage]")).toBe("auto");
  expect(await opacityOf(page, "[data-intro-cta]")).toBe(1);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("");
  await expect(page.locator("#work h3")).toHaveText(["Work", "Builds"]);
});

test("deal: the Coil's canvas is a sticky stage whose rail starts above the ribbon at page 1's foot and lets go where the cards section ends", async ({ page }) => {
  await openHome(page, { at: "foot" });
  const work = await rectOf(page, "#work");
  const rail = await page.evaluate(() => {
    const r = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const slot = document.querySelector("[data-coil-ribbon]")!.getBoundingClientRect();
    return { top: r.top, height: r.height, slotMiddle: slot.top + slot.height / 2, stage: document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().height, frame: document.querySelector("[data-coil-frame]")!.getBoundingClientRect().height, railDoc: r.top + window.scrollY };
  });
  // The rail starts above the ribbon's middle (room for the wheel above it) and ends with the cards section; the stage is the section's frame tall.
  expect(rail.top).toBeLessThan(rail.slotMiddle - 100);
  expect(rail.top).toBeLessThan(work.top);
  expect(Math.abs(rail.top + rail.height - work.bottom)).toBeLessThan(2);
  expect(Math.abs(rail.stage - rail.frame)).toBeLessThan(2);
  const stageTop = () => page.evaluate(() => document.querySelector("[data-coil-sticky]")!.getBoundingClientRect().top);
  // Before it sticks it rides the page with the ribbon.
  expect(Math.abs((await stageTop()) - rail.top)).toBeLessThan(2);
  // A little way into the range (short of where a scroll starts the deal) it stays at the top of the screen.
  const range = rail.height - rail.stage;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), rail.railDoc + range * 0.08);
  await page.waitForTimeout(200);
  expect(await deal(page)).toBe("closed");
  expect(Math.abs(await stageTop())).toBeLessThan(2);
  // Dealt, the stage has let go: it is the section, and scrolls away with it.
  await dealLink(page).click();
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  await page.waitForTimeout(700);
  const sectionDoc = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), sectionDoc + 120);
  await page.waitForTimeout(200);
  expect(Math.abs((await stageTop()) + 120)).toBeLessThan(2);
});

test("deal: the reader's wheel during the click's scroll no longer takes the page back: the cutscene holds it to page 2", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await page.mouse.move(720, 450);
  const startY = await page.evaluate(() => window.scrollY);
  await dealLink(page).click();
  // Polled every frame or so: the scroll joins after the rush and runs about a second, so a slow poll could land after it.
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000, intervals: [30] }).toBeGreaterThan(startY + 60);
  expect(await page.evaluate(() => document.documentElement.style.scrollBehavior)).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-deal-lock"))).toBe(true);
  await page.mouse.wheel(0, -200);
  // The wheel was swallowed: the scroll carried on to the cards section's top, where the page now stays.
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.style.scrollBehavior), { message: "the root's smooth scroll is put back when the scroll arrives" }).toBe("");
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(Math.abs((await rectOf(page, "#work")).top)).toBeLessThan(2);
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

test("deal: scrolling by hand deals as a cutscene: the page holds the reader's wheel until the Coil unfurls, then the wheel is theirs again", async ({ page }) => {
  await openHome(page, { at: "top" });
  await scrollDownByHand(page, async () => (await deal(page)) === "dealing", 60);
  expect(await deal(page)).toBe("dealing");
  // The cutscene holds the reader's input (a listener lock: the body's own overflow is never touched on a desktop).
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-deal-lock"))).toBe(true);
  const before = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(150);
  // A wheel during it neither adds to the scroll nor takes it back: page 2's top only comes nearer, never past.
  const during = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().top);
  expect(during).toBeLessThanOrEqual(before + 0.5);
  expect(during).toBeGreaterThanOrEqual(-0.5);
  await expect(html(page)).toHaveAttribute("data-deal", "dealt", { timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-deal-lock"))).toBe(false);
  expect(await entrances(page)).toBe(1);
  // The reader has the page again once the Coil is theirs.
  expect(Math.abs((await rectOf(page, "#work")).top)).toBeLessThan(2);
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

test("deal: Deal me in moves with the cards: a hover eases the ribbon faster and tightens its gaps, leaving restores it, and a press scales the button", async ({ page }) => {
  await openHome(page, { debug: "flight", at: "foot" });
  await page.waitForTimeout(800);
  type Coil = { offset: () => number };
  const sample = (ms: number) =>
    page.evaluate(
      (wait) =>
        new Promise<{ rate: number; pitch: number }>((resolve) => {
          const w = window as unknown as { __coil: Coil; __coilFlight: { scene: { slots: () => { center: { x: number; y: number } }[] } } };
          const start = w.__coil.offset();
          const t0 = performance.now();
          setTimeout(() => {
            // The row's pitch: the mean spacing of the cards around the middle of the screen.
            const middle = w.__coilFlight.scene.slots().filter((s) => Math.abs(s.center.x - innerWidth / 2) < 300).sort((a, b) => a.center.x - b.center.x);
            const pitch = middle.length > 1 ? (middle[middle.length - 1].center.x - middle[0].center.x) / (middle.length - 1) : Number.NaN;
            resolve({ rate: (w.__coil.offset() - start) / ((performance.now() - t0) / 1000), pitch });
          }, wait);
        }),
      ms,
    );
  const rest = await sample(900);
  expect(rest.rate, "the ribbon drifts left").toBeLessThan(0);
  const box = (await dealLink(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(700);
  const hover = await sample(900);
  expect(hover.rate / rest.rate, "the ribbon eases faster under the pointer").toBeGreaterThan(2.5);
  expect(hover.pitch, "its gaps tighten toward the button").toBeLessThan(rest.pitch - 4);
  // A press scales the button to the standard 0.97, and lets go.
  const wrapper = () => dealLink(page).evaluate((el) => getComputedStyle(el.parentElement!).transform);
  expect(await wrapper()).toBe("none");
  await page.mouse.down();
  await page.waitForTimeout(250);
  expect(await wrapper()).toBe("matrix(0.97, 0, 0, 0.97, 0, 0)");
  // Let go off the button: no click, no deal.
  await page.mouse.move(8, 8);
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(await deal(page)).toBe("closed");
  const off = await sample(900);
  expect(off.rate / rest.rate, "back to the ribbon's own pace").toBeCloseTo(1, 0);
  expect(Math.abs(off.pitch - rest.pitch), "and its own gaps").toBeLessThan(2);
});

// The click is the button's press and the cards' gather, and nothing else: no ring (Aaron's call, the ring read as off-vibe).
// The press is a keyframe on the button's wrapper (data-pressed while it runs); no ring or pulse element is ever added.
test("deal: the click presses the button in and springs it back, and draws no ring", async ({ page }) => {
  await openHome(page, { at: "foot" });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const w = window as unknown as { __press: { pressed: boolean; ring: boolean; scale: number }[] };
    w.__press = [];
    const t0 = performance.now();
    const tick = () => {
      const press = document.querySelector("[data-deal-press]")!;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(press).transform === "none" ? undefined : getComputedStyle(press).transform);
      w.__press.push({ pressed: press.hasAttribute("data-pressed"), ring: !!document.querySelector("[data-deal-ring], [data-deal-pulse], .deal-pulse"), scale: matrix.a });
      if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await dealLink(page).click();
  await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => (window as unknown as { __press: { pressed: boolean; ring: boolean; scale: number }[] }).__press);
  expect(frames.some((f) => f.ring), "no ring or pulse element at any frame").toBe(false);
  expect(frames.some((f) => f.pressed), "the button's press runs").toBe(true);
  expect(Math.min(...frames.map((f) => f.scale)), "the button presses in").toBeLessThan(0.985);
  expect(Math.max(...frames.map((f) => f.scale)), "and springs past rest").toBeGreaterThan(1.02);
  expect(frames.at(-1)!.pressed, "the press is over by the end").toBe(false);
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
