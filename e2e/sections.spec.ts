import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { nextFrames, openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { siteContent } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { GRAMMAR } from "@/lib/sections/grammar";

// The sections grammar on the home (lib/sections, components/sections): what
// a reader sees with and without reduced motion, what assistive tech reads
// once SplitText has run, and the sticky holds. Each section lists the prose
// it must keep, word for word.

const { whoIAm, connect } = siteContent;
const PROSE: Record<string, string[]> = Object.fromEntries(
  Object.entries({
    "#about": [
      whoIAm.heading,
      whoIAm.smallPrint,
      ...whoIAm.blocks.flatMap((block) => [block.label, block.body, ...(block.sub ? [block.sub.label, block.sub.body] : [])]),
    ],
    "#connect": [connect.heading, connect.lede, ...connect.links.map((link) => link.value)],
  }).map(([id, prose]) => [id, prose.map(visibleText)]),
);
const STICKY = ["#about"];
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

// How far up a lines-split block has risen, as its lines' mean drop below their masks in px: a
// block part way in sits between its masked and its whole value, however many lines it wraps to.
async function meanLift(page: Page, block: string) {
  return page.locator(block).evaluate((el) => {
    const drops = [...el.querySelectorAll<HTMLElement>(".sections-line")].map((line) => {
      const transform = getComputedStyle(line).transform;
      return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    });
    return Math.round((drops.reduce((sum, drop) => sum + drop, 0) / drops.length) * 10) / 10;
  });
}
const LAST_BODY = '#about [data-sections-block="body"][data-sections-split="lines"] >> nth=-1';

test("sections: a Who I am block below the fold is masked before its band and risen once scrolled past it", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await meanLift(page, LAST_BODY), "below its mask before its band").toBeGreaterThan(10);
  const top = await page.locator(LAST_BODY).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  // Its top at 30 percent of the viewport: past the band's end (60, less the 6 a body follows by).
  await scrollToY(page, Math.round(top - page.viewportSize()!.height * 0.3));
  await expect.poll(async () => Math.abs(await meanLift(page, LAST_BODY)) < 0.5, { message: "the words in place once the scrub has caught up" }).toBe(true);
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
      [...document.querySelectorAll<HTMLElement>("#connect [data-sections-row] [data-connect-value]")]
        .filter((value) => !value.closest(".fx-over"))
        .map((value) => ({
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

// Aaron, 2026-10-08: scrolling down masks every block in; scrolling back up
// leaves each where it got to, whole or half way. A refresh starts over.
async function partsOff(page: Page, ids: string[]) {
  return page.evaluate(
    ({ ids, skip }) => {
      const off: string[] = [];
      for (const id of ids) {
        for (const block of document.querySelectorAll<HTMLElement>(`${id} [data-sections-block]`)) {
          for (const el of block.querySelectorAll<HTMLElement>("*")) {
            if (el.matches(skip)) continue;
            const style = getComputedStyle(el);
            const whole = style.transform === "none" || new DOMMatrixReadOnly(style.transform).isIdentity;
            if (style.opacity !== "1" || !whole || style.filter !== "none") {
              off.push(`${id} ${block.dataset.sectionsBlock} ${el.tagName} ${style.opacity} ${style.transform} ${style.filter}`);
            }
          }
        }
      }
      return off;
    },
    { ids, skip: SKIP },
  );
}

// Reads twice, a beat apart, until the reading stops changing: the scrub's
// lag has run out.
async function steady<T>(page: Page, read: () => Promise<T>): Promise<T> {
  let last = JSON.stringify(await read());
  await expect
    .poll(async () => {
      await page.waitForTimeout(250);
      const now = JSON.stringify(await read());
      const same = now === last;
      last = now;
      return same;
    }, { message: "the reveal settles", timeout: 8000 })
    .toBe(true);
  return JSON.parse(last) as T;
}

test("sections: once risen, Who I am stays whole when the reader scrolls back up", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  const risen = ["#about"];
  await scrollToY(page, await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight));
  await expect.poll(() => partsOff(page, risen), { message: "whole at the footer", timeout: 8000 }).toEqual([]);
  await scrollToY(page, 0);
  expect(await steady(page, () => partsOff(page, risen)), "still whole back at the top").toEqual([]);
});

test("sections: a block scrolled back above its band half revealed stays as it was", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  const masked = await meanLift(page, LAST_BODY);
  expect(masked, "masked before its band").toBeGreaterThan(10);
  const top = await page.locator(LAST_BODY).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  // Its top at 72 percent of the viewport: inside its band (84 to 54).
  await scrollToY(page, Math.round(top - page.viewportSize()!.height * 0.72));
  const halfway = await steady(page, () => meanLift(page, LAST_BODY));
  expect(halfway, "part way up").toBeGreaterThan(0.5);
  expect(halfway, "part way up").toBeLessThan(masked - 0.5);
  await scrollToY(page, 0);
  expect(Math.abs((await steady(page, () => meanLift(page, LAST_BODY))) - halfway), "held where it got to").toBeLessThan(0.5);
});

// autoSplit re-splits Who I am on a width change and builds a new timeline
// for the same block; it starts where the old one was shown, not masked.
test("sections: a re-split after Who I am has risen keeps it whole", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  await scrollToY(page, await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight));
  await expect.poll(() => partsOff(page, ["#about"]), { timeout: 8000 }).toEqual([]);
  await scrollToY(page, 0);
  await resplit(page, "#about");
  expect(await steady(page, () => partsOff(page, ["#about"])), "whole after the re-split").toEqual([]);
});

