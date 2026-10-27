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
  const frame = dialog.locator("[data-photo-frame]", { has: image });
  await expect(frame.locator("figcaption")).toHaveText(aws.caption);
  // Its row's words are the AWS paragraph (and the HackTX one after it).
  const row = dialog.locator('[data-row="photo"]', { has: image });
  await expect(row.locator("[data-text-column]")).toContainText("Placed second with a hedge fund management workspace");
});
