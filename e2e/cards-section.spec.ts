import { test, expect } from "./support/fixtures";
import { cardDialog } from "./support/cards";
import { cardAt, coilPoints, openHome, scrollToCards, scrollToFoot } from "./support/coil";
import { approach } from "./support/input";
import { decodePng } from "./support/pixels";
import type { HookWindow } from "./support/hooks";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { PROFA_CAP_HEIGHT_EM, PROFA_X_HEIGHT_EM } from "@/lib/home/seenDot";

// The cards section (#work): the Coil between two columns of short titles,
// and the fork at the intro's foot that scrolls to it.

const { columns, intro } = siteContent;
const titles = columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles));

const M = siteContent.menu;
const accentColor = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-accent)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });

test("cards section: the two columns hold the fourteen cards, Work on the left and Builds with Off the clock on the right, their headings in the accent", async ({ page }) => {
  await openHome(page);
  expect(titles).toHaveLength(14);
  const left = await page.locator("#work h3").first().boundingBox();
  const right = await page.locator("#work h3").nth(1).boundingBox();
  expect(left!.x).toBeLessThan(right!.x);
  await expect(page.locator("#work h3")).toHaveText(["Work", "Builds"]);
  await expect(page.locator("#work h4")).toHaveText(["Off the clock"]);
  for (const title of titles) await expect(page.locator(`#work button[data-card="${title.key}"]`)).toHaveText(title.short);
  // The headings are the accent token and a size and colour of their own, never one more title.
  const accent = await accentColor(page);
  for (const heading of await page.locator("#work h3, #work h4").all()) {
    const style = await heading.evaluate((el) => ({ color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }));
    expect(style.color, await heading.innerText()).toBe(accent);
  }
  const title = await page.locator('#work button[data-card="capital-one"]').evaluate((el) => ({ color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }));
  const heading = await page.locator("#work h3").first().evaluate((el) => ({ color: getComputedStyle(el).color, size: parseFloat(getComputedStyle(el).fontSize) }));
  expect(heading.color).not.toBe(title.color);
  expect(title.size, "titles are larger than the headings").toBeGreaterThan(heading.size);
});

