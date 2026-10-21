import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { playerStrings as P } from "@/lib/content/player";
import { HEADER_ROW, ISLAND } from "@/lib/player/constants";
import { openHome, scrollToY } from "./support/coil";
import { toFooter, waitForWord } from "./support/footer";
import { BAND_CARD, CLONE, ISLAND as ISLAND_SELECTOR, bandPastLine, recordMorph, morphSamples } from "./support/player";
import { parkBand } from "./support/wave";

// The phone's island (components/player/PhoneIsland): in the header row, on the
// Menu pill's line between the AS mark and the Menu pill, collapsed to a live
// activity, grown down from the header into the full player by a tap, folded by
// a tap outside, Escape or a swipe up. A phone touches, so these run with touch.

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });

const L = siteContent.listen;
const S = siteContent.soundtrack;
const HOME = "/?wavedebug";
const island = (page: Page) => page.locator(ISLAND_SELECTOR);
const menuPill = (page: Page) => page.locator("[data-menu-pill]");
const mark = (page: Page) => page.getByRole("button", { name: siteContent.menu.markAriaLabel });

async function playOnPhone(page: Page) {
  await parkBand(page);
  await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).tap();
  await expect(page.locator(BAND_CARD)).toBeVisible();
}

// Past the band with the island up and the header showing (a scroll up brings it back).
async function islandUp(page: Page) {
  await playOnPhone(page);
  await bandPastLine(page, 200);
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");
  await page.evaluate(() => window.scrollBy({ top: -14, behavior: "instant" }));
  await expect.poll(async () => (await menuPill(page).boundingBox())!.y).toBeGreaterThan(0);
}

test("player: Play it opens the full player in the band under the copy, with no status line", async ({ page }) => {
  await openHome(page, { path: HOME });
  await playOnPhone(page);
  const card = page.locator(BAND_CARD);
  await expect(card.getByRole("group", { name: P.groupLabel })).toBeVisible();
  await expect(page.locator("#listen [data-band-note]")).toBeHidden();
  await expect(island(page)).toHaveCount(0);
  // In the flow, under the heading, not over the wave's copy.
  const [heading, cardBox] = [(await page.locator("#listen").getByRole("heading", { name: L.line }).boundingBox())!, (await card.boundingBox())!];
  expect(cardBox.y).toBeGreaterThan(heading.y + heading.height - 1);
});

