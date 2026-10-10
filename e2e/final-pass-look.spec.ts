import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession, Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { cardDialog, flyCard, openCardFromBook, panelAtRest } from "./support/cards";
import type { HookWindow } from "./support/hooks";

// The final pass, by hand and never in a normal run (FINAL_PASS_LOOK=1): the
// captures the controller looks at, written outside the repo.
const DIR = process.env.FINAL_PASS_LOOK_DIR ?? "/Users/asulbaran21/Personal Projects/.worktrees/final-pass-look";
const DESKTOP = { width: 1440, height: 900 };
const FACE_PADDING = 24;

test.skip(process.env.FINAL_PASS_LOOK !== "1", "manual capture");

async function hideCursor(page: Page) {
  await page.addStyleTag({ content: ".z-\\[100\\]{visibility:hidden!important}" });
}

async function openThemed(page: Page, theme: "light" | "dark", debug = "1", size = DESKTOP) {
  await page.setViewportSize(size);
  await page.emulateMedia({ colorScheme: theme });
  await openHome(page, { debug });
  await hideCursor(page);
}

async function shootCoilFace(page: Page, key: CardKey, file: string) {
  await page.evaluate((k) => (window as HookWindow).__coil!.api.focusCard(k), key);
  await page.waitForTimeout(1200);
  const slot = await page.evaluate((k) => {
    const slots = (window as HookWindow).__coilFlight!.scene.slots().filter((s) => s.key === k && s.alpha > 0.9);
    return slots.sort((a, b) => b.depth - a.depth)[0] ?? null;
  }, key);
  expect(slot, `${key} on screen`).not.toBeNull();
  const xs = slot!.grid.map((p) => p.x);
  const ys = slot!.grid.map((p) => p.y);
  const x = Math.max(0, Math.min(...xs) - FACE_PADDING);
  const y = Math.max(0, Math.min(...ys) - FACE_PADDING);
  const width = Math.min(DESKTOP.width - x, Math.max(...xs) + FACE_PADDING - x);
  const height = Math.min(DESKTOP.height - y, Math.max(...ys) + FACE_PADDING - y);
  await page.screenshot({ path: join(DIR, file), clip: { x, y, width, height } });
}

async function shootModalHeader(page: Page, key: CardKey, file: string) {
  const { dialog } = await openCardFromBook(page, key, { home: false, settled: true });
  await dialog.locator("[data-tile-slot]").locator("xpath=..").screenshot({ path: join(DIR, file) });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

test("final pass: the Capital One and IEEE faces on the Coil and in the modal header, dark", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });
  await openThemed(page, "dark", "flight");
  await shootCoilFace(page, "capital-one", "capital-one-coil-dark.png");
  await shootCoilFace(page, "ieee", "ieee-coil-dark.png");
  await shootModalHeader(page, "capital-one", "capital-one-modal-dark.png");
  await shootModalHeader(page, "ieee", "ieee-modal-dark.png");
});

test("final pass: the IEEE modal header, light", async ({ page }) => {
  test.setTimeout(60_000);
  mkdirSync(DIR, { recursive: true });
  await openThemed(page, "light");
  await shootModalHeader(page, "ieee", "ieee-modal-light.png");
});

for (const theme of ["light", "dark"] as const) {
  test(`final pass: the Connect list, ${theme}`, async ({ page }) => {
    test.setTimeout(60_000);
    mkdirSync(DIR, { recursive: true });
    await openThemed(page, theme);
    const connect = page.locator("#connect");
    await connect.scrollIntoViewIfNeeded();
    await scrollToY(page, await connect.evaluate((el) => el.getBoundingClientRect().top + window.scrollY - 40));
    await page.mouse.move(2, 2);
    await page.waitForTimeout(2500);
    await nextFrames(page, 5);
    await connect.screenshot({ path: join(DIR, `connect-${theme}.png`) });
  });
}

