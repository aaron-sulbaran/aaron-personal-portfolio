import { siteContent } from "@/lib/content";
import { FOOTER as F } from "@/lib/footer/constants";
import { eggTotalMs } from "@/lib/footer/egg";
import { test, expect } from "./support/fixtures";
import { settled } from "./support/fallback";
import { FOOTER, parsePose, readWord, recordWord, toFooter, waitForWord, watchFieldChunks } from "./support/footer";
import { MUTED_ARGS } from "./support/launch";
import { decodePng, luminanceSpread } from "./support/pixels";
import { noWebglContext } from "./support/webgl";

// The footer without WebGL (slice C6): a browser launched without the GPU and
// with WebGL taken away in the page. Its own file, since a launch option
// cannot be set inside a describe group (it forces a new worker).

const C = siteContent.footer;
const PERIOD = [...C.wordmark].indexOf(".");

test.use({ launchOptions: { args: [...MUTED_ARGS, "--disable-gpu"] } });

test.describe("without WebGL", () => {
  test("footer: the poster stands in, framed and drifting, the word and its egg work, and no chunk loads", async ({ page }) => {
    await page.addInitScript(noWebglContext);
    const scripts = watchFieldChunks(page);
    await page.goto("/");
    await settled(page);
    await toFooter(page);
    await waitForWord(page);
    await expect(page.locator("[data-footer-field]")).toHaveAttribute("data-footer-field", "poster");
    await expect(page.locator("[data-footer-poster]")).toHaveAttribute("data-drawn", /light|dark/);
    await expect(page.locator("[data-footer-poster]")).toHaveCSS("animation-play-state", "running");
    const footer = (await page.locator(FOOTER).boundingBox())!;
    const field = decodePng(await page.screenshot({ clip: { x: footer.x, y: footer.y + 20, width: footer.width, height: 60 } }));
    expect(luminanceSpread(field), "the poster's field over the word").toBeGreaterThan(3);
    const rest = await readWord(page);
    const rec = recordWord(page, eggTotalMs(F.egg) + 200);
    await page.getByRole("button", { name: C.dropPeriod }).click();
    expect(Math.min(...(await rec).map((f) => parsePose(f[PERIOD]).y))).toBeLessThan(rest.baseline - 0.3 * rest.size);
    expect(await scripts.fieldChunks()).toEqual([]);
  });
});
