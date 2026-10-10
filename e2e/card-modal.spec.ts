import { siteContent, strandCardByKey, type CardKey } from "@/lib/content";
import { headerTileOf } from "@/lib/gallery/card";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome } from "./support/coil";
import { decodePng } from "./support/pixels";
import { barScale, fillOf, rest } from "./support/inline";
import { cardDialog, flyCard, openCardFromBook, panelAtRest } from "./support/cards";
import type { HookWindow } from "./support/hooks";

const keys = Object.keys(siteContent.cards) as CardKey[];
const within = (actual: number, expected: number) => Math.abs(actual - expected) < 1;

// The flown card's four corners against its slot's box: where it parked, or
// with now, where the scene draws it this frame (parked, its pose is the slot's,
// flat, so its corners are the parked card's).
async function landsOnSlot(page: import("@playwright/test").Page, slot: import("@playwright/test").Locator, { now = false } = {}) {
  const quad = await page.evaluate((current) => {
    const flight = (window as HookWindow).__coilFlight!;
    return (current ? flight.scene.flown()!.quad : flight.log.findLast((m) => m.name === "clone-parked")!.data!.quad) as { x: number; y: number }[];
  }, now);
  const box = (await slot.boundingBox())!;
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  expect(Math.abs(Math.min(...xs) - box.x), "left").toBeLessThan(1);
  expect(Math.abs(Math.max(...xs) - (box.x + box.width)), "right").toBeLessThan(1);
  expect(Math.abs(Math.min(...ys) - box.y), "top").toBeLessThan(1);
  expect(Math.abs(Math.max(...ys) - (box.y + box.height)), "bottom").toBeLessThan(1);
  return box;
}

test("card modal: every card opens from its row as its own modal, Escape closes it, focus returns and the card reads as seen", async ({ page }) => {
  await openHome(page);
  for (const key of keys) {
    const { row, dialog } = await openCardFromBook(page, key, { home: false });
    await expect(dialog).toHaveAttribute("data-card-modal", key);
    const photoCard = strandCardByKey.get(key)!.face.kind === "photo";
    await expect(dialog.locator('[data-tile-slot="photo"]')).toHaveCount(photoCard ? 1 : 0);
    await expect(dialog.locator('[data-tile-slot="work"]')).toHaveCount(photoCard ? 0 : 1);
    await expect(dialog.locator("h2")).toHaveText(siteContent.cards[key].modal.title);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
  }
  const seen: string[] = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "[]"), SEEN_STORAGE_KEY);
  expect([...seen].sort()).toEqual([...keys].sort());
});

test("card modal: a book row opens with no flight and draws its own card", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "talos");
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  await expect(dialog.locator('[data-tile-slot="work"] [data-face="logo"]')).toBeVisible();
  await page.keyboard.press("Escape");
  const misuki = await openCardFromBook(page, "misuki", { home: false });
  const picture = misuki.dialog.locator('[data-tile-slot="photo"] img');
  await expect(picture).toHaveCSS("opacity", "1");
  await expect(picture).toHaveAttribute("alt", "Me standing behind Misuki, my 2001 Miata, on a parking deck at golden hour");
  await expect(misuki.dialog.getByText("Me and Misuki at a Longhorn Car Club photo shoot.", { exact: true })).toBeVisible();
});

test("card modal: in the dark theme Capital One's header tile shows its white logo with no plate, and IEEE's face is its own navy", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const { dialog } = await openCardFromBook(page, "capital-one");
  const tile = dialog.locator('[data-tile-slot="work"]');
  await expect(tile.locator("[data-plate]")).toHaveCount(0);
  await expect(tile.locator('img[src$="capital-one-logo-white.svg"]')).toBeVisible();
  await expect(tile.locator('img[src$="capital-one-logo.svg"]')).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const ieee = await openCardFromBook(page, "ieee", { home: false });
  await expect(ieee.dialog.locator("[data-plate]")).toHaveCount(0);
  await expect(ieee.dialog.locator('[data-tile-slot="work"] [data-face="logo"]')).toHaveCSS("background-color", "rgb(20, 24, 62)");
  await page.keyboard.press("Escape");
  // The theme is chosen before paint from the preference, so a fresh load reads the new one.
  await page.emulateMedia({ colorScheme: "light" });
  const light = await openCardFromBook(page, "capital-one");
  await expect(light.dialog.locator('[data-tile-slot="work"] img[src$="capital-one-logo-white.svg"]')).toBeHidden();
  await expect(light.dialog.locator('[data-tile-slot="work"] img[src$="capital-one-logo.svg"]')).toBeVisible();
  await page.keyboard.press("Escape");
  const ieeeLight = await openCardFromBook(page, "ieee", { home: false });
  await expect(ieeeLight.dialog.locator('[data-tile-slot="work"] [data-face="logo"]')).toHaveCSS("background-color", "rgb(20, 24, 62)");
});

