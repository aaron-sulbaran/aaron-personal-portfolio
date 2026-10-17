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
      edge: box.dataset.marqueeEdge,
      mask: getComputedStyle(box).maskImage !== "none" ? getComputedStyle(box).maskImage : getComputedStyle(box).webkitMaskImage,
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

// Parks the animation at a point in its cycle so the mask is read deterministically.
const seek = (page: Page, where: "start" | "mid" | "end") =>
  page.evaluate(
    ({ selector, where }) => {
      const box = document.querySelector<HTMLElement>(selector)!;
      const animation = box.querySelector<HTMLElement>("[data-marquee-track]")!.getAnimations()[0];
      const duration = Number(animation.effect!.getTiming().duration);
      const offsets = (animation.effect as KeyframeEffect).getKeyframes().map((frame) => Number(frame.offset));
      const at = { start: 0, mid: (offsets[1] + offsets[2]) / 2, end: (offsets[2] + offsets[3]) / 2 }[where];
      animation.pause();
      animation.currentTime = at * duration;
    },
    { selector: TITLE, where },
  );

// The mask is a gradient whose first colour stop is transparent only when the left edge fades.
const fades = (mask: string) => ({ left: mask.startsWith("linear-gradient(to right, rgba(0, 0, 0, 0)") || mask.startsWith("linear-gradient(to right, transparent"), right: /(rgba\(0, 0, 0, 0\)|transparent)\)$/.test(mask) });

test("marquee: only the right edge fades at rest, both while scrolled away, only the left at the end", async ({ page }) => {
  await openCard(page);
  await seek(page, "start");
  await expect.poll(async () => (await state(page)).edge).toBe("start");
  const rest = await state(page);
  expect(fades(rest.mask)).toEqual({ left: false, right: true });

  await seek(page, "mid");
  await expect.poll(async () => (await state(page)).edge).toBe("scrolling");
  expect(fades((await state(page)).mask)).toEqual({ left: true, right: true });

  await seek(page, "end");
  await expect.poll(async () => (await state(page)).edge).toBe("end");
  expect(fades((await state(page)).mask)).toEqual({ left: true, right: false });

  await seek(page, "start");
  await expect.poll(async () => (await state(page)).edge).toBe("start");
  expect(fades((await state(page)).mask)).toEqual({ left: false, right: true });
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
  expect(still.edge).toBe("start");
  expect(fades(still.mask), "at rest only the right edge fades").toEqual({ left: false, right: true });
  await page.waitForTimeout(2600);
  expect((await state(page)).transform).toBe(still.transform);
  await expect(page.getByRole("group", { name: S.ariaOpen })).toContainText(S.tracks[0].title);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(async () => (await state(page)).marquee).toBe("running");
});
