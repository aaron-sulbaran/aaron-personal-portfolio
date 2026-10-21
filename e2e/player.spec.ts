import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { playerStrings as P } from "@/lib/content/player";
import { HERO_LIFT_PX, ISLE, PILL_IDLE_MS } from "@/lib/player/constants";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { toFooter, waitForWord } from "./support/footer";
import { BAND_CARD, CLONE, ISLAND, PLAYER_PILL, TOGGLE, bandPastLine, morphSamples, pillState, playFromBand, recordMorph, viewportHeight } from "./support/player";
import { bandInkPixels, documentTop, parkBand, pathInk } from "./support/wave";
import type { PathProbe } from "@/lib/wavepath/probe";

// The soundtrack player: the band's card after Play it, the hand-off into the
// pill past the release line and back, the pill's hover, pin and idle fold, the
// pill above the band (the hero and the book), the Menu without a music
// control, Not now's two buttons, and the wave as one line. The phone's island
// and the footer's period are in e2e/player-phone.spec.ts.

const L = siteContent.listen;
const S = siteContent.soundtrack;
const HOME = "/?wavedebug";
type W = Window & { __wavePath: PathProbe };
const frame = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.frame()!);
const band = (page: Page) => page.locator("#listen");
const accept = (page: Page) => band(page).getByRole("button", { name: L.accept, exact: true });
const decline = (page: Page) => band(page).getByRole("button", { name: L.decline, exact: true });

// Past the hand-off line with the music playing: the player has collapsed into the pill.
async function collapsedPill(page: Page) {
  await playFromBand(page);
  await bandPastLine(page, 60);
  await expect(page.locator(PLAYER_PILL)).toHaveAttribute("data-player-pill", "collapsed");
  return page.locator(PLAYER_PILL);
}

