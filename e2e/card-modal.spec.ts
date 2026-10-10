import { siteContent, strandCardByKey, type CardKey } from "@/lib/content";
import { headerTileOf } from "@/lib/gallery/card";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
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
