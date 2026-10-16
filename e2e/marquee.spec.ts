import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { openHome } from "./support/coil";
import { CAPSULE, armDock, bandControl, dockLanded, toAbout } from "./support/dock";
import { parkBand } from "./support/wave";

// The player card's title scrolls like Spotify's when it overflows its box:
// still under reduced motion (live, both ways), the box never changes size.

const S = siteContent.soundtrack;
const TITLE = `[role="group"][aria-label="${S.ariaOpen}"] [data-marquee]`;

async function openCard(page: Page) {
  await armDock(page);
  await openHome(page, { path: "/?wavedebug" });
  await parkBand(page);
  await bandControl(page, "before").click();
  await toAbout(page);
  await dockLanded(page);
  const card = page.getByRole("group", { name: S.ariaOpen });
  if ((await card.getAttribute("inert")) !== null) await page.locator(CAPSULE).click();
  await expect(card).not.toHaveAttribute("inert", "");
}

const state = (page: Page) =>
  page.evaluate((selector) => {
    const box = document.querySelector<HTMLElement>(selector)!;
    const track = box.querySelector<HTMLElement>("[data-marquee-track]")!;
    return {
      marquee: box.dataset.marquee,
      animations: track.getAnimations().length,
      transform: getComputedStyle(track).transform,
      masked: getComputedStyle(box).maskImage !== "none" || getComputedStyle(box).webkitMaskImage !== "none",
      width: box.offsetWidth,
      height: box.offsetHeight,
      overflowing: track.offsetWidth > box.clientWidth,
    };
  }, TITLE);

test("marquee: a long title scrolls, clipped with a fade, without changing the box", async ({ page }) => {
  await openCard(page);
  const rest = await state(page);
  expect(rest.overflowing, "the first title overflows the card").toBe(true);
  expect(rest.masked, "soft fade, not an ellipsis").toBe(true);
  expect(rest.marquee).toBe("running");
  expect(rest.animations).toBe(1);
  await expect.poll(async () => (await state(page)).transform, { timeout: 8000, message: "the title scrolls after its rest" }).not.toBe(rest.transform);
  const moving = await state(page);
  expect(moving.width).toBe(rest.width);
  expect(moving.height).toBe(rest.height);
});

test("marquee: a hovered title holds still", async ({ page }) => {
  await openCard(page);
  await page.waitForTimeout(500); // the card finishes scaling in, so the pointer is not left behind by it
  await page.locator(TITLE).hover();
  await expect.poll(async () => (await state(page)).marquee).toBe("paused");
  const held = (await state(page)).transform;
  await page.waitForTimeout(1500);
  expect((await state(page)).transform).toBe(held);
  await page.mouse.move(2, 2);
  await expect.poll(async () => (await state(page)).marquee).toBe("running");
});

test("marquee: reduced motion keeps the title still, clipped with the fade, live in both directions", async ({ page }) => {
  await openCard(page);
  expect((await state(page)).marquee).toBe("running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await state(page)).marquee).toBe("off");
  const still = await state(page);
  expect(still.animations).toBe(0);
  expect(still.masked, "still clipped with the fade").toBe(true);
  await page.waitForTimeout(2600);
  expect((await state(page)).transform).toBe(still.transform);
  await expect(page.getByRole("group", { name: S.ariaOpen })).toContainText(S.tracks[0].title);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await state(page)).marquee).toBe("running");
});
