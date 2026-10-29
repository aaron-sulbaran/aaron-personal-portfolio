import type { CDPSession, Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { coverage, dealFacts, flingStream, startRecording, stopRecording, wheelStream, type Frame } from "./support/cutscene";

// The deal is a short cutscene (Aaron's hand test, 2026-10-29). Whichever way it
// starts, a scroll past the trigger or "Deal me in", the page takes the
// reader's scroll input (wheel, touch, the scroll keys) until the Coil is
// unfurled, and the deal's own eased scroll brings the page to page 2's top.

const html = (page: Page) => page.locator("html");

// The reader scrolls down by hand, one notch at a time, until the deal starts.
async function startDealByWheel(page: Page, cdp: CDPSession, at: { x: number; y: number }) {
  for (let i = 0; i < 80; i++) {
    if ((await page.evaluate(() => document.documentElement.dataset.deal)) === "dealing") return;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY: 40 });
    await page.waitForTimeout(40);
  }
  throw new Error("the deal never started by wheel");
}

// Frames where the page went back up under the reader: the cards section's top
// moved down the screen. (Not scrollY: when the ribbon's slot closes, the page
// is held by a scrollBy that lowers scrollY and leaves the section where it was.)
function goingUp(frames: Frame[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < frames.length; i++) if (frames[i].workTop > frames[i - 1].workTop + 0.5) out.push(`${Math.round(frames[i].t)}ms, page 2's top ${frames[i - 1].workTop.toFixed(1)} to ${frames[i].workTop.toFixed(1)}`);
  return out;
}

for (const size of [{ name: "1280x800", viewport: { width: 1280, height: 800 } }]) {
  test.describe(`the cutscene at ${size.name}`, () => {
    test.use({ viewport: size.viewport });

    test("a fling down from block 4 plays the deal and lands on page 2, and stays there", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "top" });
      const facts = await dealFacts(page);
      // Block 4 near the top of the screen: the fling has the whole foot and the stage's range ahead of it.
      await page.evaluate(() => window.scrollTo({ top: document.getElementById("story-from")!.getBoundingClientRect().top + window.scrollY - 120, behavior: "instant" }));
      await page.waitForTimeout(300);
      const at = { x: size.viewport.width / 2, y: size.viewport.height / 2 };
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startRecording(page);
      const fling = flingStream();
      await wheelStream(cdp, fling, at);
      await page.waitForFunction(() => ["unfurled", "dealt"].includes(document.documentElement.dataset.deal ?? ""), null, { timeout: 15_000 });
      await page.waitForTimeout(1500);
      const frames = await stopRecording(page);
      const topOf = (f: Frame[]) => Math.max(...f.map((x) => x.y));
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ facts, maxY: topOf(frames), finalY: frames[frames.length - 1].y, frames: frames.length }));
      const dealing = frames.filter((f) => f.deal === "dealing");
      // eslint-disable-next-line no-console
      console.log("dealing frames", dealing.length, "first y", dealing[0]?.y, "last y", dealing[dealing.length - 1]?.y);
      expect(Math.abs(frames[frames.length - 1].y - facts.landing), "the page ends on page 2's top").toBeLessThan(2);
      expect(topOf(frames) - facts.landing, "how far past page 2's top the page ever went").toBeLessThan(40);
    });

    test("start the deal by scroll, then wheel up hard: the page never goes up and nothing slides over block 4", async ({ page, cdp }) => {
      await openHome(page, { debug: "flight", at: "foot" });
      const at = { x: size.viewport.width / 2, y: size.viewport.height / 2 };
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
      await startDealByWheel(page, cdp, at);
      // The wheel has formed (the ribbon's rush and its curl are over); the reader changes their mind.
      await page.waitForFunction(() => ((window as unknown as { __coil: { entrance: () => { elapsedMs: number | null } } }).__coil.entrance().elapsedMs ?? -1e9) >= 700, null, { timeout: 8000 });
      await startRecording(page);
      await wheelStream(cdp, flingStream({ events: 14, ms: 350, tailMs: 600, sign: -1 }), at);
      await page.waitForTimeout(3000);
      const frames = await stopRecording(page);
      const hits = coverage(frames, size.viewport, true);
      expect(hits, hits.slice(0, 4).join("\n")).toEqual([]);
      // While the deal is dealing, before the Coil is unfurled, the reader's wheel moves nothing.
      const during = frames.filter((f) => f.deal === "dealing");
      expect(during.length, "frames of the deal after the reader's wheel").toBeGreaterThan(10);
      const ups = goingUp(during);
      expect(ups, `the page went back up under the reader: ${ups.slice(0, 4).join("; ")}`).toEqual([]);
    });
  });
}
