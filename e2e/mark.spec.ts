import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { HOLD } from "@/lib/mark/constants";
import { FILL_BOTTOM, FILL_TOP } from "@/lib/mark/geometry";
import { test, expect } from "./support/fixtures";
import { openHome, scrollToY } from "./support/coil";
import { settled } from "./support/fallback";
import { noWebglContext } from "./support/webgl";

// The top-left mark (components/mark): a click still scrolls to the top; a
// 650ms hold strikes and opens the card and swallows the click it ends with;
// an early release tastes the fill and drains; Enter or Space held does the
// same from the keyboard; reduced motion opens the card on the static mark.
// The cursor's ring paints the same fill as the mark.
//
// The mark is DOM and GSAP only, so every test runs twice: with the scene, and
// with WebGL taken away in the page (the hero still, as Aaron's own browser
// shows it).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const Y = 600;
const CLOSE = siteContent.modals.closeAriaLabel;
const mark = (page: Page) => page.locator("[data-mark-trigger]");
const card = (page: Page) => page.getByRole("dialog", { name: siteContent.mark.dialogLabel });
const progress = async (page: Page) => Number(await mark(page).getAttribute("data-hold-progress"));
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const menuPill = (page: Page) => page.getByRole("button", { name: siteContent.menu.ariaLabelOpen });
const menuPanel = (page: Page) => page.getByRole("dialog", { name: siteContent.menu.dialogLabel });
const surfaceOpacity = (page: Page) => card(page).locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity);

async function markBox(page: Page) {
  const box = await mark(page).boundingBox();
  if (!box) throw new Error("the mark is not on screen");
  return box;
}

