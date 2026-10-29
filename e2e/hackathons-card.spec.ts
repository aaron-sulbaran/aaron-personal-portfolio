import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openCardFromBook } from "./support/cards";
import { shoot } from "./support/pixels";

// The Hackathons card (2026-10-27): the AWS photo beside its paragraph, with its caption; (2026-10-29) the modal's media
// alternating sides, the Muse Friends demo among them in the photos' 4:3 frame.

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
  // Its row's words are the AWS paragraph alone: the HackTX paragraph has its own row, with the video.
  const row = image.locator('xpath=ancestor::*[@data-row="photo"][1]');
  await expect(row.locator("[data-text-column]")).toContainText("Placed second with a hedge fund management workspace");
  await expect(row.locator("[data-text-column]")).not.toContainText("HackTX, fall 2026.");
});

// The media alternate sides down the card: the UFCU picture, the AWS photo, the HackTX video, the Hook 'Em photo and the Vercel
// photo, each in its own row beside its own paragraph. No two consecutive media share a side, and none sits under another.
for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`hackathons card: the media alternate sides at ${viewport.width}, each beside its own paragraph, none stacked under another`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { dialog } = await openCardFromBook(page, "hackathons", { settled: true });
    await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
    const rows = dialog.locator('[data-row="photo"]');
    await expect(rows).toHaveCount(5);
    const media = await rows.evaluateAll((els) =>
      els.map((row) => {
        const frame = row.querySelector("[data-photo-frame]")!.getBoundingClientRect();
        const text = row.querySelector("[data-text-column]")!;
        return { side: row.getAttribute("data-side"), video: !!row.querySelector("[data-card-video]"), left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom, text: text.textContent ?? "", textLeft: text.getBoundingClientRect().left, textRight: text.getBoundingClientRect().right };
      }),
    );
    expect(media.map((m) => m.side)).toEqual(["left", "right", "left", "right", "left"]);
    expect(media.map((m) => m.video), "only the third is the video").toEqual([false, false, true, false, false]);
    // Each beside its own paragraph, in order.
    const heads = ["UFCU Develop U", "AWS Agentic AI Hackathon", "HackTX", "Hook 'Em Hacks", "Vercel one-day hackathon"];
    media.forEach((m, i) => {
      expect(m.text.startsWith(heads[i]), `row ${i}: ${m.text.slice(0, 30)}`).toBe(true);
      expect(heads.filter((head) => m.text.includes(head)), `row ${i} holds its paragraph alone`).toEqual([heads[i]]);
      // The words are on the other side of the media.
      if (m.side === "left") expect(m.textLeft, `row ${i} words right of its media`).toBeGreaterThan(m.right);
      else expect(m.textRight, `row ${i} words left of its media`).toBeLessThan(m.left);
    });
    for (let i = 1; i < media.length; i++) {
      const [above, below] = [media[i - 1], media[i]];
      expect(above.side, `rows ${i - 1} and ${i} on different sides`).not.toBe(below.side);
      // Never stacked: consecutive media share no column, so none sits directly under another.
      const overlap = Math.min(above.right, below.right) - Math.max(above.left, below.left);
      expect(overlap, `media ${i - 1} and ${i} share no column`).toBeLessThanOrEqual(0);
      expect(below.top, `media ${i} is below media ${i - 1}`).toBeGreaterThan(above.top);
    }
  });
}