// The Work column's jobs title reads "Part-time jobs": one title like "Family business", the same face, weight and colour as
// every other title in the column, one button with one accessible name.
test("cards section: the Work column's jobs title reads Part-time jobs, set like every other title in the column", async ({ page }) => {
  await openHome(page);
  const jobs = page.locator('#work button[data-card="jobs"]');
  await jobs.scrollIntoViewIfNeeded();
  await expect(jobs).toHaveText("Part-time jobs");
  await expect(page.locator('#work button[data-card="jobs"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Part-time jobs" })).toHaveCount(1);
  await expect(page.locator("[data-title-qualifier]")).toHaveCount(0);
  // It sits in the Work column, among the other work titles.
  expect(await jobs.evaluate((el) => !!el.closest("li")?.parentElement?.querySelector('button[data-card="capital-one"]'))).toBe(true);
  const look = (key: string) =>
    page.locator(`#work button[data-card="${key}"]`).evaluate((el) => {
      const words = el.querySelector("span span")!;
      const style = getComputedStyle(words);
      return { family: style.fontFamily, weight: style.fontWeight, size: style.fontSize, color: style.color, height: el.getBoundingClientRect().height };
    });
  const [mine, family] = [await look("jobs"), await look("fsdatalink")];
  expect(mine, "set exactly as Family business is").toEqual(family);
  await jobs.click();
  await expect(cardDialog(page, "jobs")).toBeVisible();
});

// The lists are a size larger and the gutters a little wider for them: at 1280 and 1440 nothing of either column reaches into the pane the Coil is laid out in, or past the screen's edge.
for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`cards section: both columns stay in their gutters, clear of the Coil's pane, at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openHome(page);
    const read = await page.evaluate(() => {
      const pane = document.querySelector("[data-coil-pane]")!.getBoundingClientRect();
      const boxes = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getClientRects().length).map((el) => el.getBoundingClientRect());
      const left = boxes('#work [data-deal-title] button, #work [data-card-progress], #work [data-page-title], #work h3:first-of-type').filter((r) => r.left < pane.left);
      const right = boxes("#work [data-deal-title] button, #work h3, #work h4").filter((r) => r.left >= pane.right - 1);
      return {
        pane: { left: pane.left, right: pane.right },
        leftmostRight: Math.min(...right.map((r) => r.left)),
        leftEdge: Math.max(...left.map((r) => r.right)),
        rightEdge: Math.max(...right.map((r) => r.right)),
        counts: [left.length, right.length],
      };
    });
    expect(read.counts[0], "left column boxes").toBeGreaterThan(6);
    expect(read.counts[1], "right column boxes").toBeGreaterThan(6);
    expect(read.leftEdge, "the Work column's right edge against the pane").toBeLessThanOrEqual(read.pane.left);
    expect(read.leftmostRight, "the Builds column's left edge against the pane").toBeGreaterThanOrEqual(read.pane.right - 1);
    expect(read.rightEdge, "the Builds column inside the screen").toBeLessThanOrEqual(size.width - 8);
  });
}

test("cards section: the page's number and title lead the Work column and answer page 1's question", async ({ page }) => {
  await openHome(page);
  const heading = page.locator("#work [data-page-title]:visible");
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText(siteContent.columns.title);
  await expect(heading).toHaveJSProperty("tagName", "H2");
  await expect(page.locator("#work [data-section-number]:visible")).toHaveText("02");
  const box = (await heading.boundingBox())!;
  const work = (await page.locator("#work h3").first().boundingBox())!;
  expect(box.y + box.height, "the title sits above the Work heading").toBeLessThanOrEqual(work.y);
  expect(Math.abs(box.x - work.x), "and shares its left edge").toBeLessThan(2);
});

test("cards section: Deal me in at page 1's foot takes the page to the cards, and a visit starts at the top of the intro", async ({ page }) => {
  await openHome(page, { at: "top" });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await scrollToFoot(page);
  await page.getByRole("link", { name: intro.teaser.deal }).click();
  await page.waitForFunction(() => Math.abs(document.getElementById("work")!.getBoundingClientRect().top) < 2, null, { timeout: 8000 });
  await expect(page.getByRole("link", { name: intro.teaser.quick })).toHaveAttribute("href", "/quick");
});

test("cards section: hovering a title brings its card to the front and holds the Coil there", async ({ page }) => {
  await openHome(page);
  // A real move first: hover focus waits for the pointer to move (lib/home/hoverArm.ts), not for a title to land under a parked one.
  await page.mouse.move(720, 450);
  await page.locator('#work button[data-card="talos"]').hover();
  await expect.poll(() => page.evaluate(() => (window as HookWindow).__coil!.focusKey())).toBe("talos");
  await page.mouse.move(720, 4);
  await expect.poll(() => page.evaluate(() => (window as HookWindow).__coil!.focusKey())).toBeNull();
});

test("cards section: hovering a card in the Coil lights its title", async ({ page, cdp }) => {
  await openHome(page);
  const { card } = await coilPoints(page);
  await approach(cdp, card);
  const hit = (await cardAt(page, card))!;
  await expect(page.locator(`#work button[data-card="${hit.key}"]`)).toHaveAttribute("data-lit", "");
  await expect(page.locator("#work button[data-lit]")).toHaveCount(1);
});

