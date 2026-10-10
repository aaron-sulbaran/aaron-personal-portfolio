import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardDialog, cardRow, openCardFromBook } from "./support/cards";

const g = siteContent.modals.gallery;
const START_MS = GALLERY.mask.landingMs + GALLERY.rotate.delayMs;

// Mentorship's second row: photos 2, 3 and 4 taking turns beside its last
// paragraph, scrolled fully into view, the mouse parked on the backdrop.
async function openGroup(page: Page, { home = true } = {}) {
  const { dialog } = await openCardFromBook(page, "mentorship", { home });
  await page.mouse.move(5, 5);
  const group = dialog.locator("[data-rotator]");
  await group.scrollIntoViewIfNeeded();
  return { dialog, group };
}

const wordsOf = (dialog: import("@playwright/test").Locator) =>
  dialog.locator('[data-row="photo"][data-turns] [data-text-column] [data-mask]').evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")));

test("rotator: a group turns every 3s once the start delay has passed, and its words never change", async ({ page }) => {
  const { dialog, group } = await openGroup(page);
  await expect(group).toHaveAttribute("data-rotator-runs", "", { timeout: START_MS + 3000 });
  const words = await wordsOf(dialog);
  const started = Date.now();
  await expect(group).toHaveAttribute("data-rotator-index", "1", { timeout: GALLERY.rotate.intervalMs + 2000 });
  const waited = Date.now() - started;
  expect(waited).toBeGreaterThan(GALLERY.rotate.intervalMs - 600);
  expect(waited).toBeLessThan(GALLERY.rotate.intervalMs + 900);
  expect(await wordsOf(dialog)).toEqual(words);
});

test("rotator: one edge sweeps the frame left to right, and the old caption clears before the new one writes in", async ({ page }) => {
  await openGroup(page);
  const sweep = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('[data-card-modal="mentorship"] [data-rotator]');
    if (!root) return null;
    const layers = [...root.querySelectorAll<HTMLElement>("[data-rotator-layer]")];
    const index = Number(root.dataset.rotatorIndex);
    const incoming = layers[index];
    const outgoing = layers.find((el, i) => i !== index && el.style.clipPath !== "");
    const px = (el: HTMLElement) => el.style.clipPath.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat) ?? null;
    const a = incoming ? px(incoming) : null;
    const b = outgoing ? px(outgoing) : null;
    if (!a || !b || !outgoing) return null;
    if (a[1] < 2 || a[1] > incoming.offsetWidth - 2 || b[3] < 2 || b[3] > outgoing.offsetWidth - 2) return null;
    return { incomingEdge: incoming.offsetLeft + incoming.offsetWidth - a[1], outgoingEdge: outgoing.offsetLeft + b[3] };
  }, null, { polling: "raf", timeout: START_MS + 2 * GALLERY.rotate.intervalMs + 2000 });
  const { incomingEdge, outgoingEdge } = (await sweep.jsonValue())!;
  expect(Math.abs(incomingEdge - outgoingEdge)).toBeLessThan(1);
  const captions = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('[data-card-modal="mentorship"] [data-rotator]');
    if (!root) return null;
    const cells = [...root.querySelectorAll<HTMLElement>("[data-rotator-caption]")];
    const index = Number(root.dataset.rotatorIndex);
    const pct = (el: HTMLElement) => el.style.clipPath.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat) ?? null;
    const entering = cells[index] ? pct(cells[index]) : null;
    const leaving = cells.find((el, i) => i !== index && el.style.clipPath !== "");
    const out = leaving ? pct(leaving) : null;
    if (!entering || !out) return null;
    // The old caption part way closed from the left while the new one has not begun.
    return out[3] > 2 && out[3] < 100 && entering[1] >= 101 ? { leavingLeft: out[3], enteringRight: entering[1] } : null;
  }, null, { polling: "raf", timeout: START_MS + 3 * GALLERY.rotate.intervalMs + 2000 });
  expect((await captions.jsonValue())!.enteringRight).toBeGreaterThanOrEqual(101);
});

