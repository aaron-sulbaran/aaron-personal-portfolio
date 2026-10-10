import { siteContent } from "@/lib/content";
import { FOOTER as F } from "@/lib/footer/constants";
import { eggTotalMs } from "@/lib/footer/egg";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { FOOTER, parsePose, readWord, recordWord, toFooter, waitForWord } from "./support/footer";

// A phone (the touch project: a Pixel 7, touch, a coarse pointer). The swell
// and the press answer a mouse or a pen only, so a tap on the letters leaves
// the word still; the period button, 44px at least, takes a tap and drops it.

const C = siteContent.footer;
const PERIOD = [...C.wordmark].indexOf(".");

test("touch: a tap on the letters leaves the word still; a tap on the period drops it", async ({ page }) => {
  await openHome(page);
  await toFooter(page);
  await waitForWord(page);
  const rest = await readWord(page);
  const footer = (await page.locator(FOOTER).boundingBox())!;
  const l = parsePose(rest.transforms[3]);
  const still = recordWord(page, 500);
  await page.touchscreen.tap(footer.x + l.x, footer.y + rest.baseline - rest.size / 2);
  for (const frame of await still) expect(frame).toEqual(rest.transforms);
  const button = page.getByRole("button", { name: C.dropPeriod });
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(F.hitPx.min);
  expect(box.height).toBeGreaterThanOrEqual(F.hitPx.min);
  expect(box.y + box.height + F.hitPx.ring, "the whole target inside the footer, which clips").toBeLessThanOrEqual(footer.y + footer.height);
  const hop = recordWord(page, eggTotalMs(F.egg) + 200);
  await button.tap();
  expect(Math.min(...(await hop).map((f) => parsePose(f[PERIOD]).y))).toBeLessThan(rest.baseline - 0.3 * rest.size);
});
