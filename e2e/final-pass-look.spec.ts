import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { CardKey } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { openCardFromBook } from "./support/cards";
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

async function openThemed(page: Page, theme: "light" | "dark", debug = "1") {
  await page.setViewportSize(DESKTOP);
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
