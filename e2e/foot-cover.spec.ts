import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome } from "./support/coil";
import { COIL } from "@/lib/coil/constants";

// "Deal me in" and the line under it stay whole and on top while the reader scrolls
// toward the deal (Aaron, 2026-11-18: "The deal me in on just scroll-based wasn't
// really working. Clip through for some reason."). Once the stage sticks, the button's
// block is pinned under the stuck ribbon (app/globals.css .intro-foot__cta-pin) and the
// page scrolls on to the deal's trigger, and the cards section, later in the page and
// opaque while the deal is closed, rises behind the pin over that stretch: its top
// passes the block's bottom a few percent into the sticky range, and the trigger is at
// 18 percent of it. Walked as a reader does, in 20 px wheel steps, from the button low
// on the screen to the step that starts the deal: at every step before it the centres
// of the button and of its line hit-test to themselves, and through the deal's fade of
// them, while the button is still seen, its centre still does. Once the fade is over
// the pin is back under the section, so the faded block never sits over the Coil.

const STEP_PX = 20;
// Under this the button is not there to be covered.
const SEEN = 0.05;
// How long the fade is sampled for once the deal has started, ms.
const FADE_WINDOW_MS = 500;
// The deal's fade of the block, and a few frames of slack either side of its end.
const FADE_MS = COIL.deal.timeline.textOutMs;
const SLACK_MS = 50;

type Step = { deal: string; button: string; line: string; ctaBottom: number; workTop: number; stuck: boolean };
type FadeFrame = { ms: number; opacity: number; button: string; z: string };
type FadeWindow = Window & typeof globalThis & { __fade: FadeFrame[] };

// What the page puts under an element's centre: "itself" (the element or something in it) or what covers it.
async function readStep(page: Page): Promise<Step> {
  return page.evaluate(() => {
    const under = (el: Element) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!at) return "nothing";
      if (el.contains(at)) return "itself";
      return `${at.tagName.toLowerCase()}${at.id ? `#${at.id}` : ""}[${Object.keys((at as HTMLElement).dataset).join(",")}]`;
    };
    return {
      deal: document.documentElement.dataset.deal ?? "",
      button: under(document.querySelector("[data-deal-button]")!),
      line: under(document.querySelector("[data-mvp-link]")!),
      ctaBottom: document.querySelector("[data-intro-cta]")!.getBoundingClientRect().bottom,
      workTop: document.getElementById("work")!.getBoundingClientRect().top,
      stuck: document.querySelector("[data-coil-rail]")!.getBoundingClientRect().top <= 0,
    };
  });
}