async function pointAtMark(page: Page) {
  const box = await markBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

async function holdMark(page: Page, ms: number) {
  await pointAtMark(page);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

for (const mode of ["scene", "no-webgl"] as const) {
  test.describe(mode, () => {
    if (mode === "no-webgl") test.beforeEach(({ page }) => page.addInitScript(noWebglContext));

    async function open(page: Page) {
      if (mode === "scene") return openHome(page);
      await page.goto("/");
      await settled(page);
      await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
    }

    test(`mark: hover grows it 10px from its corner, and a click still scrolls to the top with no card (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      const side = Math.round((await markBox(page)).width);
      const grown = String((side + 10) / side).replace(".", "\\.");
      await pointAtMark(page);
      await expect(mark(page).locator("span").first()).toHaveAttribute("style", new RegExp(`scale\\(${grown}\\)`));
      await mark(page).click();
      await expect.poll(() => scrollY(page)).toBeLessThan(2);
      await sleep(1000);
      await expect(card(page)).toHaveCount(0);
    });

    test(`mark: a 700ms hold strikes and opens the card, and swallows the click it ends with (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await holdMark(page, 700);
      const dialog = card(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "cel");
      await expect.poll(() => dialog.locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
      await expect(dialog.getByRole("button", { name: siteContent.mark.button })).toBeVisible();
      await expect(dialog.getByRole("button", { name: siteContent.mark.button }).locator("svg")).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await expect.poll(() => page.evaluate(() => document.querySelector<SVGElement>("[data-mark-ring]")?.style.opacity ?? "0")).toBe("0");
      await dialog.getByRole("button", { name: CLOSE }).click();
      await expect(dialog).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await mark(page).click();
      await expect.poll(() => scrollY(page)).toBeLessThan(2);
    });

    test(`mark: letting go at 300ms opens nothing and the fill drains @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await page.mouse.down();
      await sleep(300);
      const mid = await page.evaluate(() => ({
        fill: Number(document.querySelector<HTMLElement>("[data-mark-trigger]")!.dataset.holdProgress),
        arc: Number(document.querySelector<SVGElement>("[data-mark-ring]")!.dataset.ringArc),
      }));
      await page.mouse.up();
      expect(mid.fill).toBeGreaterThan(0.3);
      expect(mid.fill).toBeLessThan(0.75);
      expect(Math.abs(mid.arc / 360 - mid.fill)).toBeLessThan(0.002);
      await expect.poll(() => progress(page)).toBe(0);
      await sleep(600);
      await expect(card(page)).toHaveCount(0);
    });

    // Each frame reads the mark's rise clip, the ring's arc and the ring's wash
    // back from the DOM; all three are one progress, close on one frame at
    // HOLD.holdMs, and the card opens only after that, past the discharge.
    test(`mark: the ring's arc and wash fill with the mark and close on the same frame @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await expect(page.locator("[data-mark-ring]")).toHaveCount(1);
      await page.evaluate(
        ([top, bottom]) => {
          const rise = document.querySelector<SVGRectElement>("[data-mark-trigger] clipPath rect")!;
          const ring = document.querySelector<SVGSVGElement>("[data-mark-ring]")!;
          const wash = ring.querySelector<SVGRectElement>("clipPath rect")!;
          const rec = { samples: [] as { t: number; mark: number; arc: number; wash: number }[], pressedAt: 0, openedAt: 0 };
          Object.assign(window, { __sync: rec });
          window.addEventListener("pointerdown", () => (rec.pressedAt = performance.now()), { once: true, capture: true });
          const start = performance.now();
          const tick = () => {
            const t = performance.now();
            if (!rec.openedAt && document.querySelector("[data-mark-strike]")) rec.openedAt = t;
            if (!rec.openedAt) rec.samples.push({ t, mark: (bottom - Number(rise.getAttribute("y"))) / (bottom - top), arc: Number(ring.dataset.ringArc) / 360, wash: 1 - Number(wash.getAttribute("y")) / 100 });
            if (t - start < 2500) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
        [FILL_TOP, FILL_BOTTOM],
      );
      await holdMark(page, HOLD.holdMs + HOLD.dischargeMs + 200);
      await expect(card(page)).toBeVisible();
      type Sample = { t: number; mark: number; arc: number; wash: number };
      const { samples, pressedAt, openedAt } = await page.evaluate(() => (window as unknown as { __sync: { samples: Sample[]; pressedAt: number; openedAt: number } }).__sync);
      const during = samples.filter((s) => s.t >= pressedAt);
      expect(during.length).toBeGreaterThan(20);
      for (const s of during) {
        expect(Math.abs(s.arc - s.mark)).toBeLessThan(0.001);
        expect(Math.abs(s.wash - s.mark)).toBeLessThan(1e-6);
      }
      const markFull = during.findIndex((s) => s.mark > 1 - 1e-6);
      const washFull = during.findIndex((s) => s.wash > 1 - 1e-6);
      expect(markFull).toBeGreaterThan(0);
      expect(washFull).toBe(markFull);
      expect(during[markFull].arc).toBe(1);
      expect(during[markFull - 1].mark).toBeLessThan(1);
      const fullAt = during[markFull].t - pressedAt;
      expect(fullAt).toBeGreaterThanOrEqual(HOLD.holdMs - 5);
      expect(fullAt).toBeLessThan(HOLD.holdMs + 60);
      expect(openedAt - during[markFull].t).toBeGreaterThanOrEqual(HOLD.dischargeMs - 20);
    });

    test(`mark: a scroll under a parked pointer tucks the mark and the ring goes with it @ring (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await pointAtMark(page);
      await expect(page.locator("[data-mark-ring]")).toHaveCount(1);
      await page.evaluate(() => {
        const rec = { moves: 0 };
        Object.assign(window, { __moves: rec });
        window.addEventListener("mousemove", () => rec.moves++);
      });
      // Headroom tucks after a long enough scroll down; wheel until it starts.
      for (let i = 0; i < 4 && (await markBox(page)).y > 0; i++) {
        await page.mouse.wheel(0, 400);
        await sleep(250);
      }
      await expect.poll(async () => (await mark(page).boundingBox())?.y ?? 0).toBeLessThan(-40);
      await expect(page.locator("[data-mark-ring]")).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { __moves: { moves: number } }).__moves.moves)).toBe(0);
    });

    test(`mark: a quick tap shows at least 0.3 of the fill for 200ms, then drains (${mode})`, async ({ page }) => {
      await open(page);
      await pointAtMark(page);
      await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>("[data-mark-trigger]")!;
        const rec = { samples: [] as [number, number][], releasedAt: 0 };
        Object.assign(window, { __tap: rec });
        window.addEventListener("pointerup", () => (rec.releasedAt = performance.now()), { once: true });
        const start = performance.now();
        const tick = () => {
          rec.samples.push([performance.now(), Number(el.dataset.holdProgress)]);
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.down();
      await page.mouse.up();
      await sleep(1600);
      const { samples, releasedAt } = await page.evaluate(() => (window as unknown as { __tap: { samples: [number, number][]; releasedAt: number } }).__tap);
      const tasted = samples.filter(([t]) => t - releasedAt >= 110 && t - releasedAt <= 270).map(([, fill]) => fill);
      expect(tasted.length).toBeGreaterThan(5);
      expect(Math.min(...tasted)).toBeGreaterThanOrEqual(0.299);
      expect(samples.at(-1)?.[1]).toBe(0);
    });

    test(`mark: Enter held opens the card, its repeat cannot close it, Escape does and focus returns to the mark (${mode})`, async ({ page }) => {
      await open(page);
      await mark(page).focus();
      await page.keyboard.down("Enter");
      await expect(card(page)).toBeVisible();
      await expect(page.locator("[data-mark-ring]")).toHaveCount(0);
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.down("Enter");
      await page.keyboard.up("Enter");
      await sleep(300);
      await expect(card(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(card(page)).toHaveCount(0);
      await expect(mark(page)).toBeFocused();
    });

    test(`mark: Escape cancels a keyboard hold, and Space held opens the card without its release pressing Close (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await mark(page).focus();
      await page.keyboard.down("Enter");
      await sleep(300);
      await page.keyboard.press("Escape");
      await sleep(500);
      await page.keyboard.up("Enter");
      await sleep(400);
      await expect(card(page)).toHaveCount(0);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      await page.keyboard.down("Space");
      await expect(card(page)).toBeVisible();
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.up("Space");
      await sleep(300);
      await expect(card(page)).toBeVisible();
    });

    test(`mark: a hold with the Menu open closes the Menu, opens the card on Close, and Escape returns to the mark (${mode})`, async ({ page }) => {
      await open(page);
      await menuPill(page).click();
      await expect(menuPanel(page)).toBeVisible();
      await holdMark(page, 700);
      await expect(card(page)).toBeVisible();
      await expect(menuPanel(page)).toHaveCount(0);
      await expect(menuPill(page)).toHaveAttribute("aria-expanded", "false");
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await sleep(600);
      await expect(card(page).getByRole("button", { name: CLOSE })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(card(page)).toHaveCount(0);
      await expect(mark(page)).toBeFocused();
    });

    test(`mark: Keep exploring! closes the card and leaves the page where it was (${mode})`, async ({ page }) => {
      await open(page);
      await scrollToY(page, Y);
      await holdMark(page, 700);
      await expect.poll(() => surfaceOpacity(page), { timeout: 4000 }).toBe("1");
      await card(page).getByRole("button", { name: siteContent.mark.button }).click();
      await expect(card(page)).toHaveCount(0);
      await sleep(500);
      expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
      expect(new URL(page.url()).hash).toBe("");
      await expect(mark(page)).toBeFocused();
    });

    test.describe("reduced motion", () => {
      test.use({ contextOptions: { reducedMotion: "reduce" } });

      test(`mark: the hold opens the card on the static mark, with no strike (${mode})`, async ({ page }) => {
        await page.goto("/");
        await settled(page);
        await holdMark(page, 700);
        const dialog = card(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "static");
        await expect(dialog.locator('[data-part="cel"], [data-cel-night], [data-cel-flash]')).toHaveCount(0);
        await expect(dialog.locator('[data-card="surface"]')).toHaveCSS("opacity", "1");
      });
    });
  });
}

// The card's words and the links inside it. Tips, definitions and pops open
// from inside the dialog and float above it.
const PLAYSTATION = "https://profile.playstation.com/VoltaageArc";
const tipBubble = (page: Page) => page.locator("[data-inline-tip]");
const word = (card: Locator, name: string) => card.getByRole("button", { name, exact: true });
const bodyLocked = (page: Page) => page.evaluate(() => document.body.style.overflow);
// Whether the point at the middle of the element lands on it, not on what is stacked above it. A label that
// takes no pointer is hit-tested with the pointer switched on for the moment of the read.
const topmostIn = (locator: Locator, root: string) =>
  locator.evaluate((el, selector) => {
    const scope = el.closest<HTMLElement>(selector);
    const before = scope?.style.pointerEvents ?? "";
    if (scope) scope.style.pointerEvents = "auto";
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    if (scope) scope.style.pointerEvents = before;
    return !!hit && !!hit.closest(selector);
  }, root);

async function openCard(page: Page) {
  await openHome(page);
  await scrollToY(page, Y);
  await holdMark(page, 700);
  await expect(card(page)).toBeVisible();
  await expect.poll(() => surfaceOpacity(page), { timeout: 4000 }).toBe("1");
  await page.mouse.move(2, 2);
  return card(page);
}

test.describe("the mark card's words and links", () => {
  test("mark: the title, the subtitle in the card modals' meta face, and four paragraphs, each one animated in", async ({ page }) => {
    const dialog = await openCard(page);
    await expect(dialog.getByRole("heading", { name: siteContent.mark.title })).toBeVisible();
    await expect(dialog.getByText(siteContent.mark.subtitle)).toHaveClass(/font-label text-label text-accent/);
    const paragraphs = dialog.locator('p[data-card="text"]');
    await expect(paragraphs).toHaveCount(5);
    await expect(paragraphs.nth(2)).toContainText("My gamer tag growing up: VoltaageArc (Voltage + two A's + Arc)");
    await expect(paragraphs.nth(4)).toContainText("My major: Electrical and Computer Engineering... this one is pretty self explanatory.");
    await expect(dialog.getByText(siteContent.modals.closeHintKeyboard)).toBeVisible();
    for (let i = 0; i < 5; i++) await expect(paragraphs.nth(i)).toHaveCSS("opacity", "1");
  });

  test("mark: hovering the gamer tag opens a tip with a link; the pointer can reach it, it opens a new tab, and it lets go after leaving", async ({ page, offsite }) => {
    const dialog = await openCard(page);
    const target = word(dialog, "VoltaageArc");
    await target.hover();
    await expect(tipBubble(page)).toHaveAttribute("data-shown", "true");
    await expect(tipBubble(page)).toContainText("I always thought Voltaage would be an awesome streamer name. I guess I took a different career path.");
    const link = tipBubble(page).getByRole("link", { name: /VoltaageArc on most platforms/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", PLAYSTATION);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const wordBox = (await target.boundingBox())!;
    const box = (await link.boundingBox())!;
    await page.mouse.move(wordBox.x + wordBox.width / 2, wordBox.y + wordBox.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await page.waitForTimeout(500);
    await expect(tipBubble(page)).toHaveAttribute("data-shown", "true");
    expect(await topmostIn(link, "[data-inline-tip]")).toBe(true);
    const popup = page.waitForEvent("popup");
    await link.click();
    await (await popup).close();
    await expect.poll(() => offsite).toContain(PLAYSTATION);
    await expect(card(page)).toBeVisible();
    await page.mouse.move(2, 2);
    await expect(tipBubble(page)).toHaveAttribute("data-shown", "false");
  });

  test("mark: a keyboard reaches the tip's link with Tab, Escape closes only the tip and gives focus back to its word", async ({ page }) => {
    const dialog = await openCard(page);
    await dialog.getByRole("button", { name: CLOSE }).focus();
    await page.keyboard.press("Tab");
    const target = word(dialog, "VoltaageArc");
    await expect(target).toBeFocused();
    await expect(tipBubble(page)).toHaveAttribute("data-shown", "true");
    const link = tipBubble(page).getByRole("link", { name: /VoltaageArc on most platforms/ });
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await expect(tipBubble(page)).toHaveAttribute("data-shown", "true");
    await page.keyboard.press("Shift+Tab");
    await expect(target).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(tipBubble(page)).toHaveAttribute("data-shown", "false");
    await expect(card(page)).toBeVisible();
    await expect(target).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(mark(page)).toBeFocused();
  });

  test("mark: Tab from the tip's link carries on past its word", async ({ page }) => {
    const dialog = await openCard(page);
    await word(dialog, "VoltaageArc").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(word(dialog, "VoltaageArc")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tipBubble(page).getByRole("link")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(word(dialog, "Voltage")).toBeFocused();
  });

  test("mark: a definition opens above the card, Escape closes only it, the scroll lock holds, and focus returns to its word", async ({ page }) => {
    const dialog = await openCard(page);
    const voltage = word(dialog, "Voltage");
    await voltage.click();
    const definition = page.getByRole("dialog", { name: "Voltage" });
    await expect(definition).toBeVisible();
    await expect(definition).toContainText("the difference in electric potential between two points");
    await expect(dialog).toBeVisible();
    await expect.poll(() => topmostIn(definition.locator("[data-definition-panel]"), "[data-definition-panel]")).toBe(true);
    expect(await bodyLocked(page)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(definition).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(await bodyLocked(page)).toBe("hidden");
    await expect(voltage).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await bodyLocked(page)).toBe("");
  });

  test("mark: the Arc definition and the A's tip open from the card too", async ({ page }) => {
    const dialog = await openCard(page);
    await word(dialog, "Arc").click();
    await expect(page.getByRole("dialog", { name: "Arc" })).toContainText("continuous electrical discharge");
    await page.keyboard.press("Escape");
    await word(dialog, "two A's").hover();
    await expect(tipBubble(page)).toContainText("as in A-Aron");
    await expect(tipBubble(page).getByRole("link")).toHaveCount(0);
  });

  for (const [name, caption, file] of [
    ["Catatumbo Lightning", "The lightning in question", "catatumbo-lightning"],
    ["Lake Maracaibo", "The famous Puente General Rafael Urdaneta over Lake Maracaibo.", "lake-maracaibo"],
    ["Electrical and Computer Engineering", "UT Austin Electrical and Computer Engineering", "ut-ece-logo"],
  ] as const) {
    test(`mark: the ${name} pop opens its photo and caption above the card, uncovered`, async ({ page }) => {
      const dialog = await openCard(page);
      await word(dialog, name).hover();
      await expect(tipBubble(page)).toHaveAttribute("data-shown", "true");
      const photo = tipBubble(page).locator("img");
      await expect(photo).toBeVisible();
      await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(decodeURIComponent((await photo.getAttribute("src")) ?? "")).toContain(file);
      await expect(tipBubble(page).getByText(caption)).toBeVisible();
      expect(await topmostIn(photo, "[data-inline-tip]")).toBe(true);
      expect(await topmostIn(tipBubble(page).getByText(caption), "[data-inline-tip]")).toBe(true);
    });
  }

  for (const [label, size] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
    test(`mark: all four paragraphs and the button sit inside the dialog's scroll on a ${label}`, async ({ page }) => {
      await page.setViewportSize(size);
      const dialog = await openCard(page);
      const button = dialog.getByRole("button", { name: siteContent.mark.button });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeVisible();
      expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      for (const text of ["Here's my thought process", "My gamer tag growing up", "Catatumbo Lightning", "My major"]) await expect(dialog.getByText(text, { exact: false }).first()).toBeAttached();
      await expect(dialog.getByRole("button", { name: CLOSE })).toBeVisible();
    });
  }
});
