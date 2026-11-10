import type { CDPSession, Page } from "@playwright/test";
import { homeDeck, deckOf } from "@/lib/card/deck";
import { siteContent, type CardKey } from "@/lib/content";
import { quickEntries } from "@/lib/content/quick";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { runProgress } from "@/lib/quests/progress";
import { yearRows } from "@/lib/quick/years";
import type { QuestState } from "@/lib/quests/types";
import { test, expect } from "./support/fixtures";
import { settled } from "./support/fallback";
import { cardDialog, cardRow, openCardFromBook, panelAtRest } from "./support/cards";

// Stepping from one card's modal to the next without closing it (components/card/DeckRails, useDeckStep, lib/card/deck): the side
// chevrons and the arrow keys on a desktop, a swipe past a phone pager's first or last page (Aaron's pick, 2026-11-09), the order the
// page shows its cards, going round its ends until every card has been seen (then the end's chevron grays), and every card stepped
// past counting as opened, for the progress line and the quest line alike.

const d = siteContent.modals.deck;
const title = (key: CardKey) => siteContent.cards[key].short;
const seenKeys = (page: Page) => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "[]") as string[], SEEN_STORAGE_KEY);
const questState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("aaron-quests-v1") ?? "null") as QuestState | null);
const shownCard = (page: Page) => page.locator('[role="dialog"][data-card-modal]').getAttribute("data-card-modal");