// The Muse Friends demo in the photos' 4:3 frame, radius and shadow: native controls, muted, its poster until played, never
// autoplaying. The 16:9 demo is letterboxed inside the frame (a 4:3 centre crop would cut its mascots and its first headline).
// And the card's two links, external.
test("hackathons card: both links lead out, and the Muse Friends demo sits in the photos' 4:3 frame, shows its poster and controls and plays, muted", async ({ page }) => {
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
  // Its row's words are the HackTX paragraph, and the video is in the media slot, not among the words.
  const row = player.locator('xpath=ancestor::*[@data-row="photo"][1]');
  await expect(row.locator("[data-text-column]")).toContainText("HackTX, fall 2026.");
  await expect(row.locator("[data-text-column] video")).toHaveCount(0);
  // The frame is the photos' own: the same 4:3 box (424 by 318), radius and shadow as the AWS photo's frame, bars a few percent off the page.
  const frameOf = (locator: typeof player) =>
    locator.evaluate((el) => {
      const frame = el.closest("[data-mask]") as HTMLElement;
      const css = getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();
      const bars = getComputedStyle(el.closest("[data-card-video]") ?? frame).backgroundColor;
      return { width: rect.width, height: rect.height, radius: css.borderTopLeftRadius, shadow: css.boxShadow, overflow: css.overflow, bars, page: getComputedStyle(document.documentElement).getPropertyValue("--color-background").trim() };
    });
  const photoFrame = await frameOf(dialog.getByRole("img", { name: aws.alt, exact: true }));
  const videoFrame = await frameOf(player);
  expect(videoFrame.width / videoFrame.height, "a 4:3 frame").toBeCloseTo(4 / 3, 2);
  expect(videoFrame).toMatchObject({ width: photoFrame.width, height: photoFrame.height, radius: photoFrame.radius, shadow: photoFrame.shadow, overflow: "hidden" });
  expect(parseFloat(videoFrame.radius), "rounded").toBeGreaterThan(8);
  expect(videoFrame.bars, "bars are set, not clear").not.toBe("rgba(0, 0, 0, 0)");
  // The 16:9 video is letterboxed whole, centred, at the frame's width.
  const state = await player.evaluate((el) => {
    const v = el as HTMLVideoElement;
    const r = v.getBoundingClientRect();
    const f = v.closest("[data-mask]")!.getBoundingClientRect();
    return { muted: v.muted, paused: v.paused, autoplay: v.autoplay, inline: v.playsInline, ratio: r.width / r.height, widthGap: f.width - r.width, topBar: r.top - f.top, bottomBar: f.bottom - r.bottom };
  });
  expect(state).toMatchObject({ muted: true, paused: true, autoplay: false, inline: true });
  expect(state.ratio).toBeCloseTo(video.width / video.height, 1);
  expect(Math.abs(state.widthGap), "the frame's width").toBeLessThan(1);
  expect(state.topBar, "a bar above").toBeGreaterThan(20);
  expect(Math.abs(state.topBar - state.bottomBar), "equal bars").toBeLessThan(1.5);
  // Played for a second, muted.
  await player.evaluate((el) => (el as HTMLVideoElement).play());
  await expect.poll(() => player.evaluate((el) => (el as HTMLVideoElement).currentTime), { timeout: 8000 }).toBeGreaterThan(1);
  expect(await player.evaluate((el) => (el as HTMLVideoElement).muted)).toBe(true);
  await player.evaluate((el) => (el as HTMLVideoElement).pause());
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // The pager keeps its behavior: a page a paragraph, the media in the stage. The demo is the HackTX page's stage, in the same 4:3 frame.
  test("hackathons card: at 390 the demo is the HackTX page's stage in the 4:3 frame, its paragraph under it, and the pager still turns", async ({ page }) => {
    const { dialog } = await openCardFromBook(page, "hackathons", { settled: true });
    const pages = dialog.locator("[data-pager-page]");
    await expect(pages).toHaveCount(5);
    const player = dialog.locator("[data-card-video] video");
    await expect(player).toHaveCount(1);
    const next = dialog.getByRole("button", { name: siteContent.modals.gallery.nextPage, exact: true });
    // Page 3 of 5 holds it (the UFCU picture, the AWS photo, then the demo).
    for (let i = 0; i < 2; i++) {
      await expect(pages.nth(i).locator("video")).toHaveCount(0);
      await next.click();
      await page.waitForTimeout(700);
    }
    const current = pages.nth(2);
    expect(await player.evaluate((el) => !!el.closest("[inert]")), "on the current page").toBe(false);
    await expect(current.locator("[data-pager-text]")).toContainText("HackTX, fall 2026.");
    const stage = (await current.locator("[data-pager-stage]").boundingBox())!;
    const frame = (await player.evaluate((el) => { const r = el.closest("[data-mask]")!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    expect(frame.width / frame.height, "the 4:3 frame").toBeCloseTo(4 / 3, 2);
    expect(frame.x).toBeGreaterThanOrEqual(stage.x - 1);
    expect(frame.x + frame.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
    expect(frame.width, "nearly the page's width").toBeGreaterThan(280);
    const box = (await player.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
    expect(box.width).toBeGreaterThan(280);
    // Its native controls are laid out at the width it is drawn: the dark scrim under them runs across the whole bottom of the
    // video (the poster there is pale), not a few pixels at the left as Chrome left it when the controls were attached off screen.
    const strip = await shoot(page, { x: box.x, y: box.y + box.height - 8, width: box.width, height: 4 });
    const luma = (share: number) => {
      const at = (2 * strip.width + Math.floor(share * (strip.width - 1))) * 4;
      return 0.2126 * strip.rgba[at] + 0.7152 * strip.rgba[at + 1] + 0.0722 * strip.rgba[at + 2];
    };
    for (const share of [0.3, 0.6, 0.85]) expect(luma(share), `the scrim at ${share} of the width`).toBeLessThan(110);
    await next.click();
    await page.waitForTimeout(700);
    await expect(pages.nth(3)).toContainText("Hook 'Em Hacks");
  });
});
