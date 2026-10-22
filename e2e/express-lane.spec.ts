import { siteContent } from "@/lib/content";
import { DEFAULT_NEXT_ID, quickCopy, quickEntries, quickNextVariants } from "@/lib/content/quick";
import { INVITE_KEY } from "@/lib/quick/invite";
import { test, expect } from "./support/fixtures";
import { watchScripts } from "./support/chunks";
import type { Page } from "@playwright/test";

// The Express lane (docs/superpowers/specs/2026-10-13-express-lane-design.md):
// its tiles open the cards' own modals, the first-visit invite asks once, the
// transition runs both ways and lands focus on the new page's heading, and the
// lane never fetches the Coil's chunk. The invite is the subject here, so the
// suite's default of a dismissed invite is switched off.
test.use({ inviteDismissed: false });

const tile = (page: Page, slot: string) => page.locator(`main button[data-quick-slot="${slot}"]`);
const homeReady = (page: Page) => expect(page.locator("html")).toHaveAttribute("data-home", "ready", { timeout: 20_000 });
const idle = (page: Page) => expect(page.locator("[data-transition]")).toHaveAttribute("data-transition", "idle", { timeout: 10_000 });

test("express lane: every tile opens its own card's modal, Escape closes it and focus returns to the tile", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.locator("h1")).toHaveAccessibleName(quickCopy.title);
  await expect(page.locator("[data-quick-hint]")).toHaveText(quickCopy.hint);
  for (const entry of quickEntries) {
    const button = tile(page, entry.slot);
    await button.click();
    const dialog = page.locator(`[role="dialog"][data-card-modal="${entry.id}"]`);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2").first()).toHaveText(siteContent.cards[entry.id].modal.title);
    await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  }
});

test("express lane: the page reads whole at first paint and never requests the scene's chunk", async ({ page }) => {
  const scripts = watchScripts(page);
  await page.goto("/quick");
  await page.waitForLoadState("networkidle");
  for (const year of ["2021", "2022", "2023", "2024", "2025", "2026"]) await expect(page.locator(`#year-${year} h2`)).toHaveText(year);
  await expect(page.locator("main h2").first()).toHaveText("2026");
  await expect(page.locator("#whats-next h2")).toHaveText(quickCopy.next.label);
  await expect(page.locator("main button[data-card]")).toHaveCount(quickEntries.length);
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
  expect(await scripts.sceneChunks()).toEqual([]);
});

test("express lane: the first-visit invite shows once, and never again once dismissed", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  const pill = page.locator('[data-express-invite="pill"]');
  const toast = page.locator('[data-express-invite="toast"]');
  await expect(toast).toBeVisible({ timeout: 6_000 });
  await expect(pill).toHaveCount(0);
  await toast.getByRole("button", { name: quickCopy.invite.no }).click();
  await expect(pill).toHaveCount(0);
  await expect(toast).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), INVITE_KEY)).toBe("dismissed");
  await page.reload();
  await homeReady(page);
  await page.waitForTimeout(3_000);
  await expect(pill).toHaveCount(0);
  await expect(toast).toHaveCount(0);
});

test("express lane: the invite never shows on a deep landing past the hero", async ({ page }) => {
  await page.goto("/#about");
  await homeReady(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(3_000);
  await expect(page.locator('[data-express-invite="pill"], [data-express-invite="toast"]')).toHaveCount(0);
});

test("express lane: the transition runs both ways and lands focus on each page's heading", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  await page.locator('[data-express-invite="toast"]').getByRole("button", { name: quickCopy.invite.yes }).click({ timeout: 8_000 });
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), INVITE_KEY)).toBe("used");

  await page.locator("main").getByRole("link", { name: quickCopy.back }).click();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-home", "ready");
  await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await page.goBack();
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
});

test("express lane: the Menu chip takes either page to the other", async ({ page }) => {
  await page.goto("/quick");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: quickCopy.back }).click();
  await expect(page).toHaveURL(/\/$/);
  await idle(page);
  await expect(page.locator("#hero-heading")).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: quickCopy.menuChip }).click();
  await expect(page).toHaveURL(/\/quick$/);
  await idle(page);
  await expect(page.locator("#express-lane-title")).toBeFocused();
});

// The tile pictures reveal on their own trigger, not the timeline's: a tile
// wholly on screen is never an empty frame, whatever the reading line has reached.
const clippedTilesInView = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main button[data-quick-slot]")]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      })
      .filter((button) => getComputedStyle(button.querySelector("[data-quick-thumb]")!).clipPath !== "none")
      .map((button) => button.dataset.quickSlot),
  );

