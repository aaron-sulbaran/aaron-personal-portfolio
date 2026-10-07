import type { CDPSession, Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import type { HookWindow } from "./support/hooks";
import { pointerTo } from "./support/input";

// The label face (docs/label-face-spec.md): every small non-body text is
// Profa Bold at one of three steps, 0.01em, weight 700, in the accent when
// clickable or beside a title and muted otherwise. Computed styles only.

const STEP = { "label-sm": 12.72, label: 14.84, "label-lg": 19.08 } as const;
type Step = keyof typeof STEP;
type Tone = "accent" | "muted" | "foreground";

async function expectLabel(locator: Locator, step: Step, tone: Tone) {
  const read = await locator.evaluate((el) => {
    const first = (list: string) => list.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const tone = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--color-${name})`;
      el.parentElement!.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const s = getComputedStyle(el);
    return {
      text: (el.textContent ?? "").trim().slice(0, 40),
      family: first(s.fontFamily),
      label: first(getComputedStyle(document.documentElement).getPropertyValue("--font-label")),
      weight: s.fontWeight,
      size: parseFloat(s.fontSize),
      tracking: parseFloat(s.letterSpacing),
      color: s.color,
      tones: { accent: tone("accent"), muted: tone("muted"), foreground: tone("foreground") },
    };
  });
  expect(read.label, "--font-label is set on <html>").not.toBe("");
  expect(read.family, `${read.text}: family`).toBe(read.label);
  expect(read.weight, `${read.text}: weight`).toBe("700");
  expect(read.size, `${read.text}: size`).toBeCloseTo(STEP[step], 1);
  expect(read.tracking, `${read.text}: tracking`).toBeCloseTo(STEP[step] * 0.01, 2);
  expect(read.color, `${read.text}: color`).toBe(read.tones[tone]);
}

// Opens a work card's modal the way a visitor does: hover the card until the
// scene picks it, then click (as flight.spec.ts does).
async function openWorkModal(page: Page, cdp: CDPSession) {
  await openHome(page, { debug: "flight" });
  const find = () =>
    page.evaluate(() => {
      const w = window as HookWindow;
      const slot = w.__coilFlight!.scene.slots().find(
        (s) =>
          s.kind === "work" && s.depth > 0.3 &&
          s.center.x > 80 && s.center.x < innerWidth - 80 && s.center.y > 80 && s.center.y < innerHeight * 0.75 &&
          w.__coil!.api.cardAt(s.center.x, s.center.y)?.slot === s.slot,
      );
      return slot?.slot ?? null;
    });
  await expect.poll(find, { timeout: 20_000, message: "a work card on screen" }).not.toBeNull();
  const slot = (await find())!;
  await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.follow(n), slot);
  const center = await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.slot(n)!.center, slot);
  await pointerTo(cdp, center);
  await page.waitForFunction((n) => (window as HookWindow).__coil!.hovered() === n, slot);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...center, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...center, button: "left", clickCount: 1 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("label face: controls and links are Profa Bold in the accent", async ({ page, cdp }) => {
  await page.goto("/work/capital-one-pm");
  await expectLabel(page.locator("article a[href='/#work']"), "label", "accent");
  await expectLabel(page.getByRole("link", { name: siteContent.work.placeholderCta }), "label-lg", "accent");

  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator('#listen [data-control="on"]'), "label", "accent");
  await expectLabel(page.locator('#listen [data-control="paused"]'), "label", "accent");
  await expectLabel(page.locator("#listen button", { hasText: siteContent.listen.freeze }), "label-sm", "accent");
  await expectLabel(page.locator("#listen a", { hasText: siteContent.soundtrack.creditArtist }), "label-sm", "accent");

  await page.goto("/label-face-missing");
  await expectLabel(page.getByRole("link", { name: siteContent.notFound.cta }), "label", "accent");

  const dialog = await openWorkModal(page, cdp);
  await expectLabel(dialog.getByRole("link", { name: siteContent.work.cta }), "label-lg", "accent");
});