async function hoverOpen(page: Page) {
  const pill = page.locator(PLAYER_PILL);
  const box = (await pill.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await expect(pill).toHaveAttribute("data-player-pill", "open");
  // The grow runs 340ms; the player is whole after it.
  await expect.poll(async () => (await pill.boundingBox())!.width).toBe(ISLE.openWidthPx);
  return pill;
}

test.describe("the player in the band", () => {
  test("player: Play it opens the full player in the band, with no status line, no Pause button and no credit line", async ({ page }) => {
    await openHome(page, { path: HOME });
    await playFromBand(page);
    const player = page.locator(BAND_CARD).getByRole("group", { name: P.groupLabel });
    await expect(player).toBeVisible();
    await expect(player.getByRole("slider", { name: S.ariaSeek })).toBeVisible();
    await expect(player.locator("[data-player-elapsed]")).toHaveText(/^\d+:\d{2}$/);
    await expect(player.locator("[data-player-remaining]")).toHaveText(/^-\d+:\d{2}$/);
    for (const name of [S.ariaPrevious, S.ariaPause, S.ariaNext, P.shuffle, P.repeat.all]) await expect(player.getByRole("button", { name, exact: true })).toBeVisible();
    await expect(player.getByRole("button", { name: P.showTracks })).toBeVisible();

    // The heading stays; the status sentence, its Pause and the credit line do not.
    await expect(band(page).getByRole("heading", { name: L.line })).toBeVisible();
    await expect(band(page).locator("[data-band-note]")).toBeHidden();
    await expect(band(page).locator("[data-band-controls]")).toBeHidden();
    await expect(page.getByText(/credited to their artists/)).toHaveCount(0);
    // The one freeze there is while the music plays stays in the band.
    await expect(band(page).getByRole("button", { name: L.freeze, exact: true })).toBeVisible();
  });

  test("player: the transport works from the band: pause and resume, next track, shuffle and repeat", async ({ page }) => {
    await openHome(page, { path: HOME });
    await playFromBand(page);
    const player = page.locator(BAND_CARD);
    const title = () => player.locator("[data-marquee-track]").first().innerText();
    expect(await title()).toBe(S.tracks[0].title);
    await player.getByRole("button", { name: S.ariaNext, exact: true }).click();
    await expect.poll(title).toBe(S.tracks[1].title);
    await player.getByRole("button", { name: S.ariaPause, exact: true }).click();
    await expect(player.getByRole("button", { name: S.ariaPlay, exact: true })).toBeVisible();
    await player.getByRole("button", { name: S.ariaPlay, exact: true }).click();
    await expect(player.getByRole("button", { name: S.ariaPause, exact: true })).toBeVisible();
    await player.getByRole("button", { name: P.shuffle, exact: true }).click();
    await expect(player.getByRole("button", { name: P.shuffle, exact: true })).toHaveAttribute("aria-pressed", "true");
    await player.getByRole("button", { name: P.repeat.all, exact: true }).click();
    await expect(player.getByRole("button", { name: P.repeat.one, exact: true })).toBeVisible();
    await player.getByRole("button", { name: P.showTracks }).click();
    await expect(player.getByRole("list", { name: P.tracks }).getByRole("listitem")).toHaveCount(S.tracks.length);
  });

  test("player: Not now shows Play it and Freeze the wave beside the No problem line, and no lone freeze link", async ({ page }) => {
    await openHome(page, { path: HOME });
    await parkBand(page);
    await decline(page).click();
    const note = band(page).locator("[data-band-note] > :not([inert])");
    await expect(note).toContainText(L.declinedNote);
    await expect(note.getByRole("button", { name: L.accept, exact: true })).toBeVisible();
    await expect(note.getByRole("button", { name: L.freeze, exact: true })).toBeVisible();
    // The note's two buttons are the only freeze: the band's own link is out of the tree.
    await expect(band(page).getByRole("button", { name: L.freeze, exact: true })).toHaveCount(1);
    await note.getByRole("button", { name: L.freeze, exact: true }).click();
    await expect(note.getByRole("button", { name: L.unfreeze, exact: true })).toBeVisible();
    await note.getByRole("button", { name: L.accept, exact: true }).click();
    await expect(page.locator(BAND_CARD)).toBeVisible();
  });
});

test.describe("the hand-off to the pill and back", () => {
  test("player: past the release line the player morphs into the pill on its dock, and the band gives up its card", async ({ page }) => {
    await openHome(page, { path: HOME });
    await playFromBand(page);
    // Short of the line the card stays and no pill shows.
    await bandPastLine(page, -60);
    await expect(page.locator(BAND_CARD)).toBeVisible();
    await expect(page.locator(PLAYER_PILL)).toHaveCount(0);

    const card = (await page.locator(BAND_CARD).boundingBox())!;
    await recordMorph(page, 1500);
    await bandPastLine(page, 60);
    const pill = page.locator(PLAYER_PILL);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
    await expect(page.locator(BAND_CARD)).toBeHidden();

    const samples = await morphSamples(page);
    const flying = samples.filter((s) => s.visible);
    expect(flying.length, "frames the glass was in flight").toBeGreaterThan(5);
    expect(flying.some((s) => s.width > ISLE.widthPx + 1 && s.width < card.width - 1), "a size between the card and the pill").toBe(true);
    expect(flying.some((s) => s.height > ISLE.heightPx + 1 && s.height < card.height - 1), "a height between the card and the pill").toBe(true);

    const rest = (await pill.boundingBox())!;
    expect(rest.x).toBeCloseTo(ISLE.insetPx, 0);
    expect(rest.x + rest.width / 2).toBeCloseTo(ISLE.insetPx + ISLE.widthPx / 2, 0);
    expect(rest.y + rest.height).toBeCloseTo(viewportHeight(page) - ISLE.bottomPx, 0);
    expect(rest.height).toBeCloseTo(ISLE.heightPx, 0);
    // Collapsed it is the cover, the title, the artist and the note.
    await expect(pill.locator("[data-player-pill-face]")).toBeVisible();
    await expect(pill.locator("[data-player-pill-face] img")).toBeVisible();
    await expect(pill.locator("[data-player-pill-face] svg[data-note]")).toHaveAttribute("data-note", "playing");
    await expect(pill.locator("[data-player-pill-face]").getByText(S.tracks[0].title)).toBeVisible();
    await expect(pill.locator("[data-player-pill-face]").getByText(S.tracks[0].artist)).toBeVisible();
  });

  test("player: scrolling back up reopens the player in the band", async ({ page }) => {
    await openHome(page, { path: HOME });
    await collapsedPill(page);
    await recordMorph(page, 1500);
    await bandPastLine(page, -60);
    await expect(page.locator(BAND_CARD)).toBeVisible();
    await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
    await expect(band(page).locator("[data-band-note]")).toBeHidden();
    expect((await morphSamples(page)).filter((s) => s.visible).length, "frames the glass was in flight").toBeGreaterThan(5);
    // Down again and back: the same round trip.
    await bandPastLine(page, 60);
    await expect(page.locator(PLAYER_PILL)).toHaveAttribute("data-player-pill", "collapsed");
  });

  test("player: reduced motion hands off with no morph, and the wave is a still line", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(HOME);
    await settled(page);
    await page.waitForFunction(() => ((window as unknown as W).__wavePath.frame()?.length ?? 0) > 0);
    await playFromBand(page);
    await recordMorph(page, 1500);
    await bandPastLine(page, 60);
    await expect(page.locator(PLAYER_PILL)).toHaveAttribute("data-player-pill", "collapsed", { timeout: 1500 });
    await page.waitForTimeout(500);
    expect((await morphSamples(page)).filter((s) => s.visible), "frames the glass flew").toEqual([]);
    await expect(page.locator(CLONE)).toBeHidden();
    // The line is drawn whole and nothing loops.
    const f = await frame(page);
    expect(f.head).toBe(f.length);
    expect(f.idle).toBe(0);
    await bandPastLine(page, -60);
    await expect(page.locator(BAND_CARD)).toBeVisible();
    await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
  });
});