for (const [name, viewport] of [["1280x900", { width: 1280, height: 900 }], ["390x844", { width: 390, height: 844 }]] as const) {
  test.describe(`express lane tile pictures at ${name}`, () => {
    test.use({ viewport });

    test("a tile wholly in view is unclipped within a second, wherever the reader stops", async ({ page }) => {
      await page.goto("/quick");
      await page.waitForLoadState("networkidle");
      const last = page.locator("main button[data-quick-slot]").last();
      await expect.poll(() => last.locator("[data-quick-thumb]").evaluate((el) => getComputedStyle(el).clipPath), { timeout: 3_000 }).not.toBe("none");

      const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      const stops = Math.ceil(height / 330);
      for (let i = 1; i <= stops; i++) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), Math.min(height, i * 330));
        await expect.poll(() => clippedTilesInView(page), { timeout: 1_500, message: `stop ${i} of ${stops}` }).toEqual([]);
      }
    });

    test("under reduced motion every picture shows at once", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/quick");
      await page.waitForLoadState("networkidle");
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-quick-thumb]")].filter((el) => getComputedStyle(el).clipPath !== "none").length), { timeout: 1_500 }).toBe(0);
    });
  });
}

// The rail follows the reader both ways: scrolling down lights the years the
// reading line has passed, scrolling back up un-lights them again.
test.describe("express lane rail at 1280x900", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the active checkpoint moves back up when the reader scrolls back up", async ({ page }) => {
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    const litYears = () => page.evaluate(() => document.querySelectorAll('[data-quick-key^="year-"][data-lit="true"]').length);
    const years = await page.locator('[data-quick-key^="year-"]').count();
    expect(years).toBeGreaterThan(2);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect.poll(litYears, { timeout: 4_000 }).toBe(years);
    const middle = await page.evaluate(() => {
      const heads = [...document.querySelectorAll<HTMLElement>('[data-quick-key^="year-"]')];
      const target = heads[Math.floor(heads.length / 2)];
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.7 + 10, behavior: "instant" });
      return Math.floor(heads.length / 2) + 1;
    });
    await expect.poll(litYears, { timeout: 4_000 }).toBe(middle);
    await expect(page.locator('[data-quick-key="year-2026"]')).toHaveAttribute("data-lit", "true");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(litYears, { timeout: 4_000 }).toBeLessThan(middle);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await expect.poll(litYears, { timeout: 4_000 }).toBe(years);
  });

  test("a tile picture, once revealed, stays revealed when the reader scrolls back up", async ({ page }) => {
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const last = page.locator("main button[data-quick-slot]").last();
    await expect.poll(() => last.locator("[data-quick-thumb]").evaluate((el) => getComputedStyle(el).clipPath), { timeout: 3_000 }).toBe("none");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(800);
    expect(await last.locator("[data-quick-thumb]").evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
  });
});

// The title, M(inimum) V(iable) P(ortfolio): a tight "MVP" at first paint with
// every rest's slot at width 0, the slots opening once after the page settles and
// the title is in view, replayed by a click or Enter (never by a hover), the room
// of the finished title reserved so nothing below it moves, and the whole title
// at once under reduced motion.
const SPELLED = "M(inimum) V(iable) P(ortfolio)";
const restOpacities = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-mvp-rest]")].map((el) => Number(getComputedStyle(el).opacity)));
const slotWidths = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-mvp-slot]")].map((el) => el.getBoundingClientRect().width));
const trackFirstSlot = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __min: number };
    w.__min = Infinity;
    const slot = document.querySelector<HTMLElement>("[data-mvp-slot]")!;
    const tick = () => {
      w.__min = Math.min(w.__min, slot.getBoundingClientRect().width);
      requestAnimationFrame(tick);
    };
    tick();
  });
const minFirstSlot = (page: Page) => page.evaluate(() => (window as unknown as { __min: number }).__min);

