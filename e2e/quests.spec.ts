import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { DISCOVER_DWELL_MS } from "@/lib/inline/discover";
import { questCopy } from "@/lib/content/quests";
import { questIds } from "@/lib/quests/registry";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { toFooter } from "./support/footer";

// The footer quest line (components/quests/, lib/quests/): the door, the run it
// opens, and the progress the rest of the site feeds it.

const STORE = "aaron-quests-v1";
const BUTTON = "[data-quest-line] button";
const PANEL = "[data-quest-panel]";
const readStore = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null") as { found: Record<string, number>; finishes: { any?: unknown } } | null, STORE);

// Guards: the run dialog failing to open, close on one Escape, or hand focus back to its button. Fails at: toBeVisible on the dialog, the toHaveCount(0) after Escape, or the focus read.
test("the button opens the run, one Escape closes it, and focus returns", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await page.locator(BUTTON).click();
  const dialog = page.locator(PANEL);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: questCopy.panel.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate((sel) => document.activeElement === document.querySelector(sel), BUTTON), "focus is back on the footer button").toBe(true);
});

// Guards: the registry no longer scanning the cards' copy, which makes 100% impossible. Fails at: the expect on found["pop:rango"] (the id is absent, or storage never records it).
test("a word inside a card counts toward the run", async ({ page }) => {
  await page.goto("/quick");
  await page.getByRole("button", { name: /^IEEE UT Austin/ }).click();
  const dialog = page.locator('[role="dialog"][data-card-modal]');
  await dialog.locator('[data-inline-key="rango"]').hover();
  await page.waitForTimeout(DISCOVER_DWELL_MS + 500);
  const store = await readStore(page);
  expect(Object.keys(store?.found ?? {})).toContain("pop:rango");
});

// Guards: goTo(EXPRESS_PATH) firing in the commit that closes the run, so the mask sweeps over the still-fading dialog. Fails at: the expect that no record pairs the panel with a non-idle phase (the dialog is in the DOM while the transition leaves idle).
test("the MVP row travels only after the run has closed", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await page.locator(BUTTON).click();
  await page.locator(PANEL).getByRole("button", { name: questCopy.panel.categories.full.label }).click();
  const go = page.locator(PANEL).getByRole("button", { name: questCopy.panel.groups.mvp.go });
  await expect(go).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __quest: { panel: boolean; phase: string | null | undefined }[] };
    w.__quest = [];
    new MutationObserver(() => {
      w.__quest.push({
        panel: !!document.querySelector("[data-quest-panel]"),
        phase: document.querySelector("[data-transition]")?.getAttribute("data-transition"),
      });
    }).observe(document.body, { subtree: true, attributes: true, childList: true });
  });
  await go.click();
  await expect(page).toHaveURL(/\/quick$/);
  const records = await page.evaluate(() => (window as unknown as { __quest: { panel: boolean; phase: string | null | undefined }[] }).__quest);
  expect(records.some((r) => r.phase && r.phase !== "idle"), "the transition left idle at least once").toBe(true);
  expect(records.filter((r) => r.panel && r.phase && r.phase !== "idle"), "the dialog was still mounted while the mask moved").toEqual([]);
});

// Guards: QuestButton reading framer's useReducedMotion during hydration (server renders the pulse ring, client drops it: React #418). Fails at: the expect that no page error or console error mentions hydration, or the pulse ring count.
test("no hydration error under reduced motion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("/_vercel/insights")) errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await toFooter(page);
  await expect(page.locator(BUTTON)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors.filter((text) => /418|hydrat/i.test(text))).toEqual([]);
  await expect(page.locator("[data-quest-line] span.absolute.inset-0")).toHaveCount(0);
});

// Guards: finishes never recorded, or the run still showing the live clock with no finish line. Fails at: expect.poll on finishes.any, or the toBeVisible on questCopy.finish.any.
test("finishing Any% records the run and the run says so", async ({ page, context }) => {
  const last = "ieee";
  const seededCards = questIds("cards").filter((id) => id !== `card:${last}`).slice(0, 4);
  const seed = { v: 1, found: Object.fromEntries([...seededCards, ...questIds("pops").slice(0, 3), "egg:period"].map((id, i) => [id, 1000 * (i + 1)])), clockMs: 60_000, finishes: {} };
  // Only the first document seeds, so the later load of the home keeps what the run wrote.
  await context.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, [STORE, JSON.stringify(seed)]);
  await page.goto("/quick");
  await page.getByRole("button", { name: /^IEEE UT Austin/ }).click();
  const dialog = page.locator('[role="dialog"][data-card-modal]');
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await readStore(page))?.finishes.any, { message: "Any% finish recorded" }).toBeTruthy();

  await openHome(page, { at: "top" });
  await toFooter(page);
  await page.locator(BUTTON).click();
  const run = page.locator(PANEL);
  await run.getByRole("button", { name: questCopy.panel.categories.any.label }).click();
  await expect(run.getByText(questCopy.finish.any)).toBeVisible();
});