test("card modal: IEEE's meta carries its AO tip beside the rows, and a card's links open in a new tab", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "ieee", { settled: true });
  const meta = dialog.locator('[data-mask="meta"]');
  await expect(meta).toHaveText("President, Corporate Director, and AO, 2023 to 2026");
  const ao = meta.getByRole("button", { name: "AO", exact: true });
  await ao.hover();
  const tip = page.locator("[data-inline-tip]");
  await expect(tip).toHaveAttribute("data-shown", "true");
  await expect(tip).toContainText("External Activities and Events Assistant Officer");
  const link = dialog.getByRole("link", { name: /ieee\.ece\.utexas\.edu/ });
  await expect(link).toHaveAttribute("href", "https://ieee.ece.utexas.edu/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("card modal: the mentors are a section of Mentorship's modal, six names linking to LinkedIn", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  const mentors = dialog.locator("[data-mentors]");
  const { title, people } = siteContent.cards.mentorship.mentors;
  await expect(mentors.getByRole("heading", { name: title })).toBeVisible();
  await expect(mentors.getByRole("link")).toHaveCount(people.length);
  await expect(mentors.getByRole("link", { name: new RegExp(people[0].name) })).toHaveAttribute("href", people[0].href);
});

test("card modal: the jobs timeline runs oldest to newest, each employer's name its insider tip", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "jobs");
  await expect(dialog.locator("[data-timeline-entry]")).toHaveCount(5);
  const apple = dialog.getByRole("button", { name: "Apple", exact: true });
  await apple.scrollIntoViewIfNeeded();
  await apple.hover();
  const tip = page.locator("[data-inline-tip]");
  await expect(tip).toHaveAttribute("data-shown", "true");
  await expect(tip).toContainText("Get AppleCare and some sort of cloud storage.");
});

for (const kind of ["photo", "work"] as const) {
  test(`card modal: a flown ${kind} card lands exactly on its slot`, async ({ page, cdp }) => {
    const key = await flyCard(page, cdp, kind);
    const dialog = cardDialog(page, key);
    await expect(dialog).toBeVisible();
    await panelAtRest(page, key);
    await landsOnSlot(page, dialog.locator(`[data-tile-slot="${kind}"]`));
    if (kind === "photo") await expect(dialog.locator('[data-tile-slot="photo"] img')).toHaveCSS("opacity", "0");
    else await expect(dialog.locator('[data-tile-slot="work"] [data-face]')).toHaveCount(0);
  });
}