test.describe("the pill", () => {
  test("player: hovering the pill opens the full player, and leaving folds it back", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    await expect(pill.getByRole("slider", { name: S.ariaSeek })).toBeVisible();
    await expect(pill.getByRole("button", { name: P.showTracks })).toBeVisible();
    await page.mouse.move(700, 200);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
    await expect.poll(async () => (await pill.boundingBox())!.width).toBe(ISLE.widthPx);
  });

  test("player: a cursor that only passes over the pill does not open it", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    const box = (await pill.boundingBox())!;
    await page.mouse.move(box.x - 30, box.y + box.height / 2);
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 2 });
    await page.mouse.move(box.x - 30, box.y + box.height / 2);
    await page.waitForTimeout(400);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
  });

  test("player: an opened pill folds after the idle wait with the pointer resting on it, and opens again when the pointer moves", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    const opened = Date.now();
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed", { timeout: PILL_IDLE_MS + 2500 });
    const waited = Date.now() - opened;
    expect(waited, "ms from open to fold").toBeGreaterThan(PILL_IDLE_MS - 600);
    expect(waited).toBeLessThan(PILL_IDLE_MS + 2000);
    const box = (await pill.boundingBox())!;
    await page.mouse.move(box.x + 70, box.y + box.height / 2 + 3);
    await expect(pill).toHaveAttribute("data-player-pill", "open");
  });

  test("player: a pill pinned by a click folds after the idle wait even with the pointer gone", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    const box = (await pill.boundingBox())!;
    await page.mouse.click(box.x + 30, box.y + 30);
    await expect(pill).toHaveAttribute("data-player-pill", "pinned");
    await page.mouse.move(700, 200);
    // A pin outlasts the pointer leaving, which a plain hover does not.
    await page.waitForTimeout(1500);
    await expect(pill).toHaveAttribute("data-player-pill", "pinned");
    const left = Date.now();
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed", { timeout: PILL_IDLE_MS + 2500 });
    expect(Date.now() - left + 1500, "ms from the last touch to the fold").toBeGreaterThan(PILL_IDLE_MS - 600);
  });

  test("player: moving the pointer inside the pill keeps it open past the idle wait", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    const box = (await pill.boundingBox())!;
    for (let i = 0; i < 7; i++) {
      await page.mouse.move(box.x + 60 + (i % 2) * 40, box.y + 30 + (i % 3) * 6);
      await page.waitForTimeout(1000);
    }
    await expect(pill).toHaveAttribute("data-player-pill", "open");
  });

  test("player: keyboard focus holds the pill open past the idle wait, and Escape folds it", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await page.mouse.move(700, 200);
    await page.keyboard.press("Tab");
    await pill.locator("[data-player-pill-face]").focus();
    await expect(pill).toHaveAttribute("data-player-pill", "open");
    await expect.poll(() => pill.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await expect.poll(async () => (await pill.boundingBox())!.width).toBe(ISLE.openWidthPx);
    await page.waitForTimeout(PILL_IDLE_MS + 1500);
    expect((await pill.boundingBox())!.width, "still open after the idle wait").toBe(ISLE.openWidthPx);
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await pill.boundingBox())!.width).toBe(ISLE.widthPx);
  });

  test("player: Escape folds a hover-opened pill at once", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    await page.keyboard.press("Escape");
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
    // The pointer still rests on it, and the movement that follows an Escape does not reopen it.
    const box = (await pill.boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + box.height / 2 + 2);
    await page.waitForTimeout(500);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
  });

  test("player: a press outside folds a pinned pill", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    const box = (await pill.boundingBox())!;
    await page.mouse.click(box.x + 30, box.y + 30);
    await expect(pill).toHaveAttribute("data-player-pill", "pinned");
    await page.mouse.click(900, 200);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
  });

  test("player: a seek that is being dragged holds the pill open, and the idle wait starts again at its end", async ({ page }) => {
    await openHome(page, { path: HOME });
    const pill = await collapsedPill(page);
    await hoverOpen(page);
    const seek = (await pill.getByRole("slider", { name: S.ariaSeek }).boundingBox())!;
    await page.mouse.move(seek.x + 20, seek.y + seek.height / 2);
    await page.mouse.down();
    await page.mouse.move(seek.x + seek.width / 2, seek.y + seek.height / 2, { steps: 6 });
    await page.waitForTimeout(PILL_IDLE_MS + 1500);
    await expect(pill).toHaveAttribute("data-player-pill", "open");
    // Out of the pill with the button still down: still the visitor's hand on it.
    await page.mouse.move(700, 200, { steps: 6 });
    await page.waitForTimeout(800);
    expect((await pill.boundingBox())!.width).toBe(ISLE.openWidthPx);
    await page.mouse.up();
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed", { timeout: PILL_IDLE_MS + 2500 });
  });
});

