import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { settled } from "./support/fallback";
import { GREETED_KEY, SOUNDTRACK_KEY } from "./support/dock";

// The house fill and the bolt note (lab log, "Controls lab", Aaron's pick).
const M = siteContent.menu;

// ?e2eStored=on restores a paused opt-in, =off an opt-out; the greeting is
// marked seen so the pill lands as its quiet capsule.
async function storeFromQuery(page: Page) {
  await page.addInitScript(({ key, greeted }) => {
    const stored = new URLSearchParams(location.search).get("e2eStored");
    if (stored) localStorage.setItem(key, stored);
    sessionStorage.setItem(greeted, "1");
  }, { key: SOUNDTRACK_KEY, greeted: GREETED_KEY });
}
async function openWith(page: Page, stored: "on" | "off") {
  await page.goto(`/?e2eStored=${stored}#about`);
  await settled(page);
}
const listen = (page: Page) =>
  page.locator("button[aria-pressed]").and(
    page
      .getByRole("button", { name: M.listenAriaLabelPlay, exact: true })
      .or(page.getByRole("button", { name: M.listenAriaLabelPause, exact: true })),
  );
const noteIn = (control: Locator) => control.locator("svg[data-note]").first();
const slashIn = (control: Locator) => control.locator("[data-note-slash]").first();

test("controls: the note's slash is painted only while paused or off", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit cannot be launched muted");
  await storeFromQuery(page);
  await openWith(page, "off");
  await expect(noteIn(listen(page))).toHaveAttribute("data-note", "off");
  await expect(slashIn(listen(page))).toBeVisible();

  await openWith(page, "on");
  await expect(noteIn(listen(page))).toHaveAttribute("data-note", "paused");
  await expect(slashIn(listen(page))).toBeVisible();

  await listen(page).click();
  await expect(noteIn(listen(page))).toHaveAttribute("data-note", "playing");
  await expect(slashIn(listen(page))).toBeHidden();
});
