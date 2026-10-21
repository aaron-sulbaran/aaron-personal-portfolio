import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { SETTINGS_KEY } from "@/lib/player/settings";
import type { PathProbe } from "@/lib/wavepath/probe";
import { openHome } from "./support/coil";
import { parkBand } from "./support/wave";

// The music player lab (/lab/player, dev only) must leave a production build
// exactly as it is: the lab's settings are read only in development, its route
// is a 404 outside it, and what it can hold or move (the band's status line,
// the Not now buttons, the one-line wave and its wait, the idle ripple, the
// player and its pill, the isle at the footer, the island) never takes effect.

const L = siteContent.listen;
const S = siteContent.soundtrack;
const LAB_ELEMENTS = "[data-lab-player], [data-lab-pill], [data-lab-bar], [data-lab-island], [data-lab-clone], [data-lab-band-slot]";
type W = Window & { __wavePath: PathProbe };
const frame = (page: Page) => page.evaluate(() => (window as unknown as W).__wavePath.frame()!);

// Every option on its round 3 value, the lab switched on: the most it could change.
const ROUND_THREE = {
  round: 3,
  enabled: true,
  onPlay: "player",
  intoIsle: "morph",
  isleLine: 0.4,
  backUp: "reopen",
  credit: "hidden",
  phone: "island",
  statusLine: "hidden",
  notNow: "buttons",
  waveAfterAnswer: "waits",
  waveLine: 0.4,
  idleRipple: "ripple",
  idleStrength: 2.5,
  footer: "lift",
  phoneModel: "iphone15",
};
// What round 2 and round 1 stored: the lab reads them too, and they change nothing either.
const ROUND_TWO = { ...ROUND_THREE, round: 2, onPlay: "sheet", idleRipple: undefined, idleStrength: undefined };
const ROUND_ONE = { enabled: true, onPlay: "card", intoIsle: "morph", backUp: "reopen", credit: "hidden", phone: "bar" };

for (const [round, stored] of [["3", ROUND_THREE], ["2", ROUND_TWO], ["1", ROUND_ONE]] as const) {
  test.describe(`with every lab option stored (round ${round}) and the lab on`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, JSON.stringify(stored)] as const);
    });

    test("player lab: stored lab settings change nothing on the home page", async ({ page }) => {
      await openHome(page);
      await parkBand(page);
      await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
      await expect(page.locator("#listen").getByRole("button", { name: L.pause, exact: true })).toBeVisible();
      // The status line is still the band's own: the note and Pause stay, and no lab player or isle appears.
      await expect(page.locator("#listen").getByText(S.creditLine)).toBeVisible();
      await expect(page.locator("#listen [data-band-note]")).toBeVisible();
      await expect(page.locator(LAB_ELEMENTS)).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveAttribute("data-lab-isle", /.*/);
    });

    test("player lab: stored settings leave the wave as it was: no gate and no idle ripple", async ({ page }) => {
      await openHome(page, { path: "/?wavedebug" });
      await parkBand(page);
      await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
      // Declined, with the band in the middle of the screen: nothing holds the head back and nothing ripples.
      await expect.poll(async () => (await frame(page)).decided).toBe(true);
      await page.waitForTimeout(600);
      const f = await frame(page);
      expect(f.gated).toBe(false);
      expect(f.idle).toBe(0);
    });

    test("player lab: stored settings do not make the wave wait for the band to scroll away", async ({ page }) => {
      await openHome(page, { path: "/?wavedebug" });
      await parkBand(page);
      expect((await frame(page)).decided).toBe(false);
      await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
      // Today the answer reaches the wave at once, with the band still in the middle of the screen, and a ripple goes out.
      await expect.poll(async () => (await frame(page)).decided, { message: "the wave decided with the band in view" }).toBe(true);
      await expect.poll(async () => (await frame(page)).ripple, { message: "the answer's ripple" }).toBeGreaterThan(0);
    });

    test("player lab: stored settings leave Not now as it is: the lone freeze link, and no second Play it", async ({ page }) => {
      await openHome(page, { path: "/?wavedebug" });
      await parkBand(page);
      await page.locator("#listen").getByRole("button", { name: L.decline, exact: true }).click();
      await expect(page.locator("#listen").getByText(L.declinedNote)).toBeVisible();
      await expect(page.locator("#listen").getByRole("button", { name: L.freeze, exact: true })).toBeVisible();
      await expect(page.locator("#listen [data-band-note]").getByRole("button", { name: L.accept, exact: true })).toBeHidden();
      await expect.poll(async () => (await frame(page)).decided).toBe(true);
    });
  });
}

test("player lab: the lab route is a 404 outside development", async ({ request }) => {
  expect((await request.get("/lab/player", { maxRedirects: 0 })).status()).toBe(404);
});