test.describe("where the player lives", () => {
  test("player: a window too narrow for the band's card docks the player at the pill's place instead", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openHome(page, { path: HOME });
    await parkBand(page);
    await accept(page).click();
    const pill = page.locator(PLAYER_PILL);
    await expect(pill).toHaveAttribute("data-player-pill", "pinned");
    await expect(page.locator(BAND_CARD)).toHaveCount(0);
    // With no card in the band the band keeps its own status line and Pause.
    await expect(band(page).locator("[data-band-note]")).toBeVisible();
    await expect(band(page).locator('[data-control="on"]')).toBeVisible();
    await expect(pill.getByRole("slider", { name: S.ariaSeek })).toBeVisible();
  });

  test("player: a restored pause resumes from the band's Resume with the player opening there", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit cannot be launched muted");
    await page.addInitScript(() => localStorage.setItem("aaron-soundtrack", "on"));
    await openHome(page, { path: HOME });
    await parkBand(page);
    await expect(band(page).locator('[data-control="paused"]')).toBeVisible();
    await expect(page.locator(BAND_CARD)).toHaveCount(0);
    await band(page).locator('[data-control="paused"]').click();
    await expect(page.locator(BAND_CARD).getByRole("button", { name: S.ariaPause, exact: true })).toBeVisible();
    await expect(band(page).locator("[data-band-note]")).toBeHidden();
  });

  test("player: crossing to a phone width swaps the pill for the island, and back", async ({ page }) => {
    await openHome(page, { path: HOME });
    await collapsedPill(page);
    // The page lays out again at each width, so the reader is put below the band again before looking.
    const below = async () => scrollToY(page, Math.round(await documentTop(page, "#about")));
    await page.setViewportSize({ width: 393, height: 852 });
    await below();
    await expect(page.locator(ISLAND)).toHaveAttribute("data-player-island", "closed");
    await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await below();
    await expect(page.locator(PLAYER_PILL)).toHaveAttribute("data-player-pill", "collapsed");
    await expect(page.locator(ISLAND)).toHaveCount(0);
  });

  test("player: the music keeps its control on the MVP page, and the player is where it was left", async ({ page }) => {
    await openHome(page, { path: HOME });
    await playFromBand(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: "MVP", exact: true }).click();
    await page.waitForURL("**/quick", { timeout: 20_000 });
    const pill = page.locator(PLAYER_PILL);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
    // No hero here, so no lift for the toggle that is not there.
    await expect(pill).not.toHaveAttribute("data-player-lifted", "true");
    await expect(pill.locator("svg[data-note]").first()).toHaveAttribute("data-note", "playing");
    const box = (await pill.boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + box.height / 2);
    await expect(pill).toHaveAttribute("data-player-pill", "open");
    await pill.getByRole("button", { name: S.ariaPause, exact: true }).click();
    await expect(pill.getByRole("button", { name: S.ariaPlay, exact: true })).toBeVisible();
  });
});

