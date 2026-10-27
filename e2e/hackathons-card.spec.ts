import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openCardFromBook } from "./support/cards";

// The Hackathons card (2026-10-27): the AWS photo beside its paragraph, with its caption.

const { modal } = siteContent.cards.hackathons;
const aws = modal.photos.find((photo) => photo.src.endsWith("/hackathons-3-aws.jpg"))!;

test("hackathons card: the AWS photo renders beside its paragraph, decoded, with its first-person alt and its caption", async ({ page }) => {
  expect(aws, "the AWS photo is in the card's content").toBeDefined();
  expect(aws.block, "beside the AWS paragraph").toBe(modal.blocks.findIndex((block) => block.startsWith("**AWS Agentic AI Hackathon")));
  const { dialog } = await openCardFromBook(page, "hackathons", { settled: true });
  const image = dialog.getByRole("img", { name: aws.alt, exact: true });
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el) => ((el as HTMLImageElement).complete ? (el as HTMLImageElement).naturalWidth : 0))).toBeGreaterThan(0);
  expect(await image.evaluate((el) => (el as HTMLImageElement).currentSrc)).toContain("hackathons-3-aws.jpg");
  await expect(image.locator("xpath=ancestor::figure[1]").locator("figcaption")).toHaveText(aws.caption);
  // Its row's words are the AWS paragraph (and the HackTX one after it).
  const row = image.locator('xpath=ancestor::*[@data-row="photo"][1]');
  await expect(row.locator("[data-text-column]")).toContainText("Placed second with a hedge fund management workspace");
});

// The Muse Friends demo after the HackTX paragraph: native controls, muted, its poster until played, never autoplaying,
// rounded with the card shadow token; and the card's two links, external.
test("hackathons card: both links lead out, and the Muse Friends demo shows its poster and controls and plays, muted", async ({ page }) => {
  const video = modal.video!;
  const { dialog } = await openCardFromBook(page, "hackathons", { settled: true });
  for (const link of modal.links) {
    const anchor = dialog.getByRole("link", { name: new RegExp(`^${link.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
    await expect(anchor).toHaveAttribute("href", link.href);
    await expect(anchor).toHaveAttribute("target", "_blank");
    await expect(anchor).toHaveAttribute("rel", /noopener/);
  }
  const player = dialog.locator("[data-card-video] video");
  await expect(player).toHaveCount(1);
  await player.scrollIntoViewIfNeeded();
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute("aria-label", video.label);
  await expect(player).toHaveAttribute("poster", video.poster);
  await expect(player).toHaveAttribute("controls", "");
  await expect(player).toHaveAttribute("preload", "metadata");
  // It sits right after the HackTX paragraph, in the same column.
  const follows = await player.evaluate((el) => {
    const figure = el.closest("[data-card-video]")!;
    return figure.previousElementSibling?.textContent ?? "";
  });
  expect(follows.startsWith("HackTX, fall 2026.")).toBe(true);
  const state = await player.evaluate((el) => {
    const v = el as HTMLVideoElement;
    const figure = v.closest("[data-card-video]")!;
    return { muted: v.muted, paused: v.paused, autoplay: v.autoplay, inline: v.playsInline, ratio: v.getBoundingClientRect().width / v.getBoundingClientRect().height, radius: getComputedStyle(figure).borderTopLeftRadius, shadow: getComputedStyle(figure).boxShadow, token: getComputedStyle(document.documentElement).getPropertyValue("--shadow-card").trim() };
  });
  expect(state).toMatchObject({ muted: true, paused: true, autoplay: false, inline: true });
  expect(state.ratio).toBeCloseTo(video.width / video.height, 1);
  expect(parseFloat(state.radius)).toBeGreaterThan(8);
  expect(state.token).not.toBe("");
  expect(state.shadow, "the card shadow token").not.toBe("none");
  // Played for a second, muted.
  await player.evaluate((el) => (el as HTMLVideoElement).play());
  await expect.poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime), { timeout: 8000 }).toBeGreaterThan(1);
  expect(await player.evaluate((el) => (el as HTMLVideoElement).muted)).toBe(true);
  await player.evaluate((el) => (el as HTMLVideoElement).pause());
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("hackathons card: the demo fits the page's words column at 390, after the HackTX paragraph", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "hackathons", { settled: true });
    const player = dialog.locator("[data-card-video] video");
    await expect(player).toHaveCount(1);
    // Turn to the page that holds it.
    const next = dialog.getByRole("button", { name: siteContent.modals.gallery.nextPage, exact: true });
    for (let i = 0; i < 4 && (await player.evaluate((el) => !!el.closest("[inert]"))); i++) {
      await next.click();
      await page.waitForTimeout(700);
    }
    expect(await player.evaluate((el) => !!el.closest("[inert]")), "on the current page").toBe(false);
    await player.scrollIntoViewIfNeeded();
    const box = (await player.boundingBox())!;
    const column = (await dialog.locator('[data-pager-page]:not([inert]) [data-pager-text]').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(column.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width + 1);
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
    expect(box.width).toBeGreaterThan(300);
  });
});