test.describe("on a desktop", () => {
  // Guards: the chevrons stepping in the wrong order, stopping at an end while cards are unseen, or reopening the modal's shell; a
  // flown card left parked so the next title no longer opens; the card left not counting. Fails at: the dialog marker, a chevron's
  // name, the seen list, or the second open.
  test("the side chevrons step through page 2's order in one open modal, go round its ends while cards are unseen, and every card left counts", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "ieee");
    await dialog.evaluate((el) => el.setAttribute("data-shell", "first"));
    await expect(page.getByRole("button", { name: d.previousCard(title("anthropic")) })).toBeVisible();
    await page.getByRole("button", { name: d.nextCard(title("fsdatalink")) }).click();
    await panelAtRest(page, "fsdatalink");
    await expect(cardDialog(page, "fsdatalink")).toHaveAttribute("data-shell", "first");
    await expect(page.locator("[data-deck-announce]")).toHaveText(d.announce(siteContent.cards.fsdatalink.modal.title, 4, 14));
    expect(await seenKeys(page)).toEqual(["ieee"]);
    await page.getByRole("button", { name: d.nextCard(title("jobs")) }).click();
    await panelAtRest(page, "jobs");
    expect(await seenKeys(page)).toEqual(["ieee", "fsdatalink"]);

    // Closing counts the card the visitor ended on and hands focus to its title, and nothing is left parked: a title opens again.
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-card-modal]")).toHaveCount(0);
    expect(await seenKeys(page)).toEqual(["ieee", "fsdatalink", "jobs"]);
    await expect(cardRow(page, "jobs")).toBeFocused();
    await expect(page.locator("[data-card-progress] p").first()).toHaveText(siteContent.columns.progress(3, 14));
    await cardRow(page, "travel").click();
    await expect(cardDialog(page, "travel")).toBeVisible();
    await panelAtRest(page, "travel");
    // Travel is page 2's last card, and eleven are unseen: the deck goes round to Capital One.
    const next = page.locator('[data-deck-step="next"]');
    await expect(next).not.toHaveAttribute("aria-disabled", "true");
    await expect(next).toHaveAccessibleName(d.nextCard(title("capital-one")));
    await next.click();
    await panelAtRest(page, "capital-one");
    await expect(page.locator('[data-deck-step="prev"]')).toHaveAccessibleName(d.previousCard(title("travel")));
  });

  // Guards: the chevrons scrolling away with a long card, sitting on its words, or out of the focus trap. Fails at: the centre read
  // after a scroll, the overlap with the words, or the Shift+Tab focus read.
  test("the chevrons hold the window's middle while a long card scrolls, clear of its words, and Tab reaches them", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "ieee", { settled: true });
    const middle = async () => {
      const box = (await page.locator('[data-deck-step="next"]').boundingBox())!;
      return box.y + box.height / 2;
    };
    expect(Math.abs((await middle()) - 450)).toBeLessThan(2);
    await dialog.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(async () => Math.abs((await middle()) - 450)).toBeLessThan(2);
    const clear = await page.evaluate(() => {
      const words = [...document.querySelectorAll("[data-gallery-panel] p")].map((el) => el.getBoundingClientRect());
      return [...document.querySelectorAll("[data-deck-step]")].every((button) => {
        const b = button.getBoundingClientRect();
        return words.every((w) => b.right <= w.left || b.left >= w.right || b.bottom <= w.top || b.top >= w.bottom);
      });
    });
    expect(clear, "no chevron covers a paragraph").toBe(true);
    await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator('[data-deck-step="next"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await panelAtRest(page, "fsdatalink");
    await expect(page.locator('[data-deck-step="next"]')).toBeFocused();
  });

  // Guards: the arrow keys skipping a card, going round once all are seen, or stepping the rotator's photos and the card at once;
  // the run's card group not filling when the deck is walked instead of opened from the titles. Fails at: the walk's order, the end
  // reads, or the quest reads.
  test("the arrow keys walk all fourteen, gray the end once all are seen, and fill the Any% and 100% runs' cards", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await openCardFromBook(page, "capital-one", { home: false });
    await expect(page.locator('[data-deck-step="prev"]')).toHaveAccessibleName(d.previousCard(title("travel")));
    const walked: (string | null)[] = [await shownCard(page)];
    for (let i = 0; i < homeDeck.length; i++) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => shownCard(page)).toBe(homeDeck[Math.min(i + 1, homeDeck.length - 1)]);
      walked.push(await shownCard(page));
    }
    expect(walked).toEqual([...homeDeck, homeDeck[homeDeck.length - 1]]);
    const next = page.locator('[data-deck-step="next"]');
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(next).toHaveAccessibleName(d.nextCard(null));
    await next.dispatchEvent("click");
    expect(await shownCard(page)).toBe(homeDeck[homeDeck.length - 1]);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => shownCard(page)).toBe(homeDeck[homeDeck.length - 2]);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-card-modal]")).toHaveCount(0);
    expect([...(await seenKeys(page))].sort()).toEqual([...homeDeck].sort());
    await expect(page.locator("[data-card-progress] p").first()).toHaveText(siteContent.columns.progress(14, 14));
    const state = (await questState(page))!;
    for (const category of ["any", "full"] as const) {
      const cards = runProgress(state, category).groups.find((group) => group.group === "cards");
      expect(cards?.done, `${category}: the cards group is done`).toBe(true);
    }
  });

  // Guards: a step under reduced motion travelling sideways. Fails at: the transform sampled through the step.
  test("under reduced motion a step is a fade alone", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await settled(page);
    await openCardFromBook(page, "ieee", { home: false });
    await page.evaluate(() => {
      const w = window as unknown as { __steps: string[] };
      w.__steps = [];
      const sample = () => {
        const panel = document.querySelector("[data-gallery-panel]");
        if (panel) w.__steps.push(getComputedStyle(panel).transform);
        if (w.__steps.length < 30) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.keyboard.press("ArrowRight");
    await expect(cardDialog(page, "fsdatalink")).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __steps: string[] }).__steps.length >= 30);
    const transforms = await page.evaluate(() => (window as unknown as { __steps: string[] }).__steps);
    expect(transforms.filter((t) => t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)")).toEqual([]);
  });

  // Guards: the MVP stepping in page 2's order, or visiting a card twice for its several tiles. Fails at: the walk, or the focus read.
  test("on the MVP the chevrons follow the lane's tiles top to bottom, each card once, and focus returns to the card's tile", async ({ page }) => {
    const deck = deckOf(yearRows(quickEntries).flatMap((row) => row.entries.map((entry) => entry.id)));
    await page.goto("/quick");
    const first = page.locator(`button[data-quick-slot][data-card="${deck[0]}"]`).first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    await panelAtRest(page, deck[0]);
    await expect(page.locator('[data-deck-step="prev"]')).toHaveAccessibleName(d.previousCard(title(deck[deck.length - 1])));
    for (const key of deck.slice(1, 4)) {
      await page.getByRole("button", { name: d.nextCard(title(key)) }).click();
      await panelAtRest(page, key);
    }
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-card-modal]")).toHaveCount(0);
    await expect(page.locator(`button[data-quick-slot][data-card="${deck[3]}"]`).first()).toBeFocused();
    expect([...(await seenKeys(page))].sort()).toEqual([...deck.slice(0, 4)].sort());
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  // One finger along the open card's title line (clear of a stage's video and the words' buttons, which keep their own presses), at a
  // hand's pace (never a quick flick).
  async function swipe(page: Page, cdp: CDPSession, by: number) {
    const heading = (await page.locator("[data-card-modal] [data-gallery-panel] h2").first().boundingBox())!;
    const y = heading.y + heading.height / 2;
    const from = { x: by < 0 ? 280 : 90, y };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let i = 1; i <= 14; i++) {
      await sleep(20);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (by * i) / 14, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  const noSideways = (page: Page) =>
    page.evaluate(() => {
      const dialog = document.querySelector<HTMLElement>("[data-card-modal]");
      return document.documentElement.scrollWidth <= innerWidth && (!dialog || dialog.scrollWidth <= dialog.clientWidth);
    });

  // Guards: a swipe past the last page staying put (or past the first page wrapping), the last page's chevron still a page chevron, a
  // card with no pages ignoring a swipe, side chevrons on a phone, or anything new scrolling sideways at 375 by 667. Fails at: the card
  // or page read after a swipe, the chevron's name, the rails' count, or the sideways read.
  test("a swipe past the last page goes to the next card and past the first to the one before, and the last page's chevron names the next card", async ({ page, cdp }) => {
    await page.goto("/");
    await settled(page);
    const { dialog } = await openCardFromBook(page, "mentorship", { home: false, settled: true });
    await expect(page.locator("[data-deck-rail]")).toHaveCount(0);
    const pager = dialog.locator("[data-pager]");
    const dots = await dialog.locator("[data-pager-dot]").count();
    await dialog.locator(`[data-pager-dot="${dots - 1}"]`).click();
    await expect(pager).toHaveAttribute("data-page", String(dots - 1));
    await expect(dialog.locator('[data-pager-arrow="next"]')).toHaveAccessibleName(d.nextCard(title("min-max")));
    await expect(dialog.locator('[data-pager-arrow="next"]')).toBeEnabled();
    expect(await noSideways(page)).toBe(true);

    await swipe(page, cdp, -160);
    await expect(cardDialog(page, "min-max")).toBeVisible();
    await panelAtRest(page, "min-max");
    expect(await seenKeys(page)).toEqual(["mentorship"]);
    const minMaxPages = page.locator('[data-card-modal="min-max"] [data-pager]');
    if (await minMaxPages.count()) await expect(minMaxPages).toHaveAttribute("data-page", "0");
    expect(await noSideways(page)).toBe(true);

    await swipe(page, cdp, 160);
    await expect(cardDialog(page, "mentorship")).toBeVisible();
    await panelAtRest(page, "mentorship");
    await expect(page.locator('[data-card-modal="mentorship"] [data-pager]')).toHaveAttribute("data-page", "0");
    await swipe(page, cdp, -160);
    await expect(page.locator('[data-card-modal="mentorship"] [data-pager]')).toHaveAttribute("data-page", "1");
    expect(await noSideways(page)).toBe(true);
  });

  // Aaron, Nov 9: a visitor can chevron through every card. Guards: a last page's chevron that stops, a card with no pages and no
  // chevrons, a step that drops focus to the close button, or a deck that never stops. Fails at: the order walked, the focused
  // chevron, or the chevron at the deck's end.
  test("the chevrons under the pages walk every card in the deck's order, and stop at its end once all have been seen", async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto("/");
    await settled(page);
    await openCardFromBook(page, homeDeck[0], { home: false, settled: true });
    await expect(page.locator('[data-card-modal] [data-pager-arrow="prev"]')).toHaveAccessibleName(d.previousCard(title(homeDeck[homeDeck.length - 1])));
    const where = () =>
      page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-card-modal]');
        return `${dialog?.dataset.cardModal}:${dialog?.querySelector<HTMLElement>("[data-pager]")?.dataset.page ?? "-"}`;
      });
    const walked: string[] = [];
    for (let taps = 0; taps < 80; taps++) {
      const at = await where();
      const key = at.split(":")[0];
      if (walked[walked.length - 1] !== key) walked.push(key);
      const next = page.locator(`[role="dialog"][data-card-modal="${key}"] [data-pager-arrow="next"]`);
      await expect(next).toHaveCount(1);
      if (await next.isDisabled()) break;
      await next.click();
      await expect.poll(where).not.toBe(at);
    }
    expect(walked).toEqual([...homeDeck]);
    const last = homeDeck[homeDeck.length - 1];
    await expect(cardDialog(page, last).locator('[data-pager-arrow="next"]')).toBeDisabled();
    await expect(cardDialog(page, last).locator('[data-pager-arrow="prev"]')).toBeEnabled();
  });

  test("Enter on the last page's chevron lands focus on the next card's chevron", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    const { dialog } = await openCardFromBook(page, "mentorship", { home: false, settled: true });
    const dots = await dialog.locator("[data-pager-dot]").count();
    await dialog.locator(`[data-pager-dot="${dots - 1}"]`).click();
    await dialog.locator('[data-pager-arrow="next"]').focus();
    await page.keyboard.press("Enter");
    await expect(cardDialog(page, "min-max")).toBeVisible();
    await expect(cardDialog(page, "min-max").locator('[data-pager-arrow="next"]')).toBeFocused();
    expect(await seenKeys(page)).toEqual(["mentorship"]);
    // The new panel slides in 28px from the side it was asked for, past the dialog's edge on a phone for that slide alone; the
    // sideways read is of the card at rest, as the swipe test's is.
    await panelAtRest(page, "min-max");
    expect(await noSideways(page)).toBe(true);
  });

  test("a card with no pages steps on a sideways swipe", async ({ page, cdp }) => {
    await page.goto("/");
    await settled(page);
    const { dialog } = await openCardFromBook(page, "fsdatalink", { home: false, settled: true });
    await expect(dialog.locator("[data-pager]")).toHaveCount(0);
    await swipe(page, cdp, -160);
    await expect(cardDialog(page, "jobs")).toBeVisible();
    await panelAtRest(page, "jobs");
    expect(await seenKeys(page)).toEqual(["fsdatalink"]);
    expect(await noSideways(page)).toBe(true);
  });
});