test("rotator: a mouse over the frame or the pause button holds it, and play lets it go", async ({ page }) => {
  const { group } = await openGroup(page);
  await expect(group).toHaveAttribute("data-rotator-runs", "", { timeout: START_MS + 3000 });
  await group.locator("[data-rotator-frame]").hover();
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await page.mouse.move(5, 5);
  await expect(group).toHaveAttribute("data-rotator-runs", "");
  await group.getByRole("button", { name: g.pausePhotos }).click();
  await page.mouse.move(5, 5);
  await expect(group.locator("[data-rotator-pause]")).toHaveAttribute("data-rotator-pause", "paused");
  await expect(group.getByRole("button", { name: g.playPhotos })).toBeVisible();
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await expect(group.locator('[data-rotator-fill="timed"]')).toHaveCSS("animation-play-state", "paused");
  await group.getByRole("button", { name: g.playPhotos }).click();
  await page.mouse.move(5, 5);
  await expect(group).toHaveAttribute("data-rotator-runs", "");
});

test("rotator: a dot steps to its photo, and the arrow keys step and wrap with focus kept on the dots", async ({ page }) => {
  const { group } = await openGroup(page);
  const dot = (n: number) => group.getByRole("button", { name: g.photoOf(n, 3), exact: true });
  await dot(3).click();
  await expect(group).toHaveAttribute("data-rotator-index", "2");
  await dot(3).focus();
  await page.keyboard.press("ArrowRight");
  await expect(group).toHaveAttribute("data-rotator-index", "0");
  await expect(dot(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(group).toHaveAttribute("data-rotator-index", "2");
  await expect(dot(3)).toBeFocused();
});

test("rotator: under reduced motion it never turns on its own, has no pause button, and a dot steps it with no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { group } = await openGroup(page, { home: false });
  await page.waitForTimeout(START_MS + 400);
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await expect(group.locator("[data-rotator-pause]")).toHaveCount(0);
  await expect(group.locator('[data-rotator-fill="still"]')).toHaveCount(1);
  await group.getByRole("button", { name: g.photoOf(2, 3), exact: true }).click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  expect(await group.locator("[data-rotator-layer]").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.clipPath))).toEqual(["", "", ""]);
});

test("rotator: the keyboard path through Mentorship and Misuki reaches the dots, the pause button, the mentors, the links and a tip, and Escape hides the tip before it closes", async ({ page }) => {
  await openHome(page);
  const row = cardRow(page, "mentorship");
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = cardDialog(page, "mentorship");
  await expect(dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  const external = siteContent.book.externalLabel;
  const expected = [
    g.photoOf(1, 3), g.photoOf(2, 3), g.photoOf(3, 3), g.pausePhotos,
    ...siteContent.cards.mentorship.mentors.people.map((mentor) => `${mentor.name}, ${external}`),
    `${siteContent.cards.mentorship.modal.links[0].label}, ${external}`,
    siteContent.modals.closeAriaLabel,
  ];
  const reached: string[] = [];
  while (reached.length < expected.length) {
    await page.keyboard.press("Tab");
    reached.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return el.getAttribute("aria-label") ?? (el.textContent ?? "").replace(/\s+/g, " ").trim();
    }));
    if (reached.length === 1) await expect(dialog.locator("[data-rotator]")).not.toHaveAttribute("data-rotator-runs", "");
  }
  expect(reached).toEqual(expected);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();

  const misukiRow = cardRow(page, "misuki");
  await misukiRow.scrollIntoViewIfNeeded();
  await misukiRow.focus();
  await page.keyboard.press("Enter");
  const misuki = cardDialog(page, "misuki");
  await expect(misuki.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await expect(misuki.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  const tip = misuki.getByRole("button", { name: "Fast and Furious", exact: true });
  for (let i = 0; i < 8 && !(await tip.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(tip).toBeFocused();
  const bubble = page.locator("[data-inline-tip]");
  await expect(bubble).toHaveAttribute("data-shown", "true");
  await page.keyboard.press("Escape");
  await expect(bubble).not.toHaveAttribute("data-shown", "true");
  await expect(misuki).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(misuki).toHaveCount(0);
  await expect(misukiRow).toBeFocused();
});