test.describe("the pill above the band", () => {
  test("player: with music playing and the reader back in the hero, the pill stands clear of the Coil and Band toggle", async ({ page }) => {
    await openHome(page, { path: HOME });
    await collapsedPill(page);
    await scrollToY(page, 0);
    const pill = page.locator(PLAYER_PILL);
    await expect(pill).toBeVisible();
    await expect(pill).toHaveAttribute("data-player-lifted", "true");
    const toggle = page.locator(TOGGLE);
    await expect(toggle).toBeVisible();
    await expect.poll(async () => (await pill.boundingBox())!.y + ISLE.heightPx).toBeCloseTo(viewportHeight(page) - ISLE.bottomPx - HERO_LIFT_PX, 0);
    const [a, b] = [(await pill.boundingBox())!, (await toggle.boundingBox())!];
    const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    expect(overlap, `pill ${JSON.stringify(a)} against toggle ${JSON.stringify(b)}`).toBe(false);
    expect(b.y - (a.y + a.height), "the gap between them, px").toBeGreaterThanOrEqual(14);
    // Hovering it there opens the full player, and the toggle still takes a click.
    await hoverOpen(page);
    await page.mouse.move(700, 120);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed");
    await toggle.getByRole("button", { name: siteContent.hero.shapeToggle.band }).click();
    await expect(toggle).toHaveAttribute("data-state", "band");
  });

  test("player: it stays through the book and comes back to the band's card as the band arrives", async ({ page }) => {
    await openHome(page, { path: HOME });
    await collapsedPill(page);
    await scrollToY(page, Math.round(await documentTop(page, "#work")));
    await expect(page.locator(PLAYER_PILL)).toBeVisible();
    await expect(page.locator(BAND_CARD)).toBeHidden();
    await parkBand(page);
    await expect(page.locator(BAND_CARD)).toBeVisible();
    await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
  });

  test("player: music started below the band opens the player pinned at the dock, and it folds when left alone", async ({ page }) => {
    await openHome(page, { path: HOME });
    await scrollToY(page, Math.round(await documentTop(page, "#about")));
    const capsule = page.locator("[data-pill] .pill-hit");
    await expect(capsule).toBeVisible();
    await capsule.click();
    const pill = page.locator(PLAYER_PILL);
    await expect(pill).toHaveAttribute("data-player-pill", "pinned");
    await expect(pill.getByRole("slider", { name: S.ariaSeek })).toBeVisible();
    await page.mouse.move(700, 200);
    await expect(pill).toHaveAttribute("data-player-pill", "collapsed", { timeout: PILL_IDLE_MS + 2500 });
    // The stock capsule has stepped away for it.
    await expect(page.locator("[data-pill]")).toHaveAttribute("inert", "");
  });

  test("player: with no music, nothing of the player shows above or below the band", async ({ page }) => {
    await openHome(page, { path: HOME });
    for (const y of [0, Math.round(await documentTop(page, "#work")), Math.round(await documentTop(page, "#numbers"))]) {
      await scrollToY(page, y);
      await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
    }
    await expect(page.locator(BAND_CARD)).toHaveCount(0);
  });
});