// Narrows the page to 1000px and waits for SplitText to replace the block's
// lines: a line from before the resize leaves the document.
async function resplit(page: Page, id: string) {
  await page.evaluate((id) => {
    Object.assign(window, { __e2eOldLine: document.querySelector(`${id} .sections-line`) });
  }, id);
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect
    .poll(() => page.evaluate(() => !(window as unknown as { __e2eOldLine: Element }).__e2eOldLine.isConnected), { message: "re-split at the new width" })
    .toBe(true);
}

// Each line's drop below its mask, as a percent of its own height.
async function lineDrops(page: Page, block: string) {
  return page.locator(block).evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>(".sections-line")].map((line) => {
      const transform = getComputedStyle(line).transform;
      const drop = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
      return Math.round((drop / line.offsetHeight) * 1000) / 10;
    }),
  );
}

// A re-split mid-reveal carries on from the share the old timeline showed.
// Narrower means more lines on a longer stagger, so at the same share every
// line by index is as far up as it was, or further.
test("sections: a re-split while Who I am is part way in drops no line", async ({ page }) => {
  await openHome(page);
  await blocksIn(page, "armed");
  const body = '#about [data-sections-block="body"][data-sections-split="lines"] >> nth=0';
  const top = await page.locator(body).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  // Its top at 69 percent of the viewport: half way through its band (84 to 54).
  await scrollToY(page, Math.round(top - page.viewportSize()!.height * 0.69));
  const before = await steady(page, () => lineDrops(page, body));
  expect(before.some((drop) => drop < 1), "some lines risen").toBe(true);
  expect(before.some((drop) => drop > 50), "some lines still mostly masked").toBe(true);
  await scrollToY(page, 0);
  await resplit(page, "#about");
  // From the first frame of the new lines through the chase's tail: a
  // timeline that started over masked would chase back up to the same mark,
  // so only the frames in between can tell.
  for (let sample = 0; sample < 15; sample += 1) {
    const after = await lineDrops(page, body);
    expect(after.length, "more lines at the narrower width").toBeGreaterThan(before.length);
    for (const [line, drop] of before.entries()) expect(after[line], `sample ${sample}: line ${line} sits no lower than before`).toBeLessThanOrEqual(drop + 1);
    await page.waitForTimeout(100);
  }
});

// The flip to reduced motion reverts every block, risen, half way or masked,
// to the markup a reduced-motion load serves. GSAP's revert leaves an empty
// style attribute behind (it did before reveals stayed risen too), which
// styles nothing.
test("sections: a live flip to reduced motion mid-page returns every block's server markup", async ({ page }) => {
  const blocks = (target: Page) =>
    target.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-sections-block]")].map((block) => block.outerHTML.replaceAll(' style=""', "")),
    );
  const still = await page.context().newPage();
  await still.emulateMedia({ reducedMotion: "reduce" });
  await still.goto("/");
  await settled(still);
  await blocksIn(still, "still");
  const served = await blocks(still);
  await still.close();

  await openHome(page);
  await blocksIn(page, "armed");
  const top = await page.locator(LAST_BODY).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await scrollToY(page, Math.round(top - page.viewportSize()!.height * 0.72));
  await nextFrames(page, 10);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await blocksIn(page, "still");
  expect(await blocks(page)).toEqual(served);
});
