import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { siteContent } from "@/lib/content";
import { openHome } from "./support/coil";
import { BAND_CARD, PLAYER_PILL } from "./support/player";
import { parkBand } from "./support/wave";

// The open player never covers words (Aaron, 2026-10-30: the open card sat over
// the first line of the paragraph under the band). With the player opened from
// the band, by Play it on a first visit and by Resume for a returning yes, the
// band's card stands in page 1's player's room (the late grid's columns right of
// paragraph 2, app/globals.css --player-room), and its box meets no line of page
// 1's text: the name, both paragraphs (each paragraph's whole box, not only its
// lines), the band's copy row and the foot's lines, every line box the browser
// drew. At every desktop width it is the band's card that opens, never the
// player docked at the isle; on a phone the card opens in the flow under the
// band's copy.

const L = siteContent.listen;
const { teaser } = siteContent.intro;

type Box = { left: number; top: number; right: number; bottom: number; what: string };

// Page 1's text and the card, in document px, read after the card has faded in.
function readPage(page: Page) {
  return page.evaluate(() => {
    const doc = (r: DOMRect, what: string): Box => ({ left: r.left, right: r.right, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, what });
    // Not drawn: hidden, faded to nothing, inert (the band's resting layers), or fixed (it rides over the page, it is not on it).
    const hidden = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed" || Number(style.opacity) === 0 || n.hasAttribute("inert")) return true;
      }
      return false;
    };
    const about = document.getElementById("about")!;
    const lines: Box[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(about, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || el.closest("[data-player-band-slot]") || hidden(el)) continue;
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) if (r.width >= 2 && r.height >= 2) lines.push(doc(r, node.textContent.trim().slice(0, 40)));
    }
    const boxes = [
      doc(document.getElementById("intro-heading")!.getBoundingClientRect(), "the name"),
      ...Array.from(about.querySelectorAll("[data-block-text]")).map((p) => doc(p.getBoundingClientRect(), `paragraph ${p.closest("[data-story-block]")!.getAttribute("data-story-block")}`)),
    ];
    const card = document.querySelector("[data-player-band-card]")!;
    return { card: doc(card.getBoundingClientRect(), "the card"), lines, boxes };
  });
}

const overlap = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

const SIZES = [
  { width: 768, height: 1024 },
  { width: 1024, height: 800 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844, phone: true },
];

for (const size of SIZES) {
  test.describe(`the open player at ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: !!size.phone, isMobile: !!size.phone });

    for (const way of ["Play it", "Resume"] as const) {
      test(`player room: opened by ${way}, the band's card covers no word of page 1`, async ({ page, browserName }) => {
        test.skip(browserName === "webkit", "WebKit cannot be launched muted");
        if (way === "Resume") await page.addInitScript(() => localStorage.setItem("aaron-soundtrack", "on"));
        await openHome(page, { at: "top" });
        await parkBand(page);
        const band = page.locator("#listen");
        if (way === "Play it") await band.getByRole("button", { name: L.accept, exact: true }).click();
        else await band.locator('[data-control="paused"]').click();
        // The card opens in the band at every width, and nothing stands open at the isle's dock.
        await expect(page.locator(BAND_CARD)).toBeVisible();
        await expect.poll(() => page.locator(BAND_CARD).evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
        await expect(page.locator(PLAYER_PILL)).toHaveCount(0);
        const { card, lines, boxes } = await readPage(page);
        // The probe sees what it must: the paragraphs, the band's question on a first visit, and the foot's lines (Deal me in, the MVP line).
        const said = lines.map((line) => line.what);
        expect(said.some((t) => t.startsWith(teaser.deal)), "Deal me in is read").toBe(true);
        expect(said.some((t) => t.startsWith("In a rush?")), "the MVP line is read").toBe(true);
        if (way === "Play it") expect(said.some((t) => L.line.startsWith(t)), "the band's question is read").toBe(true);
        expect(boxes.filter((box) => box.what.startsWith("paragraph"))).toHaveLength(2);
        const hits = [...lines, ...boxes].filter((box) => overlap(card, box)).map((box) => `${box.what} at ${Math.round(box.left)},${Math.round(box.top)}`);
        expect(hits, `the card at ${Math.round(card.left)},${Math.round(card.top)} to ${Math.round(card.right)},${Math.round(card.bottom)}`).toEqual([]);
        if (!size.phone) {
          // The room is the card's: it stands right of paragraph 2's columns, a column's gap clear, and is never wider than the isle's open player.
          const cell = await page.locator("#story-outside").boundingBox();
          expect(card.left - (cell!.x + cell!.width), "the gap from paragraph 2's columns to the card").toBeGreaterThanOrEqual(31);
          expect(card.right - card.left).toBeLessThanOrEqual(360.5);
        }
      });
    }
  });
}
