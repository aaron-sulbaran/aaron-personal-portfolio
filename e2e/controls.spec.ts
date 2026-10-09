import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { settled } from "./support/fallback";
import { CAPSULE, GREETED_KEY, PILL, SOUNDTRACK_KEY } from "./support/dock";
import { openHome } from "./support/coil";
import { FILL_PICK, type ControlKey } from "@/lib/fx/fill";

// The house fill and the bolt note (lab log, "Controls lab", Aaron's pick).
const M = siteContent.menu;

// ?e2eStored=on restores a paused opt-in, =off an opt-out; the greeting is
// marked seen so the pill lands as its quiet capsule.
async function storeFromQuery(page: Page) {
  await page.addInitScript(({ key, greeted }) => {
    const stored = new URLSearchParams(location.search).get("e2eStored");
    if (stored) localStorage.setItem(key, stored);
    sessionStorage.setItem(greeted, "1");
  }, { key: SOUNDTRACK_KEY, greeted: GREETED_KEY });
}
async function openWith(page: Page, stored: "on" | "off") {
  await page.goto(`/?e2eStored=${stored}#about`);
  await settled(page);
}
const listen = (page: Page) =>
  page.locator("button[aria-pressed]").and(page.getByRole("button", { name: M.listenAriaLabel, exact: true }));
const noteIn = (control: Locator) => control.locator("svg[data-note]").first();
const slashIn = (control: Locator) => control.locator("[data-note-slash]").first();

test("controls: the note's slash is painted only while paused or off", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit cannot be launched muted");
  await storeFromQuery(page);
  await openWith(page, "off");
  await expect(noteIn(listen(page))).toHaveAttribute("data-note", "off");
  await expect(slashIn(listen(page))).toBeVisible();

  await openWith(page, "on");
  await expect(noteIn(listen(page))).toHaveAttribute("data-note", "paused");
  await expect(slashIn(listen(page))).toBeVisible();

  await listen(page).click();
  await expect(noteIn(listen(page))).toHaveAttribute("data-note", "playing");
  await expect(slashIn(listen(page))).toBeHidden();
});

type FillRun = { ms: number; between: number };
type FillWindow = Window & { __fill: Promise<FillRun> };
const fxP = (el: Locator) => el.evaluate((node) => Number(getComputedStyle(node).getPropertyValue("--fx-p")));
const menuButton = (page: Page) => page.getByRole("button", { name: M.ariaLabelOpen, exact: true });

async function expectFill(controls: Locator, key: ControlKey) {
  const count = await controls.count();
  expect(count, `controls for ${key}`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(controls.nth(i)).toHaveAttribute("data-fill", FILL_PICK[key].variant);
    await expect(controls.nth(i)).toHaveAttribute("data-colorway", FILL_PICK[key].colorway);
  }
}

test("controls: hovering the Menu pill runs the fill 0 to 1 within 500ms and moves nothing", async ({ page }) => {
  await openHome(page);
  const pill = page.locator("[data-menu-pill]");
  const menu = menuButton(page);
  await expectFill(pill.locator("button"), "menu");
  expect(await fxP(menu)).toBe(0);
  const before = await pill.boundingBox();
  await menu.evaluate((el) => {
    (window as unknown as FillWindow).__fill = new Promise((resolve) => {
      el.addEventListener("pointerenter", () => {
        const start = performance.now();
        let between = 0;
        const tick = () => {
          const p = Number(getComputedStyle(el).getPropertyValue("--fx-p"));
          if (p > 0 && p < 1) between += 1;
          if (p >= 1) resolve({ ms: performance.now() - start, between });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { once: true });
    });
  });
  await menu.hover();
  const run = await page.evaluate(() => (window as unknown as FillWindow).__fill);
  expect(run.ms, "0 to 1").toBeLessThanOrEqual(500);
  expect(run.between, "frames part way (a transition, not a jump)").toBeGreaterThan(3);
  expect(await pill.boundingBox()).toEqual(before);
});

test("controls: under reduced motion the fill has no transition and lands at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const menu = menuButton(page);
  expect(await menu.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  expect(await slashIn(listen(page)).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await menu.hover();
  expect(await fxP(menu)).toBe(1);
});

type Widths = { menuPill: number; note: number; capsuleLessWords: number };
const widths = (page: Page): Promise<Widths> =>
  page.evaluate(() => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const capsule = document.querySelector<HTMLElement>("[data-pill] .pill-hit")!;
    const words = [...capsule.children]
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.style.maxWidth !== "")
      .reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
    return {
      menuPill: round(document.querySelector("[data-menu-pill]")!.getBoundingClientRect().width),
      note: round(capsule.querySelector("[data-fill-icon]")!.getBoundingClientRect().width),
      capsuleLessWords: round(capsule.getBoundingClientRect().width - words),
    };
  });
async function settledWidths(page: Page): Promise<Widths> {
  await expect(page.locator(PILL)).not.toHaveAttribute("inert", "");
  let last = await widths(page);
  await expect.poll(async () => {
    const next = await widths(page);
    const same = JSON.stringify(next) === JSON.stringify(last);
    last = next;
    return same;
  }, { intervals: [150], timeout: 5000 }).toBe(true);
  return last;
}

// The capsule's words are state copy (siteContent.soundtrack); every other
// width, and the whole Menu pill, holds through the three note states.
test("controls: the playback pill and the Menu pill keep their width in all three note states", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit cannot be launched muted");
  await storeFromQuery(page);
  const capsule = page.locator(CAPSULE);
  await openWith(page, "off");
  await expectFill(capsule, "capsule");
  const off = await settledWidths(page);
  await expect(slashIn(capsule)).toBeVisible();
  await openWith(page, "on");
  const paused = await settledWidths(page);
  await expect(slashIn(capsule)).toBeVisible();
  await listen(page).click();
  await expect(noteIn(capsule)).toHaveAttribute("data-note", "playing");
  const playing = await settledWidths(page);
  await expect(slashIn(capsule)).toBeHidden();
  expect(paused).toEqual(off);
  expect(playing).toEqual(off);
});

test("controls: the nav bar and the Connect links rise with the quiet tint", async ({ page }) => {
  await openHome(page);
  await expectFill(page.locator("header nav a"), "nav");
  await expectFill(page.locator("#connect li > a"), "connect");
});

test("controls: the band's controls rise with glass to accent", async ({ page }) => {
  await openHome(page);
  // The note's own tips (the music and the evolving isle) are inline links, not controls.
  await expectFill(page.locator("#listen [data-band-controls] button, #listen [data-band-note] button:not([data-inline])"), "band");
});

test("controls: the hero control is a circle on the Menu pill's glass", async ({ page }) => {
  await openHome(page);
  const coil = page.locator("section[data-scene] button.fx");
  await expectFill(coil, "hero");
  await expect(coil).toContainText(siteContent.hero.coilControl);
  expect(await coil.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("blur(8px)");
});

test("controls: the case page's calls to action are circles with glass to accent", async ({ page }) => {
  await page.goto(`/work/${siteContent.workItems[0].slug}`);
  await expectFill(page.locator("main article a.fx"), "cta");
});