async function openMarkCard(page: Page, size = DESKTOP) {
  await openThemed(page, "dark", "1", size);
  await scrollToY(page, 600);
  const mark = page.locator("[data-mark-trigger]");
  const box = (await mark.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: siteContent.mark.dialogLabel });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 5000 }).toBe("1");
  await expect(dialog.locator('p[data-card="text"]').last()).toHaveCSS("opacity", "1");
  await page.mouse.move(2, 2);
  await page.waitForTimeout(600);
  return dialog;
}

test("final pass: the mark card settled, with its tip, a photo pop and a definition open, dark", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });
  const dialog = await openMarkCard(page);
  await page.screenshot({ path: join(DIR, "mark-modal-dark.png") });

  await dialog.getByRole("button", { name: "VoltaageArc", exact: true }).hover();
  await expect(page.locator("[data-inline-tip]")).toHaveAttribute("data-shown", "true");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(DIR, "mark-tip-open-dark.png") });
  await page.mouse.move(2, 2);
  await expect(page.locator("[data-inline-tip]")).toHaveAttribute("data-shown", "false");

  await dialog.getByRole("button", { name: "Catatumbo Lightning", exact: true }).hover();
  await expect(page.locator("[data-inline-tip] img")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DIR, "mark-pop-open-dark.png") });
  await page.mouse.move(2, 2);
  await expect(page.locator("[data-inline-tip]")).toHaveAttribute("data-shown", "false");

  await dialog.getByRole("button", { name: "Electrical and Computer Engineering", exact: true }).hover();
  await expect(page.locator("[data-inline-tip] img")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(DIR, "mark-pop-ece-dark.png") });
  await page.mouse.move(2, 2);
  await expect(page.locator("[data-inline-tip]")).toHaveAttribute("data-shown", "false");

  await dialog.getByRole("button", { name: "Voltage", exact: true }).click();
  const definition = page.getByRole("dialog", { name: "Voltage" });
  await expect(definition).toBeVisible();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(DIR, "mark-definition-open-dark.png") });
});

test("final pass: the mark card on a phone, dark", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });
  const dialog = await openMarkCard(page, { width: 390, height: 844 });
  await page.screenshot({ path: join(DIR, "mark-modal-phone-dark.png") });
  await dialog.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(DIR, "mark-modal-phone-bottom-dark.png") });
});

// The band's modal after a real flight from the Coil: landed, masks played, the
// card stayed with its slot when the dialog scrolls.
async function openBandFlown(page: Page, cdp: CDPSession, theme: "light" | "dark", size = DESKTOP) {
  await page.setViewportSize(size);
  await page.emulateMedia({ colorScheme: theme });
  const key = await flyCard(page, cdp, "photo", { only: "band" });
  await hideCursor(page);
  const dialog = cardDialog(page, key);
  await panelAtRest(page, key);
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 8000 });
  await page.mouse.move(8, 8);
  await page.waitForTimeout(800);
  return dialog;
}

for (const theme of ["dark", "light"] as const) {
  test(`final pass: the band's modal after the flight, ${theme}`, async ({ page, cdp }) => {
    test.setTimeout(120_000);
    mkdirSync(DIR, { recursive: true });
    const dialog = await openBandFlown(page, cdp, theme);
    await page.screenshot({ path: join(DIR, `band-modal-${theme}.png`) });
    if (theme === "dark") {
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(700);
      expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
      await page.screenshot({ path: join(DIR, "band-modal-scrolled-dark.png") });
    }
  });
}

test("final pass: the whole band modal in one tall pane, dark", async ({ page, cdp }) => {
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });
  await openBandFlown(page, cdp, "dark", { width: 1440, height: 1700 });
  await page.screenshot({ path: join(DIR, "band-modal-tall-dark.png") });
});

test("final pass: a card modal's link row at the bottom, one link hovered, dark", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(DIR, { recursive: true });
  await openThemed(page, "dark");
  const { dialog } = await openCardFromBook(page, "ieee", { home: false, settled: true });
  const link = dialog.getByRole("link", { name: /ieee\.ece\.utexas\.edu/ });
  await dialog.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(500);
  await link.hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(DIR, "card-links-dark.png") });
});