test("card modal: the layout holds while a flown card is parked, the card staying on its slot, and an open modal follows the window once none is", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo");
  const dialog = cardDialog(page, key);
  await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
  await panelAtRest(page, key);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(400);
  await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
  await expect(page.locator("[data-flying-tile]")).toHaveCount(1);
  await landsOnSlot(page, dialog.locator('[data-tile-slot="photo"]'), { now: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { dialog: again } = await openCardFromBook(page, key, { home: false });
  await expect(again).toHaveAttribute("data-gallery-layout", "rows");
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(again).toHaveAttribute("data-gallery-layout", "pager");
});

test("card modal: under 1024px a mouse click still flies the card, onto the phone header's tile", async ({ page, cdp }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  for (const kind of ["photo", "work"] as const) {
    const key = await flyCard(page, cdp, kind);
    const dialog = cardDialog(page, key);
    await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
    await panelAtRest(page, key);
    const slot = dialog.locator(`[data-tile-slot="${kind}"]`);
    await expect(slot).toHaveCount(1);
    const box = await landsOnSlot(page, slot);
    const tile = headerTileOf(key, true);
    expect(within(box.width, tile.width) && within(box.height, tile.height), `${key}: ${box.width} by ${box.height}`).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  }
});

// Which card each kind is tested with: one whose modal scrolls at 1440 by 600.
const TALL = { photo: "band", work: "capital-one" } as const;

for (const kind of ["photo", "work"] as const) {
  test(`card modal: scrolling the open dialog moves a parked ${kind} card with its slot, and closing flies it home from there`, async ({ page, cdp }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    const key = await flyCard(page, cdp, kind, { only: TALL[kind] });
    const dialog = cardDialog(page, key);
    await panelAtRest(page, key);
    const slot = dialog.locator(`[data-tile-slot="${kind}"]`);
    expect(await dialog.evaluate((el) => el.scrollHeight - el.clientHeight), "the dialog has room to scroll").toBeGreaterThan(300);
    const before = await landsOnSlot(page, slot, { now: true });
    const sharp = page.locator("[data-flying-tile] > div").nth(1);

    await page.mouse.move(720, 400);
    for (const dy of [60, 60, 60, 60, 60, 60]) {
      await page.mouse.wheel(0, dy);
      await nextFrames(page, 2);
      if (await sharp.count()) expect(await sharp.evaluate((el) => el.getBoundingClientRect().top)).toBeCloseTo((await slot.boundingBox())!.y, 0);
      await landsOnSlot(page, slot, { now: true });
    }
    await expect.poll(() => dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
    await page.waitForTimeout(300);
    const parked = await landsOnSlot(page, slot, { now: true });
    expect(before.y - parked.y, "the slot moved up with the dialog").toBeGreaterThan(300);
    for (let frame = 0; frame < 5; frame++) {
      await nextFrames(page, 1);
      await landsOnSlot(page, slot, { now: true });
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.waitForFunction(() => (window as HookWindow).__coilFlight!.log.some((m) => m.name === "clone-landed"));
    await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
    const firstHome = await page.evaluate(() => {
      const log = (window as HookWindow).__coilFlight!.log;
      const start = log.findIndex((m) => m.name === "flight-start" && (m.data as { phase?: string } | undefined)?.phase === "closing");
      const frame = log.slice(start).find((m) => m.name === "clone-frame");
      return (frame!.data!.quad as { y: number }[]).map((p) => p.y);
    });
    expect(Math.abs(Math.min(...firstHome) - parked.y), "home starts from the scrolled slot, not where the card landed").toBeLessThan(Math.abs(before.y - parked.y) / 2);
  });
}

// The card drawn a frame behind the compositor moved the slot: with the slot
// outlined in magenta, a card that lags covers a strip of the outline in the
// frame the dialog scrolls. Real wheel input at the display's rate, every frame
// the compositor produced counted; the slot stays in view throughout.
for (const [kind, notch, notches] of [["photo", 25, 6], ["work", 15, 3]] as const) {
  test(`card modal: a parked ${kind} card never trails its slot in any frame of a scroll`, async ({ page, cdp }) => {
    const key = await flyCard(page, cdp, kind, { only: TALL[kind] });
    const dialog = cardDialog(page, key);
    await panelAtRest(page, key);
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: '[data-tile-slot]{outline:6px solid #ff00ff !important}.z-\\[100\\]{visibility:hidden!important}' });
    await page.mouse.move(1300, 500);
    await nextFrames(page, 3);
    const frames: Buffer[] = [];
    cdp.on("Page.screencastFrame", async (frame: { data: string; sessionId: number }) => {
      frames.push(Buffer.from(frame.data, "base64"));
      await cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId });
    });
    await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
    await nextFrames(page, 4);
    for (let i = 0; i < notches; i++) {
      await page.mouse.wheel(0, notch);
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(400);
    await cdp.send("Page.stopScreencast");
    expect(await dialog.evaluate((el) => el.scrollTop)).toBe(notch * notches);
    const magenta = frames.map((png) => {
      const { width, height, rgba } = decodePng(png);
      let count = 0;
      for (let i = 0; i < width * height; i++) if (rgba[i * 4] > 225 && rgba[i * 4 + 1] < 40 && rgba[i * 4 + 2] > 225) count++;
      return count;
    });
    expect(frames.length, "frames captured").toBeGreaterThan(notches);
    const rest = magenta[0];
    expect(rest, "the outline is on screen").toBeGreaterThan(1000);
    magenta.forEach((count, i) => expect(Math.abs(count - rest) / rest, `frame ${i}: ${count} outline px against ${rest} at rest`).toBeLessThan(0.03));
  });
}

test("card modal: a card's links are inline links, a line at rest that fills from the centre on hover and stays filled once followed", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "ieee", { settled: true });
  const link = dialog.getByRole("link", { name: /ieee\.ece\.utexas\.edu/ });
  await expect(link).toHaveClass(/\binline-link\b/);
  await expect(link).toHaveAttribute("data-inline", "external");
  const item = link.locator("xpath=..");
  await expect(item).toHaveClass(/font-label/);
  await expect(item).toHaveClass(/text-accent/);
  await expect(link.locator(".sr-only")).toHaveText(`, ${siteContent.book.externalLabel}`);
  await link.scrollIntoViewIfNeeded();
  await rest(page);
  expect(await fillOf(link)).toBe(0);
  expect(await barScale(link)).toBe(0);
  const line = await link.evaluate((el) => ({ height: getComputedStyle(el, "::before").height, token: getComputedStyle(document.documentElement).getPropertyValue("--inline-line-width").trim() }));
  expect(line.height).toBe(line.token);
  expect(["1.5px", "2px"]).toContain(line.token);
  expect(await link.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
  await link.hover();
  await expect.poll(() => fillOf(link)).toBe(1);
  expect(await barScale(link)).toBe(1);
  await rest(page);
  await expect.poll(() => fillOf(link)).toBe(0);

  const popup = page.context().waitForEvent("page");
  await link.click();
  await (await popup).close();
  expect(await page.evaluate(() => localStorage.getItem("aaron-inline-visited"))).toBe(JSON.stringify(["external:https://ieee.ece.utexas.edu/"]));
  await rest(page);
  await expect.poll(() => fillOf(link), { timeout: 1000 }).toBe(1);
  expect(await barScale(link)).toBe(1);
});
