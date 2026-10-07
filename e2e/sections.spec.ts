import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { siteContent } from "@/lib/content";
import { GRAMMAR } from "@/lib/sections/grammar";

// The sections grammar on the home (lib/sections, components/sections): what
// a reader sees with and without reduced motion, what assistive tech reads
// once SplitText has run, and the sticky holds. Each section lists the prose
// it must keep, word for word.

const { about, whoIAm, upToNow } = siteContent;
const PROSE: Record<string, string[]> = {
  "#about": [about.heading, about.lede],
  "#who-i-am": [whoIAm.paragraph],
  "#up-to-now": [upToNow.heading, ...upToNow.items],
};
const STICKY = ["#who-i-am", "#up-to-now"];
// Decoration with transforms of its own: icons and controls' Fill copy and arrows.
const SKIP = "svg, svg *, .fx-over, .fx-over *, .fx-arrow, .fx-arrow *";
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function blocksIn(page: Page, state: "armed" | "still") {
  await page.waitForFunction(
    ({ ids, state }) =>
      ids.every((id) => {
        const blocks = [...document.querySelectorAll<HTMLElement>(`${id} [data-sections-block]`)];
        return blocks.length > 0 && blocks.every((block) => block.dataset.sectionsState === state);
      }),
    { ids: Object.keys(PROSE), state },
  );
}

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("sections: every block is still and whole at load: no split, no transform, nothing faded", async ({ page }) => {
    await page.goto("/");
    await settled(page);
    await blocksIn(page, "still");
    const report = await page.evaluate(({ ids, skip }) => {
      const off: string[] = [];
      for (const id of ids) {
        for (const block of document.querySelectorAll<HTMLElement>(`${id} [data-sections-block]`)) {
          for (const el of [block, ...block.querySelectorAll<HTMLElement>("*")]) {
            if (el.matches(skip)) continue;
            const style = getComputedStyle(el);
            if (style.opacity !== "1" || style.transform !== "none") off.push(`${id} ${block.dataset.sectionsBlock} ${el.tagName} ${style.opacity} ${style.transform}`);
          }
        }
      }
      return { off, lines: document.querySelectorAll(".sections-line").length };
    }, { ids: Object.keys(PROSE), skip: SKIP });
    expect(report.lines, "SplitText under reduced motion").toBe(0);
    expect(report.off).toEqual([]);
  });
});

test("sections: after SplitText the page still reads every heading and paragraph verbatim, and hides none of it", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  const read = await page.evaluate(() => ({
    text: document.body.innerText,
    blocks: [...document.querySelectorAll<HTMLElement>("[data-sections-block]")].map((el) => el.textContent ?? ""),
    lines: document.querySelectorAll("[data-sections-block] .sections-line").length,
    masks: document.querySelectorAll("[data-sections-block] .sections-line-mask").length,
    labelled: document.querySelectorAll("[data-sections-block][aria-label], [data-sections-block] [aria-label]").length,
    hidden: [...document.querySelectorAll("[data-sections-block] [aria-hidden='true']")].filter(
      (el) => !el.matches("[data-sections-rule], [data-sections-hair], svg, .fx-over, .fx-over *, .fx-arrow"),
    ).length,
  }));
  expect(read.lines, "SplitText ran").toBeGreaterThan(0);
  expect(read.masks, "one mask per line, so the mask CSS applies").toBe(read.lines);
  expect(read.labelled, "aria none: no label stands in for the words").toBe(0);
  expect(read.hidden, "no words hidden from assistive tech").toBe(0);
  const text = squash(read.text);
  const blocks = read.blocks.map(squash);
  for (const prose of Object.values(PROSE).flat()) {
    expect(text, "document.body.innerText").toContain(squash(prose));
    expect(blocks.some((block) => block.includes(squash(prose))), `textContent keeps its spaces: ${prose.slice(0, 40)}`).toBe(true);
  }
});

async function holdGeometry(page: Page, id: string) {
  return page.evaluate((id) => {
    const column = document.querySelector<HTMLElement>(`${id} .sections-sticky-col`)!;
    const held = column.querySelector<HTMLElement>("[data-sections-sticky]")!.getBoundingClientRect();
    const flow = (column.nextElementSibling as HTMLElement).getBoundingClientRect();
    const box = column.getBoundingClientRect();
    return {
      columnTop: box.top + window.scrollY,
      columnBottom: box.bottom,
      columnHeight: box.height,
      heldTop: held.top,
      heldBottom: held.bottom,
      heldHeight: held.height,
      flowTop: flow.top,
      flowBottom: flow.bottom,
    };
  }, id);
}

for (const id of STICKY) {
  test(`sections: ${id} holds at the sticky top while its other column scrolls, and lets go early`, async ({ page }) => {
    await openHome(page);
    const { stickyTop, stopOffset } = GRAMMAR;
    const rest = await holdGeometry(page, id);
    expect(Math.round(rest.flowBottom - rest.columnBottom), "the column ends early by the stop offset").toBe(stopOffset);
    const travel = rest.columnHeight - rest.heldHeight;
    expect(travel, "room for the hold to show").toBeGreaterThan(80);
    const flowTops: number[] = [];
    for (const into of [20, travel - 20]) {
      await scrollToY(page, Math.round(rest.columnTop - stickyTop + into));
      const now = await holdGeometry(page, id);
      expect(Math.abs(now.heldTop - stickyTop), `held ${into}px into the hold`).toBeLessThan(1);
      flowTops.push(now.flowTop);
    }
    expect(flowTops[0] - flowTops[1], "the other column scrolled past the held one").toBeGreaterThan(travel - 41);
    await scrollToY(page, Math.round(rest.columnTop - stickyTop + travel + 60));
    const past = await holdGeometry(page, id);
    expect(Math.abs(past.heldBottom - past.columnBottom), "let go at the column's early end").toBeLessThan(1);
    expect(past.heldTop).toBeLessThan(stickyTop - 50);
  });
}

test("sections: an Up to now item below the fold is masked before its band and risen once scrolled past it", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  const item = page.locator('#up-to-now [data-sections-block="item"]').last();
  const lift = () =>
    item.locator("[data-sections-text]").evaluate((el) => {
      const transform = getComputedStyle(el).transform;
      return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await lift(), "below its mask before its band").toBeGreaterThan(10);
  const top = await item.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  // Its top at 30 percent of the viewport: past the band's end (60, less the 6 an item follows by).
  await scrollToY(page, Math.round(top - page.viewportSize()!.height * 0.3));
  await expect.poll(async () => Math.abs(await lift()) < 0.5, { message: "the words in place once the scrub has caught up" }).toBe(true);
});