// Every frame from the one the deal starts on, for FADE_WINDOW_MS: the button block's opacity and what is under the button's centre.
async function watchFade(page: Page) {
  await page.evaluate((windowMs) => {
    const w = window as FadeWindow;
    w.__fade = [];
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null && document.documentElement.dataset.deal !== "closed") start = now;
      if (start !== null) {
        const button = document.querySelector("[data-deal-button]")!;
        const r = button.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        let opacity = 1;
        for (let node: Element | null = document.querySelector("[data-intro-cta]"); node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        const z = getComputedStyle(document.querySelector("[data-cta-pin]")!).zIndex;
        w.__fade.push({ ms: now - start, opacity, button: at && button.contains(at) ? "itself" : (at?.tagName.toLowerCase() ?? "nothing"), z });
        if (now - start > windowMs) return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, FADE_WINDOW_MS);
}

for (const size of [
  { name: "1280x1295", viewport: { width: 1280, height: 1295 } },
  { name: "1440x900", viewport: { width: 1440, height: 900 } },
  { name: "1280x720", viewport: { width: 1280, height: 720 } },
  { name: "390x844", viewport: { width: 390, height: 844 }, phone: true },
]) {
  test.describe(`Deal me in on the scroll to the deal at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: !!size.phone, isMobile: !!size.phone });

    test("the button and its line hit-test to themselves at every 20 px wheel step until the deal starts, and the button through its fade", async ({ page }) => {
      test.setTimeout(90_000);
      await openHome(page, { at: "top" });
      // "Deal me in" three quarters of the way down the screen, the stage not yet stuck.
      await page.evaluate(() => {
        const button = document.querySelector("[data-deal-button]")!.getBoundingClientRect();
        window.scrollTo({ top: Math.max(0, button.top + button.height / 2 + window.scrollY - window.innerHeight * 0.75), behavior: "instant" });
      });
      await nextFrames(page, 4);
      // The pointer rests over the stage, beside the button, as a reader's would.
      await page.mouse.move(size.viewport.width * 0.66, size.viewport.height * 0.68);
      await watchFade(page);
      const steps: Step[] = [];
      for (let i = 0; i < 150; i++) {
        await page.mouse.wheel(0, STEP_PX);
        await page.waitForTimeout(100);
        await nextFrames(page, 2);
        const step = await readStep(page);
        steps.push(step);
        if (step.deal !== "closed") break;
      }
      await page.waitForTimeout(FADE_WINDOW_MS + 200);
      const fade = await page.evaluate(() => (window as FadeWindow).__fade);

      const closed = steps.filter((s) => s.deal === "closed");
      expect(steps.at(-1)?.deal, "the walk reached the step that starts the deal").not.toBe("closed");
      // A phone's stage is stuck for about 50 px before the trigger: two or three steps.
      expect(closed.filter((s) => s.stuck).length, "steps with the stage stuck before the deal").toBeGreaterThan(0);
      // The walk crossed the stretch where the cards section has risen into the button's block.
      const risen = closed.filter((s) => s.workTop < s.ctaBottom);
      expect(risen.length, "closed steps with the cards section's top above the block's bottom").toBeGreaterThan(0);

      const failures: string[] = [];
      closed.forEach((s, i) => {
        if (s.button !== "itself") failures.push(`step ${i}: the button's centre hits ${s.button} (section top ${Math.round(s.workTop)}, block bottom ${Math.round(s.ctaBottom)})`);
        if (s.line !== "itself") failures.push(`step ${i}: the line's centre hits ${s.line} (section top ${Math.round(s.workTop)}, block bottom ${Math.round(s.ctaBottom)})`);
      });
      const seen = fade.filter((f) => f.opacity >= SEEN);
      expect(fade.length, "frames sampled once the deal started").toBeGreaterThan(10);
      for (const f of seen) if (f.button !== "itself") failures.push(`${Math.round(f.ms)} ms into the deal, the button at opacity ${f.opacity.toFixed(2)}: its centre hits ${f.button}`);
      // Over the section for the fade, under it again after.
      const late = fade.filter((f) => f.ms > FADE_MS + SLACK_MS);
      expect(late.length, `frames sampled after the fade (${FADE_MS} ms)`).toBeGreaterThan(3);
      for (const f of fade) {
        if (f.ms < FADE_MS - SLACK_MS && f.z !== "10") failures.push(`${Math.round(f.ms)} ms into the deal, inside the fade: the pin's z-index is ${f.z}`);
        if (f.ms > FADE_MS + SLACK_MS && f.z !== "auto") failures.push(`${Math.round(f.ms)} ms into the deal, after the fade: the pin's z-index is ${f.z}`);
      }
      expect(failures, failures.slice(0, 8).join("\n")).toEqual([]);

      const last = closed.at(-1)!;
      test.info().annotations.push({
        type: "walk",
        description: `${closed.length} closed steps (${closed.filter((s) => s.stuck).length} stuck, ${risen.length} with the section into the block); at the last one the section's top ${Math.round(last.workTop)} px and the block's bottom ${Math.round(last.ctaBottom)} px; ${seen.length} fade frames with the button seen`,
      });
    });
  });
}