test.describe("the Menu", () => {
  for (const playing of [false, true]) {
    test(`player: the Menu pill and panel carry no soundtrack control${playing ? ", with music playing" : ""}`, async ({ page }) => {
      await openHome(page, { path: HOME });
      if (playing) await playFromBand(page);
      const pill = page.locator("[data-menu-pill]");
      await expect(pill.getByRole("button")).toHaveCount(1);
      await expect(pill.locator("svg[data-note]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Play my soundtrack" })).toHaveCount(0);
      await pill.getByRole("button", { name: "Open menu" }).click();
      const panel = page.getByRole("dialog", { name: "Site menu" });
      await expect(panel).toBeVisible();
      await expect(panel.locator("svg[data-note]")).toHaveCount(0);
      await expect(panel.getByRole("button", { name: /soundtrack|music|play|pause/i })).toHaveCount(0);
      await expect(panel.locator("button[aria-pressed]")).toHaveCount(0);
      // What is there is the theme chip, the quick view link and the contact row.
      await expect(panel.getByRole("button", { name: /mode/i })).toBeVisible();
    });
  }
});

test.describe("the wave as one line", () => {
  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 393, height: 852 }]) {
    test(`player: no ink of the path lands in the band, and the band's own run stays whole, at ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openHome(page, { path: HOME });
      await parkBand(page);
      await decline(page).click();
      // Held: the band is still in view, so nothing of the path is drawn yet.
      await page.waitForTimeout(600);
      expect((await frame(page)).gated).toBe(true);
      expect((await pathInk(page)).painted, "path ink while the answer is held").toBe(0);
      const ripple = (await frame(page)).ripple;
      expect(ripple, "no ripple before the release").toBe(0);

      // Released: the band's bottom edge above 0.4 of the viewport, still partly on screen.
      await bandPastLine(page, 40);
      await expect.poll(async () => (await frame(page)).gated).toBe(false);
      await expect.poll(async () => (await pathInk(page)).painted, { message: "the path's ink once released" }).toBeGreaterThan(200);
      const ink = await pathInk(page);
      expect(ink.minY!, `topmost path ink against the band's bottom edge ${ink.bandBottom}`).toBeGreaterThanOrEqual(ink.bandBottom - 1);
      // The band's run is still drawn, whole, although the head has gone on.
      await page.waitForTimeout(600);
      expect(await bandInkPixels(page), "the band's own ink after the release").toBeGreaterThan(500);
      const f = await frame(page);
      expect(f.head).toBeGreaterThan(f.runLen);
    });
  }

  test("player: an answer pressed in the band holds the wave, then the line follows and the ripple goes out at the release", async ({ page }) => {
    await openHome(page, { path: HOME });
    await parkBand(page);
    await accept(page).click();
    await page.waitForTimeout(500);
    let f = await frame(page);
    expect(f.decided, "the wave held").toBe(false);
    expect(f.head).toBe(f.runLen);
    expect(f.ripple).toBe(0);
    await bandPastLine(page, 60);
    await expect.poll(async () => (await frame(page)).decided).toBe(true);
    await expect.poll(async () => (await frame(page)).ripple, { timeout: 500, message: "the kept ripple" }).toBeGreaterThan(0);
    f = await frame(page);
    expect(f.gated).toBe(false);
  });

  test("player: the idle ripple runs while the line is held, declined or paused, stops frozen, and steps aside for the music", async ({ page }) => {
    await openHome(page, { path: HOME });
    await parkBand(page);
    await page.mouse.move(4, 4);
    await decline(page).click();
    await expect.poll(async () => (await frame(page)).idle, { message: "the idle ripple while declined and held" }).toBeGreaterThan(0.9);
    // It moves: the band repaints through a second.
    const paints = () => page.evaluate(() => (window as unknown as W).__wavePath.paints);
    const moving = await paints();
    await page.waitForTimeout(1000);
    expect((await paints()) - moving, "repaints in a second of idle ripple").toBeGreaterThan(10);
    // Frozen, it stops: nothing repaints.
    await band(page).locator("[data-band-note]").getByRole("button", { name: L.freeze, exact: true }).click();
    await page.waitForTimeout(400);
    const still = await paints();
    await page.waitForTimeout(1000);
    expect(await paints(), "repaints in a frozen second").toBe(still);
    await band(page).locator("[data-band-note]").getByRole("button", { name: L.unfreeze, exact: true }).click();
    await band(page).locator("[data-band-note]").getByRole("button", { name: L.accept, exact: true }).click();
    // Held until the band has scrolled away, the music does not take the line over yet.
    await page.waitForTimeout(800);
    expect((await frame(page)).idle).toBeGreaterThan(0.9);
    // Released, it does: the idle ripple fades out as the music's share rises.
    await bandPastLine(page, 60);
    await expect.poll(async () => (await frame(page)).idle, { timeout: 6000 }).toBeLessThan(0.5);
    const pill = await hoverOpen(page);
    await pill.getByRole("button", { name: S.ariaPause, exact: true }).click();
    await expect.poll(async () => (await frame(page)).idle, { timeout: 6000, message: "the ripple back with no music" }).toBeGreaterThan(0.9);
  });
});

test("player: past the footer's top edge the pill rides 14px above it", async ({ page }) => {
  await openHome(page, { path: HOME });
  await collapsedPill(page);
  await toFooter(page);
  await waitForWord(page);
  const pill = page.locator(PLAYER_PILL);
  await expect.poll(async () => {
    const [p, f] = [(await pill.boundingBox())!, (await page.locator("footer[data-footer]").boundingBox())!];
    return Math.round(f.y - (p.y + p.height));
  }).toBeGreaterThanOrEqual(13);
  expect(await pillState(page)).toBe("collapsed");
  // The period under it takes a click, and the word plays its hop.
  const egg = page.getByRole("button", { name: siteContent.footer.dropPeriod });
  const at = (await egg.boundingBox())!;
  const covered = await page.evaluate(([x, y]) => !document.elementFromPoint(x, y)?.closest("[data-egg]"), [at.x + at.width / 2, at.y + at.height / 2]);
  expect(covered, "the period's button is not under the pill").toBe(false);
  await egg.click();
  await waitForWord(page, "moving");
  await waitForWord(page);
});
