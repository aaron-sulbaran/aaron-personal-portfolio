import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";

// The page's chrome: the Menu pill that grows into its panel, the music
// note beside it, and the header bar that arrives past the hero and tucks
// away on the way down (headroom).

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

test("chrome: the music note toggles the soundtrack and says what it will do", async ({ page, browserName }) => {
  // Pressing the note starts playback, and WebKit has no mute switch.
  test.skip(browserName === "webkit", "WebKit cannot be launched muted");
  await openHome(page);
  // The note is the toggle (aria-pressed); the locator requires the attribute so only the note matches.
  const toggle = (name: string) => page.locator("button[aria-pressed]").and(page.getByRole("button", { name }));
  const note = toggle("Play my soundtrack");
  await expect(note).toHaveAttribute("aria-pressed", "false");

  await note.click();
  const playing = toggle("Pause my soundtrack");
  await expect(playing).toHaveAttribute("aria-pressed", "true");

  await playing.click();
  await expect(toggle("Play my soundtrack")).toHaveAttribute("aria-pressed", "false");
});

test("chrome: the header bar arrives past the hero and tucks away on the way down, back on the way up", async ({ page }) => {
  await openHome(page);
  const nav = page.getByRole("navigation", { name: "Sections" });
  // During the hero the section links are inert (the bar has not arrived).
  await expect(nav).toHaveAttribute("inert", "");

  await scrollToY(page, 1100);
  await expect(nav).not.toHaveAttribute("inert", "");
  await expect(nav.getByRole("link", { name: "About" })).toBeVisible();

  await scrollToY(page, 1500);
  await expect(nav).toHaveAttribute("inert", "");

  await scrollToY(page, 1480);
  await expect(nav).not.toHaveAttribute("inert", "");
});

// A ScrollTrigger refresh switches the root to an instant scroll while it
// measures; afterwards the root's own inline value comes back, so the
// stylesheet decides again and a live switch to reduced motion makes anchor
// jumps instant (globals.css), with no inline smooth left over to win.
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