for (const [name, viewport] of [["1280x900", { width: 1280, height: 900 }], ["390x844", { width: 390, height: 844 }]] as const) {
  test.describe(`express lane title at ${name}`, () => {
    test.use({ viewport });

    test("MVP reads tight at first paint, unfolds once, never moves what is below, and is one heading name", async ({ page }) => {
      await page.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const intro = document.querySelector<HTMLElement>("header p");
          (window as unknown as Record<string, unknown>).__first = {
            opacities: [...document.querySelectorAll<HTMLElement>("[data-mvp-rest]")].map((el) => Number(getComputedStyle(el).opacity)),
            widths: [...document.querySelectorAll<HTMLElement>("[data-mvp-slot]")].map((el) => el.getBoundingClientRect().width),
            introTop: intro?.getBoundingClientRect().top,
          };
        });
      });
      await page.goto("/quick");
      const first = await page.evaluate(() => (window as unknown as { __first: { opacities: number[]; widths: number[]; introTop: number } }).__first);
      expect(first.opacities).toEqual([0, 0, 0]);
      expect(first.widths).toEqual([0, 0, 0]);
      const h1 = page.locator("h1");
      await expect(h1).toHaveAccessibleName(quickCopy.title);
      await expect(h1.locator("span").first()).toHaveAttribute("aria-hidden", "true");
      await expect(h1.locator("[data-mvp-ghost]")).toHaveText(SPELLED);
      await expect(h1).toHaveAttribute("data-state", "open", { timeout: 4_000 });
      expect(await restOpacities(page)).toEqual([1, 1, 1]);
      for (const width of await slotWidths(page)) expect(width).toBeGreaterThan(40);
      const introTop = await page.locator("header p").first().evaluate((el) => el.getBoundingClientRect().top);
      expect(introTop).toBeCloseTo(first.introTop, 0);
    });

    test("a click or Enter plays the unfold again, a hover does not", async ({ page }) => {
      await page.goto("/quick");
      const h1 = page.locator("h1");
      await expect(h1).toHaveAttribute("data-state", "open", { timeout: 4_000 });
      await trackFirstSlot(page);
      await h1.hover();
      await page.waitForTimeout(1_200);
      expect(await minFirstSlot(page)).toBeGreaterThan(40);

      await h1.click();
      await expect.poll(() => minFirstSlot(page), { timeout: 2_000 }).toBeLessThan(5);
      await expect.poll(() => slotWidths(page).then((w) => Math.min(...w)), { timeout: 4_000 }).toBeGreaterThan(40);

      await page.evaluate(() => (window as unknown as { __min: number }).__min = Infinity);
      await h1.focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => minFirstSlot(page), { timeout: 2_000 }).toBeLessThan(5);
      await expect.poll(() => slotWidths(page).then((w) => Math.min(...w)), { timeout: 4_000 }).toBeGreaterThan(40);
    });

    test("the room under the title is the finished title's, so the intro never moves through an unfold", async ({ page }) => {
      await page.goto("/quick");
      const intro = page.locator("header p").first();
      const top = () => intro.evaluate((el) => el.getBoundingClientRect().top);
      const before = await top();
      const seen: number[] = [];
      for (let i = 0; i < 12; i++) {
        seen.push(await top());
        await page.waitForTimeout(250);
      }
      for (const value of seen) expect(Math.abs(value - before)).toBeLessThan(0.5);
    });

    test("under reduced motion the whole title shows at once", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/quick");
      await expect(page.locator("h1 [data-mvp-ghost]")).toHaveText(SPELLED);
      expect(await restOpacities(page)).toEqual([1, 1, 1]);
      for (const width of await slotWidths(page)) expect(width).toBeGreaterThan(40);
    });
  });
}

// What's next, in two places (A, its own section at the foot of the page, below
// the rail's last year and above the closing row; B, the line under the intro
// that scrolls to it) and not on the rail.
const SHIPPED_NEXT = quickNextVariants.find((variant) => variant.id === DEFAULT_NEXT_ID)!;
const topOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
const bottomOf = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);