test("cards section: clicking a title opens its card with the flight, and the title carries the seen dot once it is closed", async ({ page }) => {
  await openHome(page);
  const title = page.locator('#work button[data-card="ieee"]');
  await expect(title.locator("[aria-hidden]")).toHaveCount(0);
  await title.click();
  await expect(cardDialog(page, "ieee")).toBeVisible();
  await expect(page.locator("[data-flying-tile]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(cardDialog(page, "ieee")).toHaveCount(0);
  await expect(title.locator("[aria-hidden]")).toHaveCount(1);
  await expect(title).toBeFocused();
});

test("cards section: the Menu marks Work in the cards and Proof of work below them, and Home on page 1", async ({ page }) => {
  await openHome(page, { at: "top" });
  const here = async () => {
    await page.getByRole("button", { name: M.ariaLabelOpen }).click();
    const current = page.getByRole("dialog", { name: M.dialogLabel }).locator('a[aria-current="location"]');
    await expect(current).toHaveCount(1);
    const text = (await current.innerText()).replace(/^\d+\s*/, "").trim();
    await page.getByRole("button", { name: M.ariaLabelClose }).click();
    await expect(page.getByRole("dialog", { name: M.dialogLabel })).toHaveCount(0);
    return text;
  };
  expect(await here()).toBe("Home");
  await scrollToCards(page, 200);
  expect(await here()).toBe("Work");
  await page.evaluate(() => window.scrollTo({ top: document.getElementById("numbers")!.getBoundingClientRect().top + window.scrollY, behavior: "instant" }));
  expect(await here()).toBe("Proof of work");
});

// The seen store the dots, the Coil's rings and the progress line read, seeded before the page loads.
const seed = (page: import("@playwright/test").Page, keys: string[]) => page.addInitScript(([key, value]) => sessionStorage.setItem(key, value), [SEEN_STORAGE_KEY, JSON.stringify(keys)] as const);

test("cards section: the progress line is hidden at none opened, then reads N of 14 with a thin accent bar under the Work column", async ({ page }) => {
  await openHome(page);
  const progress = page.locator("#work [data-card-progress]:visible");
  await expect(progress).toHaveCount(1);
  await expect(progress).toHaveAttribute("aria-hidden", "true");
  expect(await progress.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  const title = page.locator('#work button[data-card="ieee"]');
  await title.click();
  await expect(cardDialog(page, "ieee")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cardDialog(page, "ieee")).toHaveCount(0);
  await expect(progress).toContainText(columns.progress(1, 14));
  await expect.poll(() => progress.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(progress).not.toHaveAttribute("aria-hidden");
  // Under the Work column: below its last title, on its left edge, and its bar is one fourteenth full.
  const last = (await page.locator('#work button[data-card="mentorship"]').boundingBox())!;
  const box = (await progress.boundingBox())!;
  const work = (await page.locator("#work h3").first().boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(last.y + last.height - 1);
  expect(Math.abs(box.x - work.x)).toBeLessThan(2);
  const bar = progress.locator("[data-card-progress-bar]");
  expect(await bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(1 / 14, 2);
  expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await accentColor(page));
  expect((await progress.locator('[role="presentation"]').boundingBox())!.height).toBeLessThanOrEqual(4);
});

test("cards section: the seen dot is centered on its title's last word, to half a pixel: the x-height middle, and the capitals' middle for IEEE", async ({ page }) => {
  await seed(page, titles.map((title) => title.key));
  for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await openHome(page);
    await expect(page.locator("#work [data-seen-dot]")).toHaveCount(14);
    const offsets = await page.evaluate(
      ([cap, xHeight]) =>
        [...document.querySelectorAll<HTMLElement>("#work button[data-card]")].map((button) => {
          const dot = button.querySelector<HTMLElement>("[data-seen-dot]")!;
          const box = dot.getBoundingClientRect();
          // The baseline of the line: the bottom of an empty inline box set on it, just before the dot.
          const probe = document.createElement("span");
          probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
          dot.parentElement!.insertBefore(probe, dot);
          const baseline = probe.getBoundingClientRect().bottom;
          probe.remove();
          const size = parseFloat(getComputedStyle(dot).fontSize);
          const caps = !/\p{Ll}/u.test(dot.parentElement!.textContent ?? "");
          const middle = baseline - ((caps ? cap : xHeight) * size) / 2;
          return { key: button.dataset.card!, caps, offset: box.top + box.height / 2 - middle };
        }),
      [PROFA_CAP_HEIGHT_EM, PROFA_X_HEIGHT_EM],
    );
    expect(offsets.filter((entry) => entry.caps).map((entry) => entry.key)).toEqual(["ieee"]);
    for (const { key, offset } of offsets) expect(Math.abs(offset), `${key} at ${viewport.width}`).toBeLessThanOrEqual(0.5);
  }
});

// What Aaron checks by pixel: the painted dot against the painted capitals of IEEE (the "I" stem's flat top and foot give the cap
// height to a fraction of a pixel; the dot's ring gives the dot), at two pixels to the CSS pixel, on a desktop and a phone.
test.describe("seen dot, painted", () => {
  test.use({ deviceScaleFactor: 2 });

  test("cards section: the seen dot on IEEE is centered on its capitals within half a pixel, as painted", async ({ page }) => {
    await seed(page, titles.map((title) => title.key));
    for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await openHome(page);
      const geo = await page.evaluate(() => {
        const dot = document.querySelector<HTMLElement>('#work button[data-card="ieee"] [data-seen-dot]')!;
        const word = dot.parentElement!.firstChild as Text;
        const letter = document.createRange();
        letter.setStart(word, 0);
        letter.setEnd(word, 1);
        const stem = letter.getBoundingClientRect();
        const ring = dot.getBoundingClientRect();
        return { stemX: stem.left + stem.width / 2, dotX: ring.left + ring.width / 2, top: Math.floor(ring.top) - 14, left: Math.floor(stem.left) - 2, right: Math.ceil(ring.right) + 2 };
      });
      const clip = { x: geo.left, y: geo.top, width: geo.right - geo.left, height: 36 };
      const image = decodePng(await page.screenshot({ clip, scale: "device" }));
      const scale = 2;
      const column = (x: number) => {
        const px = Math.round((x - clip.x) * scale);
        const bg = [image.rgba[0], image.rgba[1], image.rgba[2]];
        const signal: number[] = [];
        for (let y = 0; y < image.height; y++) {
          const i = (y * image.width + px) * 4;
          signal.push(Math.abs(image.rgba[i] - bg[0]) + Math.abs(image.rgba[i + 1] - bg[1]) + Math.abs(image.rgba[i + 2] - bg[2]));
        }
        return signal;
      };
      // The edges of a vertical profile, by coverage: the first and last rows with signal, each counted by how full it is.
      const edges = (signal: number[]) => {
        const peak = Math.max(...signal);
        const rows = signal.flatMap((value, row) => (value > peak * 0.04 ? [row] : []));
        const first = rows[0];
        const last = rows[rows.length - 1];
        return { top: (first + (1 - Math.min(1, signal[first] / peak))) / scale, bottom: (last + Math.min(1, signal[last] / peak)) / scale };
      };
      const stem = edges(column(geo.stemX));
      const ring = edges(column(geo.dotX));
      const offset = (ring.top + ring.bottom) / 2 - (stem.top + stem.bottom) / 2;
      expect(stem.bottom - stem.top, `the capitals' height at ${viewport.width}`).toBeGreaterThan(9);
      expect(ring.bottom - ring.top, `the dot's height at ${viewport.width}`).toBeCloseTo(8, 0);
      expect(Math.abs(offset), `the dot against the capitals at ${viewport.width}`).toBeLessThanOrEqual(0.5);
    }
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // Page 2 on a phone (Aaron, 2026-10-30): the Coil's band is most of the screen and the titles are its index under it,
  // the page's title and the first rows on the screen the deal lands on and the rest a scroll away (e2e/coil-phone.spec.ts).
  test("cards section: the titles are the index under the Coil, the first rows on the first screen, and a tap turns the Coil and opens the card", async ({ page }) => {
    await openHome(page);
    const coilBottom = await page.locator("#work [data-coil-stage]").evaluate((el) => el.getBoundingClientRect().bottom);
    const firstTitleTop = await page.locator('#work button[data-card="capital-one"]').evaluate((el) => el.getBoundingClientRect().top);
    expect(firstTitleTop).toBeGreaterThanOrEqual(coilBottom - 2);
    for (const key of ["capital-one", "min-max"]) await expect(page.locator(`#work button[data-card="${key}"]`)).toBeInViewport({ ratio: 1 });
    await page.locator('#work button[data-card="travel"]').tap();
    await expect(cardDialog(page, "travel")).toBeVisible({ timeout: 8000 });
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`cards section: no title sits over the Coil's canvas on a phone, in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openHome(page);
      const stage = await page.locator("#work [data-coil-stage]").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      // The Coil fills the top part of the section and the columns sit under it: the stage has let go of page 1's foot, so it is the section's frame.
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("work")!).getPropertyValue("--run-lead"))).toBe("0px");
      const section = await page.evaluate(() => document.getElementById("work")!.getBoundingClientRect().height);
      // The band is most of the screen (COIL.phone.bandSvh); the section also holds the page's title above the columns and the
      // progress line under them.
      expect(stage.bottom - stage.top, "the Coil's band").toBeGreaterThanOrEqual((844 * COIL.phone.bandSvh) / 100 - 1);
      expect(stage.bottom - stage.top, "the Coil's share of the section").toBeGreaterThan(section * 0.4);
      expect(stage.bottom - stage.top, "the Coil's share of the section").toBeLessThan(section * 0.7);
      for (const title of titles) {
        const box = await page.locator(`#work button[data-card="${title.key}"]`).evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        });
        const overlaps = box.top < stage.bottom - 1 && box.bottom > stage.top + 1 && box.left < stage.right && box.right > stage.left;
        expect(overlaps, `${title.key} is clear of the Coil`).toBe(false);
      }
      // Two columns side by side under it.
      const lefts = await Promise.all(["capital-one", "min-max"].map((key) => page.locator(`#work button[data-card="${key}"]`).evaluate((el) => el.getBoundingClientRect().left)));
      expect(lefts[1]).toBeGreaterThan(lefts[0] + 100);
    });
  }
});