for (const width of [360, 393, 440]) {
  test(`player: the collapsed island stands in the header row on the Menu pill's line, between the mark and the Menu pill, at ${width} wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await openHome(page, { path: HOME });
    await islandUp(page);
    const [i, m, mk] = [(await island(page).boundingBox())!, (await menuPill(page).boundingBox())!, (await mark(page).boundingBox())!];
    expect(Math.abs(i.y + i.height / 2 - (m.y + m.height / 2)), `centers: island ${JSON.stringify(i)} menu ${JSON.stringify(m)}`).toBeLessThanOrEqual(2);
    expect(Math.abs(i.height - m.height), "heights").toBeLessThanOrEqual(1);
    expect(i.height).toBeCloseTo(HEADER_ROW.heightPx, 0);
    expect(i.x, "clear of the mark").toBeGreaterThanOrEqual(mk.x + mk.width + HEADER_ROW.clearPx - 1);
    expect(i.x + i.width, "clear of the Menu pill").toBeLessThanOrEqual(m.x - HEADER_ROW.clearPx + 1);
    expect(i.width).toBeGreaterThanOrEqual(ISLAND.compactMinPx - 1);
    // Black in the island's own way: its face is a live activity, the cover and the level bars.
    await expect(island(page).locator("[data-player-island-face] img")).toBeVisible();
    await expect(island(page).locator(".player-island-bar")).toHaveCount(4);
  });
}

test("player: a tap grows the full player down from the header, and a tap outside, Escape or a swipe up folds it", async ({ page, cdp }) => {
  await openHome(page, { path: HOME });
  await islandUp(page);
  const closed = (await island(page).boundingBox())!;
  await island(page).locator("[data-player-island-face]").tap();
  await expect(island(page)).toHaveAttribute("data-player-island", "open");
  await expect(island(page).getByRole("slider", { name: S.ariaSeek })).toBeVisible();
  await expect.poll(async () => (await island(page).boundingBox())!.width).toBeCloseTo(393 - 2 * ISLAND.expandedMarginPx, 0);
  const open = (await island(page).boundingBox())!;
  expect(open.y, "grows down from the same top edge").toBeCloseTo(closed.y, 0);
  expect(open.height).toBeGreaterThan(150);
  // The player works in it.
  await island(page).getByRole("button", { name: S.ariaNext, exact: true }).tap();
  await expect(island(page).locator("[data-marquee-track]").first()).toHaveText(S.tracks[1].title);

  await page.touchscreen.tap(196, 700);
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");

  await island(page).locator("[data-player-island-face]").tap();
  await expect(island(page)).toHaveAttribute("data-player-island", "open");
  await page.keyboard.press("Escape");
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");

  // A swipe up on the player's own surface folds it; a drag on the seek bar does not.
  await island(page).locator("[data-player-island-face]").tap();
  await expect(island(page)).toHaveAttribute("data-player-island", "open");
  await expect.poll(async () => (await island(page).boundingBox())!.height).toBeGreaterThan(150);
  const seek = (await island(page).getByRole("slider", { name: S.ariaSeek }).boundingBox())!;
  const swipe = async (x: number, from: number, to: number) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
    for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: from + ((to - from) * step) / 8 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await swipe(seek.x + seek.width / 2, seek.y + 10, seek.y - 60);
  await expect(island(page)).toHaveAttribute("data-player-island", "open");
  await swipe(196, 70, 14);
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");
});

test("player: the island shows above the band too, in the hero, and a tap on it opens the player", async ({ page }) => {
  await openHome(page, { path: HOME });
  await playOnPhone(page);
  await bandPastLine(page, 200);
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");
  await scrollToY(page, 0);
  await expect(island(page)).toBeVisible();
  // The header was tucked away by the scroll down; it settles back as the hero returns.
  await expect
    .poll(async () => {
      const [i, m] = [(await island(page).boundingBox())!, (await menuPill(page).boundingBox())!];
      return Math.abs(i.y + i.height / 2 - (m.y + m.height / 2));
    })
    .toBeLessThanOrEqual(2);
  await island(page).locator("[data-player-island-face]").tap();
  await expect(island(page)).toHaveAttribute("data-player-island", "open");
});

test("player: the player morphs up to the island as the band leaves and back down as it returns", async ({ page }) => {
  await openHome(page, { path: HOME });
  await playOnPhone(page);
  await recordMorph(page, 1500);
  await bandPastLine(page, 60);
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");
  await expect(page.locator(BAND_CARD)).toBeHidden();
  const up = (await morphSamples(page)).filter((s) => s.visible);
  expect(up.length, "frames the glass was in flight").toBeGreaterThan(5);
  const end = up.at(-1)!;
  expect(end.top, "the glass ends in the header row").toBeLessThan(40);
  await recordMorph(page, 1500);
  await bandPastLine(page, -60);
  await expect(page.locator(BAND_CARD)).toBeVisible();
  await expect(island(page)).toHaveCount(0);
  expect((await morphSamples(page)).filter((s) => s.visible).length).toBeGreaterThan(5);
  await expect(page.locator(CLONE)).toBeHidden();
});

test("player: the footer's period stays reachable with the island up, and the island stays clear of the footer", async ({ page }) => {
  await openHome(page, { path: HOME });
  await playOnPhone(page);
  await bandPastLine(page, 60);
  await expect(island(page)).toHaveAttribute("data-player-island", "closed");
  await toFooter(page);
  await waitForWord(page);
  const egg = page.getByRole("button", { name: siteContent.footer.dropPeriod });
  const at = (await egg.boundingBox())!;
  const covered = await page.evaluate(([x, y]) => !document.elementFromPoint(x, y)?.closest("[data-egg]"), [at.x + at.width / 2, at.y + at.height / 2]);
  expect(covered, "the period's button is not under the island").toBe(false);
  await egg.tap();
  await waitForWord(page, "moving");
  await waitForWord(page);
});