test.describe("express lane what's next at 1280x900", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("the rail starts at 2026 and holds years only", async ({ page }) => {
    await page.goto("/quick");
    await expect(page.locator("[data-quick-key=\"next\"], #next")).toHaveCount(0);
    expect(await page.locator("ol[aria-label] > li").evaluateAll((els) => els.map((el) => el.id))).toEqual(["year-2026", "year-2025", "year-2024", "year-2023", "year-2022", "year-2021"]);
    expect(await page.locator("[data-quick-key^=\"year-\"]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.quickKey))).toEqual(["year-2026", "year-2025", "year-2024", "year-2023", "year-2022", "year-2021"]);
    expect(await topOf(page, "header")).toBeLessThan(await topOf(page, "#year-2026"));
  });

  test("A: What's next is its own section below 2021, in the year headings' type, with no dot and no line", async ({ page }) => {
    await page.goto("/quick");
    const next = page.locator("#whats-next");
    await expect(next.locator("h2")).toHaveText("What's Next?");
    await expect(next.locator("[data-quick-next-line]")).toHaveText(SHIPPED_NEXT.full);
    expect(await bottomOf(page, "#year-2021")).toBeLessThan(await topOf(page, "#whats-next"));
    expect(await bottomOf(page, "#whats-next")).toBeLessThan(await topOf(page, "#close"));
    const type = (selector: string) => page.locator(selector).evaluate((el) => { const css = getComputedStyle(el); return [css.fontFamily, css.fontSize, css.lineHeight, css.color].join("|"); });
    expect(await type("#whats-next h2")).toBe(await type("#year-2026 h2"));
    expect(await type("#whats-next [data-quick-next-line]")).toBe(await type("#year-2026 p"));
    await expect(next.locator("[data-quick-anchor], svg")).toHaveCount(0);
    expect(await page.locator("#whats-next [data-quick-key]").count()).toBe(0);
    const gap = (await topOf(page, "#whats-next")) - (await bottomOf(page, "#year-2021"));
    expect(gap).toBeGreaterThanOrEqual(192);
  });

  test("a quiet sentence under the line invites a message for my resume, with a link to LinkedIn that opens a new tab", async ({ page }) => {
    await page.goto("/quick");
    const { before, link, after } = quickCopy.next.resume;
    const resume = page.locator("#whats-next [data-quick-resume]");
    await expect(resume).toContainText(`${before}${link}${after}`);
    const linkedin = siteContent.connect.links.find((entry) => entry.key === quickCopy.next.resume.linkKey)!;
    const anchor = resume.getByRole("link", { name: link });
    await expect(anchor).toHaveCount(1);
    await expect(anchor).toHaveAttribute("href", linkedin.href);
    await expect(anchor).toHaveAttribute("target", "_blank");
    await expect(anchor).toHaveAttribute("rel", /noopener/);
    expect(await topOf(page, "#whats-next [data-quick-next-line]")).toBeLessThan(await topOf(page, "#whats-next [data-quick-resume]"));
    expect(await bottomOf(page, "#whats-next [data-quick-resume]")).toBeLessThan(await topOf(page, "#close"));
    const size = (selector: string) => page.locator(selector).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size("#whats-next [data-quick-resume]")).toBeLessThan(await size("#whats-next [data-quick-next-line]"));
    const color = (selector: string) => page.locator(selector).evaluate((el) => getComputedStyle(el).color);
    expect(await color("#whats-next [data-quick-resume]")).not.toBe(await color("#whats-next [data-quick-next-line]"));
  });

  test("the page ends on What's next, then a short row of booking and links", async ({ page }) => {
    await page.goto("/quick");
    const close = page.locator("#close");
    await expect(close.locator("h2, p")).toHaveCount(0);
    await expect(close.getByRole("link")).toHaveText([siteContent.connect.primary.label, "LinkedIn", "Email", "GitHub"]);
    await expect(close.getByRole("link", { name: siteContent.connect.primary.label })).toHaveAttribute("href", siteContent.connect.primary.href);
    expect(await page.locator("main h2").evaluateAll((els) => els.map((el) => el.textContent))).toEqual(["2026", "2025", "2024", "2023", "2022", "2021", "What's Next?"]);
  });

  test("B: a quiet line under the intro, above the hint, that does not repeat A", async ({ page }) => {
    await page.goto("/quick");
    const looking = page.locator("[data-quick-looking]");
    await expect(looking).toContainText(`${quickCopy.next.lookingFor} ${SHIPPED_NEXT.short}`);
    expect(await looking.textContent()).not.toContain(SHIPPED_NEXT.full);
    const [intro, line, hint] = [await topOf(page, "header p"), await topOf(page, "[data-quick-looking]"), await topOf(page, "[data-quick-hint]")];
    expect(intro).toBeLessThan(line);
    expect(line).toBeLessThan(hint);
  });

  test("B scrolls to What's next and lands focus on its heading", async ({ page }) => {
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    const inView = () => page.locator("#whats-next-heading").evaluate((el) => { const box = el.getBoundingClientRect(); return box.top >= 0 && box.bottom <= window.innerHeight; });
    const before = await page.evaluate(() => window.scrollY);
    await page.locator("[data-quick-looking] button").click();
    await expect(page.locator("#whats-next-heading")).toBeFocused({ timeout: 4_000 });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    expect(await inView()).toBe(true);
    await expect(page.locator("html")).not.toHaveCSS("scroll-behavior", "auto");
  });

  test("B jumps under reduced motion, decided when it is pressed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    const before = await page.evaluate(() => window.scrollY);
    await page.locator("[data-quick-looking] button").click();
    await expect(page.locator("#whats-next-heading")).toBeFocused({ timeout: 700 });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });
});

// The tips about finding the MVP again: on a mouse hover or keyboard focus, in
// the site's tip look at z-58, never on a touch screen (a small line there).
const tipOf = (page: Page) => page.locator("[data-field-tip]");

