import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { SETTINGS_KEY } from "@/lib/player/settings";
import { openHome } from "./support/coil";
import { parkBand } from "./support/wave";

// The music player lab (/lab/player, dev only) must leave a production build
// exactly as it is: the lab's settings are read only in development, and its
// route is a 404 outside it.

const L = siteContent.listen;
const S = siteContent.soundtrack;
const LAB_ELEMENTS = "[data-lab-player], [data-lab-docked], [data-lab-bar], [data-lab-clone], [data-lab-band-slot]";

test("player lab: stored lab settings change nothing on the home page", async ({ page }) => {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SETTINGS_KEY, JSON.stringify({ enabled: true, onPlay: "card", intoIsle: "morph", backUp: "reopen", credit: "hidden", phone: "bar" })] as const,
  );
  await openHome(page);
  await parkBand(page);
  await page.locator("#listen").getByRole("button", { name: L.accept, exact: true }).click();
  await expect(page.locator("#listen").getByRole("button", { name: L.pause, exact: true })).toBeVisible();
  await expect(page.locator(LAB_ELEMENTS)).toHaveCount(0);
  await expect(page.locator("#listen").getByText(S.creditLine)).toBeVisible();
});

test("player lab: the lab route is a 404 outside development", async ({ request }) => {
  expect((await request.get("/lab/player", { maxRedirects: 0 })).status()).toBe(404);
});
