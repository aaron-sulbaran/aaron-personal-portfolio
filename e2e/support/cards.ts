import type { CDPSession, Locator, Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { expect } from "./fixtures";
import { openHome } from "./coil";
import type { HookWindow } from "./hooks";
import { pointerTo } from "./input";

export const cardRow = (page: Page, key: CardKey) => page.locator(`#work button.book-row[data-card="${key}"]`);
export const cardDialog = (page: Page, key: CardKey) => page.locator(`[role="dialog"][data-card-modal="${key}"]`);

// The panel rises in (opacity 0 to 1, 16px up and 0.97 to full scale over
// 280ms; a fade alone under reduced motion), Playwright counts an opacity 0
// element as visible, and boundingBox measures through transforms. So every
// size read of a card's modal waits for its panel to rest: no transform, full
// opacity.
export async function panelAtRest(page: Page, key: CardKey) {
  await page.waitForFunction(
    (k) => {
      const panel = document.querySelector(`[data-card-modal="${k}"] [data-gallery-panel]`);
      if (!panel) return false;
      const { transform, opacity } = getComputedStyle(panel);
      return (transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)") && opacity === "1";
    },
    key,
    { polling: "raf", timeout: 5000 },
  );
}

// A card opened the way a reader of the book opens it: a click on its row (no
// flight). Returns once the panel rests, so every size read after it is final;
// settled also waits for the mask-in to end (no armed body is left).
export async function openCardFromBook(page: Page, key: CardKey, { home = true, settled = false } = {}): Promise<{ row: Locator; dialog: Locator }> {
  if (home) await openHome(page);
  const row = cardRow(page, key);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const dialog = page.getByRole("dialog", { name: siteContent.cards[key].modal.title, exact: true });
  await expect(dialog).toBeVisible();
  await panelAtRest(page, key);
  if (settled) await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  return { row, dialog };
}

// A card of one flight kind clicked on the Coil, as a visitor does (hover until
// the scene picks it, then a click), behind ?coildebug=flight. Resolves with its
// key once the flown card is parked (parked: false resolves at the click).
export async function flyCard(page: Page, cdp: CDPSession, kind: "photo" | "work", { parked = true } = {}): Promise<CardKey> {
  await openHome(page, { debug: "flight" });
  const find = () =>
    page.evaluate((k) => {
      const w = window as HookWindow;
      const slot = w.__coilFlight!.scene.slots().find(
        (s) => s.kind === k && s.depth > 0.3 && s.center.x > 80 && s.center.x < innerWidth - 80 && s.center.y > 80 && s.center.y < innerHeight * 0.75 && w.__coil!.api.cardAt(s.center.x, s.center.y)?.slot === s.slot,
      );
      return slot ? { slot: slot.slot, key: slot.key } : null;
    }, kind);
  await expect.poll(find, { timeout: 20_000, message: `a ${kind} card on screen` }).not.toBeNull();
  const { slot, key } = (await find())!;
  await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.follow(n), slot);
  const center = await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.slot(n)!.center, slot);
  await pointerTo(cdp, center);
  await page.waitForFunction((n) => (window as HookWindow).__coil!.hovered() === n, slot);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...center, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...center, button: "left", clickCount: 1 });
  if (parked) await page.waitForFunction(() => (window as HookWindow).__coilFlight!.log.some((m) => m.name === "clone-parked"));
  return key as CardKey;
}