test("tip: See the full site shows its tip on hover and on keyboard focus, and Escape closes it", async ({ page }) => {
  await page.goto("/quick");
  await page.waitForLoadState("networkidle");
  const back = page.getByRole("link", { name: quickCopy.back });
  await expect(tipOf(page)).toHaveAttribute("data-shown", "false");
  await back.hover();
  await expect(tipOf(page)).toHaveAttribute("data-shown", "true");
  await expect(tipOf(page)).toHaveText(quickCopy.tips.back);
  await page.mouse.move(700, 700);
  await expect(tipOf(page)).toHaveAttribute("data-shown", "false");

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 25 && !(await back.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(back).toBeFocused();
  await expect(tipOf(page)).toHaveAttribute("data-shown", "true");
  await expect(back).toHaveAttribute("aria-describedby", (await tipOf(page).getAttribute("id"))!);
  await page.keyboard.press("Escape");
  await expect(tipOf(page)).toHaveAttribute("data-shown", "false");
});

test("tip: the page's tip does not share the button's fill, in either theme", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.goto("/quick");
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    const back = page.getByRole("link", { name: quickCopy.back });
    await back.hover();
    await expect(tipOf(page)).toHaveAttribute("data-shown", "true");
    const fills = await page.evaluate(() => ({
      button: getComputedStyle([...document.querySelectorAll("header a")].find((el) => el.textContent?.includes("See the full site"))!).backgroundColor,
      tip: getComputedStyle(document.querySelector("[data-field-tip] > span")!).backgroundColor,
    }));
    expect(fills.tip, theme).not.toBe(fills.button);
  }
});

test("tip: the toast's dismiss shows its tip above the toast, on hover and on keyboard focus", async ({ page }) => {
  await page.goto("/");
  await homeReady(page);
  const toast = page.locator('[data-express-invite="toast"]');
  await expect(toast).toBeVisible({ timeout: 6_000 });
  const dismiss = toast.getByRole("button", { name: quickCopy.invite.no });
  await expect(tipOf(page)).toHaveAttribute("data-shown", "false");
  await dismiss.hover();
  await expect(tipOf(page)).toHaveAttribute("data-shown", "true");
  await expect(tipOf(page)).toHaveText(quickCopy.tips.toast);
  const z = await page.evaluate(() => ({ tip: Number(getComputedStyle(document.querySelector("[data-field-tip]")!).zIndex), toast: Number(getComputedStyle(document.querySelector('[data-express-invite="toast"]')!).zIndex) }));
  expect(z.tip).toBe(58);
  expect(z.toast).toBeLessThan(z.tip);
  const [tipBox, toastBox] = [(await tipOf(page).boundingBox())!, (await toast.boundingBox())!];
  expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(toastBox.y);
  const fills = await page.evaluate(() => ({ toast: getComputedStyle(document.querySelector('[data-express-invite="toast"]')!).backgroundColor, tip: getComputedStyle(document.querySelector("[data-field-tip] > span")!).backgroundColor }));
  expect(fills.tip).not.toBe(fills.toast);
  await page.mouse.move(100, 300);
  await expect(tipOf(page)).toHaveAttribute("data-shown", "false");
  await dismiss.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(dismiss).toBeFocused();
  await expect(tipOf(page)).toHaveAttribute("data-shown", "true");
});

test.describe("tip on a touch screen at 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the same words sit under See the full site as a small muted caption, and no tip is shown", async ({ page }) => {
    await page.goto("/quick");
    await page.waitForLoadState("networkidle");
    const note = page.locator("[data-quick-back-note]");
    await expect(note).toBeVisible();
    await expect(note).toHaveText(quickCopy.tips.back);
    const [back, caption] = [(await page.getByRole("link", { name: quickCopy.back }).boundingBox())!, (await note.boundingBox())!];
    expect(caption.y).toBeGreaterThanOrEqual(back.y + back.height);
    await page.getByRole("link", { name: quickCopy.back }).dispatchEvent("pointerenter", { pointerType: "touch" });
    await expect(tipOf(page)).toHaveAttribute("data-shown", "false");
    await expect(page.locator("[data-quick-looking]")).toBeVisible();
  });

  test("the toast carries the same kind of line for a tapper", async ({ page }) => {
    await page.goto("/");
    await homeReady(page);
    await expect(page.locator('[data-express-invite="toast"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("[data-express-invite-note]")).toHaveText(quickCopy.tips.toast);
  });
});

test("tip: with a mouse the captions stay hidden", async ({ page }) => {
  await page.goto("/quick");
  await expect(page.locator("[data-quick-back-note]")).toBeHidden();
});
