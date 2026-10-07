import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { siteContent } from "@/lib/content";
import { GRAMMAR } from "@/lib/sections/grammar";

// The sections grammar on the home (lib/sections, components/sections): what
// a reader sees with and without reduced motion, what assistive tech reads
// once SplitText has run, and the sticky holds. Each section lists the prose
// it must keep, word for word.

const { about, whoIAm, upToNow, connect } = siteContent;
const PROSE: Record<string, string[]> = {
  "#about": [about.heading, about.lede],
  "#who-i-am": [whoIAm.paragraph],
  "#up-to-now": [upToNow.heading, ...upToNow.items],
  "#connect": [connect.heading, connect.lede, ...connect.links.map((link) => link.value)],
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

test("sections: a Connect link focused before its row has risen shows at once", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  const row = page.locator("#connect [data-sections-row]").first();
  const shown = () =>
    row.evaluate((el) => {
      const style = getComputedStyle(el.querySelector("[data-sections-rowinner]")!);
      return style.opacity === "1" && style.transform === "none";
    });
  expect(await shown(), "masked before its band").toBe(false);
  await row.locator("a").evaluate((a) => (a as HTMLElement).focus({ preventScroll: true }));
  expect(await shown()).toBe(true);
});

test("sections: Connect's columns fit a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const rights = await page.evaluate(() =>
    [...document.querySelector("#connect > div")!.children].map((child) => Math.round(child.getBoundingClientRect().right)),
  );
  for (const right of rights) expect(right, "inside the 24px gutter").toBeLessThanOrEqual(390 - 24);
});

test("sections: no Connect value is cut short at 1024 or at 390", async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openHome(page);
    const values = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("#connect [data-sections-row] [data-connect-value]")].map((value) => ({
        text: value.textContent,
        scrollWidth: value.scrollWidth,
        clientWidth: value.clientWidth,
      })),
    );
    expect(values.length, "one value per link").toBe(connect.links.length);
    for (const value of values) {
      expect(value.scrollWidth, `${value.text} overflows its cell at ${viewport.width}`).toBeLessThanOrEqual(value.clientWidth);
    }
  }
});

// A block already past its band on a deep load must never paint masked. The
// observer's callback is a microtask after the task that armed the block,
// which is the first moment the browser could paint it.
test("sections: a deep load at #connect: every block past its band is whole the moment it arms", async ({ page }) => {
  const pastBand = (GRAMMAR.bandEnd - GRAMMAR.follow - 4) / 100;
  await page.addInitScript((pastBand) => {
    const parts = [
      ".sections-line",
      "[data-sections-inner]",
      "[data-sections-rule]",
      "[data-sections-label]",
      "[data-sections-hair]",
      "[data-sections-text]",
      "[data-sections-rowinner]",
    ].join(", ");
    const record = { observed: 0, masked: [] as string[] };
    Object.assign(window, { __e2eArmed: record });
    new MutationObserver((mutations) => {
      for (const { target } of mutations) {
        const block = target as HTMLElement;
        if (block.dataset.sectionsState !== "armed") continue;
        if (block.getBoundingClientRect().top > window.innerHeight * pastBand) continue;
        record.observed += 1;
        for (const part of block.querySelectorAll<HTMLElement>(parts)) {
          if (part.closest(".fx-over")) continue;
          const style = getComputedStyle(part);
          const whole = style.transform === "none" || new DOMMatrixReadOnly(style.transform).isIdentity;
          if (Number(style.opacity) < 1 || !whole) {
            const section = block.closest("section")?.id ?? "?";
            record.masked.push(`${section} ${block.dataset.sectionsBlock} ${part.className || part.tagName} ${style.opacity} ${style.transform}`);
          }
        }
      }
    }).observe(document, { attributes: true, attributeFilter: ["data-sections-state"], subtree: true });
  }, pastBand);
  await page.goto("/#connect");
  await settled(page);
  await blocksIn(page, "armed");
  const record = await page.evaluate(() => (window as unknown as { __e2eArmed: { observed: number; masked: string[] } }).__e2eArmed);
  expect(record.observed, "blocks past their band when they armed").toBeGreaterThan(0);
  expect(record.masked).toEqual([]);
});

// A live toggle back to motion re-arms every block inside GSAP's matchMedia
// rebuild, while ScrollTrigger holds the page's scroll to restore after its
// refresh. Nothing in the re-arm may make it lose that place.
test("sections: a live reduced-motion toggle at #connect keeps the reader where they are", async ({ page }) => {
  await page.goto("/#connect");
  await settled(page);
  await blocksIn(page, "armed");
  const before = await page.evaluate(() => window.scrollY);
  expect(before, "a deep load, well down the page").toBeGreaterThan(1000);
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await blocksIn(page, reducedMotion === "reduce" ? "still" : "armed");
    await nextFrames(page, 2);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before), `scroll held through the toggle to ${reducedMotion}`).toBeLessThan(2);
  }
});
