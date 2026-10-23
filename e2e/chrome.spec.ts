import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";

// The page's chrome: the logo (top left) and the Menu pill (top right) that
// grows into its panel, and nothing else. There is no top bar.

const M = siteContent.menu;

test("chrome: the Menu pill opens into the panel and closes again", async ({ page }) => {
  await openHome(page);
  const pill = page.getByRole("button", { name: "Open menu" });
  await expect(pill).toHaveAttribute("aria-expanded", "false");

  await pill.click();
  const panel = page.getByRole("dialog", { name: "Site menu" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "LinkedIn" })).toBeVisible();
  const close = page.getByRole("button", { name: "Close menu" });
  await expect(close).toHaveAttribute("aria-expanded", "true");

  await close.click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
});

// The mute is not in the Menu: the pill is the label alone, and the panel keeps
// the theme chip, the wave's freeze, the quick view link and the contact row.
// The player (see e2e/player.spec.ts) is where the music is controlled.
test("chrome: the Menu pill holds no music note and the panel no soundtrack chip", async ({ page }) => {
  await openHome(page);
  const pill = page.locator("[data-menu-pill]");
  await expect(pill.locator("svg[data-note]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play my soundtrack" })).toHaveCount(0);
  await pill.getByRole("button", { name: "Open menu" }).click();
  const panel = page.getByRole("dialog", { name: "Site menu" });
  await expect(panel.getByRole("button", { name: "Soundtrack", exact: true })).toHaveCount(0);
  // The one chip with a pressed state is the wave's freeze, which is not a music control.
  await expect(panel.locator("button[aria-pressed]")).toHaveCount(1);
  await expect(panel.locator("button[aria-pressed]")).toHaveAccessibleName(M.freeze);
});

// The chrome is the logo and the pill. No bar slides in past page 1, so nothing
// wider than the pill is ever fixed to the top edge, and the section list is the
// Menu's alone: it exists only while the panel is open, with the four pages and
// their numbers, and it takes the reader to a page.
test("chrome: no top bar at any scroll position; the Menu lists the four pages with their numbers and leads to them", async ({ page }) => {
  await openHome(page, { at: "top" });
  const bars = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return style.position === "fixed" && style.display !== "none" && box.top < 90 && box.bottom > 0 && box.width > 300 && box.height < 140;
        })
        .map((el) => `${el.tagName.toLowerCase()} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
    );
  for (const y of [0, 1100, 1500, 2600]) {
    await scrollToY(page, y);
    await expect(page.getByRole("navigation", { name: M.navAriaLabel }), `a section list at ${y}`).toHaveCount(0);
    expect(await bars(), `a bar fixed to the top at ${y}`).toEqual([]);
    await expect(page.locator("[data-mark-trigger]")).toBeVisible();
    await expect(page.locator("[data-menu-pill]")).toBeVisible();
  }

  await page.getByRole("button", { name: M.ariaLabelOpen }).click();
  const list = page.getByRole("dialog", { name: M.dialogLabel }).getByRole("navigation", { name: M.navAriaLabel });
  await expect(list.getByRole("link")).toHaveText(M.items.map((item) => new RegExp(`^${item.number}\\s*${item.label}$`)));
  await expect(list.locator("[data-menu-number]")).toHaveText(M.items.map((item) => item.number));
  await list.getByRole("link", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog", { name: M.dialogLabel })).toHaveCount(0);
  await page.waitForFunction(() => Math.abs(document.getElementById("connect")!.getBoundingClientRect().top) < 130, null, { timeout: 8000 });
});

// The freeze is always reachable (a phone with no music playing has no pill):
// the Menu panel holds "Freeze the wave", which reads "Let it move" while the
// wave is frozen, and a second press lets it go.
test("chrome: the Menu freezes the wave and lets it move again", async ({ page }) => {
  await openHome(page, { at: "top" });
  const open = () => page.getByRole("button", { name: M.ariaLabelOpen }).click();
  const chip = () => page.getByRole("dialog", { name: M.dialogLabel }).locator("[data-menu-freeze]");
  await open();
  await expect(chip()).toHaveAccessibleName(M.freeze);
  await expect(chip()).toHaveAttribute("aria-pressed", "false");
  await chip().click();
  await expect(chip()).toHaveAttribute("aria-pressed", "true");
  await expect(chip()).toHaveAccessibleName(M.unfreeze);
  // The state lives past the panel: closed and opened again it is still frozen.
  await page.getByRole("button", { name: M.ariaLabelClose }).click();
  await expect(page.getByRole("dialog", { name: M.dialogLabel })).toHaveCount(0);
  await open();
  await expect(chip()).toHaveAttribute("aria-pressed", "true");
  await chip().click();
  await expect(chip()).toHaveAttribute("aria-pressed", "false");
  await expect(chip()).toHaveAccessibleName(M.freeze);
});

// A ScrollTrigger refresh switches the root to an instant scroll while it
// measures; afterwards the root's own inline value comes back, so the
// stylesheet decides again and a live switch to reduced motion makes native
// anchor jumps instant (globals.css), with no inline smooth left over to win.
test("chrome: after a refresh the stylesheet owns the root's scroll behaviour again", async ({ page }) => {
  await openHome(page);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await nextFrames(page, 3);
  }
  const behaviour = () =>
    page.evaluate(() => ({
      inline: document.documentElement.style.scrollBehavior,
      computed: getComputedStyle(document.documentElement).scrollBehavior,
    }));
  expect(await behaviour()).toEqual({ inline: "", computed: "smooth" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await behaviour()).toEqual({ inline: "", computed: "auto" });
});
