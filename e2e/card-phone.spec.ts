import type { Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { GALLERY } from "@/lib/gallery/constants";
import { phoneCopy } from "@/lib/gallery/omit";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { openCardFromBook } from "./support/cards";

// Aaron's rule for the phone's card modals (2026-10-30): every page of every card's modal shows a photo and real words, the way the
// desktop pairs them. This pages through all fourteen cards at three phones (and Safari's short 390 by 664 window), light and dark, with
// real touch emulation, and on every page asserts:
//   - a photo (or the demo video, or on the jobs card a name tag or the post's card) at least 30 percent of the panel's width, in view;
//   - real words: a paragraph, a mentor, a tag's tip or the post's hook, and with the caption at least 12 words; never a link alone;
//   - nothing clipped (every line of text inside the pages' area and the panel), nothing scrolling inside the page or the modal.
// Every paragraph shows once, in order, whole, or with its phone omissions dropped (whole sentences, lib/content cards' phoneOmit), and
// only on a short window: at 390 by 844 and 430 by 932 every word stays. A card with no photos at all (min/Max, This site, the family
// business; Talos has its sting and its Discord channel) is its words alone in one sheet: there only an inner scroller is a fault.

const keys = Object.keys(siteContent.cards) as CardKey[];
const SIZES = [
  { width: 390, height: 844, everyWord: true },
  { width: 375, height: 667, everyWord: false },
  { width: 430, height: 932, everyWord: true },
  { width: 390, height: 664, everyWord: false },
] as const;
const MIN_WORDS = 12;
const MIN_MEDIA_SHARE = 0.3;

type PageRead = { problems: string[]; paragraphs: { unit: number; text: string }[]; media: number; words: number };

// One page, once it is the current page and at rest.
function readPage(page: Page, key: CardKey, index: number, rules: { minWords: number; minShare: number }): Promise<PageRead> {
  return page.evaluate(
    ([card, i, r]) => {
      const out: string[] = [];
      const at = `page ${i + 1}`;
      const dialog = document.querySelector<HTMLElement>(`[role="dialog"][data-card-modal="${card}"]`)!;
      const pageEl = dialog.querySelector<HTMLElement>(`[data-pager-page="${i}"]`)!;
      const area = dialog.querySelector<HTMLElement>("[data-pager-viewport]")!.getBoundingClientRect();
      const panel = dialog.querySelector<HTMLElement>("[data-gallery-panel]")!.getBoundingClientRect();
      const name = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute("data-block") ? `[${el.getAttribute("data-block")}]` : ""}`;
      // Nothing scrolls inside the page, and the modal itself does not scroll.
      for (const el of pageEl.querySelectorAll<HTMLElement>("*")) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push(`${at}: ${name(el)} scrolls (${el.clientHeight} of ${el.scrollHeight}px)`);
        if (el.hasAttribute("data-scrolls")) out.push(`${at}: ${name(el)} is a scroll window`);
      }
      if (dialog.scrollHeight > dialog.clientHeight + 1) out.push(`${at}: the modal scrolls`);
      // Every line of text: a text node's own rects, which are where the lines are drawn.
      const range = document.createRange();
      const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || !node.textContent?.trim() || el.closest(".sr-only, [aria-hidden='true'], [inert]")) continue;
        const shown = getComputedStyle(el);
        if (shown.visibility === "hidden" || shown.display === "none" || Number(shown.opacity) === 0) continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          if (rect.top < area.top - 1 || rect.bottom > area.bottom + 1 || rect.left < panel.left - 1 || rect.right > panel.right + 1) {
            out.push(`${at}: text clipped "${node.textContent.trim().slice(0, 30)}" (${Math.round(rect.top)} to ${Math.round(rect.bottom)}, area ${Math.round(area.top)} to ${Math.round(area.bottom)})`);
            break;
          }
        }
      }
      // A photo of real size in view: the current one of a group, drawn (an image with its pixels, the video, a name tag or the post's card).
      const frames = [...pageEl.querySelectorAll<HTMLElement>("[data-photo-frame]")].filter((frame) => !frame.hasAttribute("data-rotator-layer") || frame.hasAttribute("data-current"));
      const real = frames.filter((frame) => {
        const box = frame.getBoundingClientRect();
        const img = frame.querySelector("img");
        const drawn = !!frame.querySelector("video, [data-job-tag], [data-post-card]") || (!!img && img.complete && img.naturalWidth > 0);
        return drawn && box.width >= panel.width * r.minShare && box.height >= 60 && box.top >= area.top - 1 && box.bottom <= area.bottom + 1;
      });
      const media = real.length ? Math.max(...real.map((frame) => frame.getBoundingClientRect().width / panel.width)) : 0;
      if (!real.length) out.push(`${at}: no photo of real size (${frames.map((frame) => Math.round(frame.getBoundingClientRect().width)).join(", ") || "none"})`);
      // Real words: the page's body (a paragraph, a mentor, a tag's tip, the post's hook) and its caption, never the card's links alone.
      const bodies = [...pageEl.querySelectorAll<HTMLElement>('[data-block^="w"], [data-block^="m"], [data-job-tag-tip], [data-post-card-hook]')];
      const caption = [...pageEl.querySelectorAll<HTMLElement>('p[data-mask^="caption-"]')].filter((p) => !p.closest('[aria-hidden="true"]'));
      const words = [...bodies, ...caption].map((el) => el.textContent ?? "").join(" ").split(/\s+/).filter(Boolean).length;
      if (!bodies.length) out.push(`${at}: no paragraph, mentor or tip: only ${pageEl.querySelector("[data-block='end']") ? "the links" : "media"}`);
      if (words < r.minWords) out.push(`${at}: ${words} words`);
      const paragraphs = [...pageEl.querySelectorAll<HTMLElement>('[data-pager-text] p[data-mask^="words-"]')].map((p) => ({ unit: Number(p.dataset.mask!.slice(6)), text: p.textContent ?? "" }));
      return { problems: out, paragraphs, media, words };
    },
    [key, index, rules] as const,
  );
}

// The page at rest in the pages' area (the slide has ended, on a loaded machine too), and its images drawn, before it is read (a page off
// to the side loads its photo when it comes into view).
async function settle(page: Page, key: CardKey, index: number) {
  await page.waitForTimeout(GALLERY.pager.slideMs);
  await page.waitForFunction(
    ([card, i]) => {
      const dialog = document.querySelector(`[data-card-modal="${card}"]`);
      const area = dialog?.querySelector("[data-pager-viewport]")?.getBoundingClientRect();
      const at = dialog?.querySelector(`[data-pager-page="${i}"]`)?.getBoundingClientRect();
      return !!area && !!at && Math.abs(at.left - area.left) < 1;
    },
    [key, index] as const,
    { polling: "raf", timeout: 8000 },
  );
  await page
    .waitForFunction(([card, i]) => [...document.querySelectorAll<HTMLImageElement>(`[data-card-modal="${card}"] [data-pager-page="${i}"] img`)].every((img) => img.complete), [key, index] as const, { timeout: 8000 })
    .catch(() => {});
}

// Each paragraph shows once and in order, as written or with its first phone omissions dropped; with the room, as written.
function checkParagraphs(key: CardKey, shown: { unit: number; text: string }[], everyWord: boolean): string[] {
  const { blocks, phoneOmit } = siteContent.cards[key].modal;
  const out: string[] = [];
  if (shown.map((p) => p.unit).join() !== blocks.map((_, i) => i).join()) out.push(`paragraphs shown ${shown.map((p) => p.unit).join()} of ${blocks.length}`);
  for (const { unit, text } of shown) {
    const omit = phoneOmit?.[unit] ?? [];
    const level = Array.from({ length: omit.length + 1 }, (_, n) => n).find((n) => visibleText(phoneCopy(blocks[unit], omit, n)) === text);
    if (level === undefined) out.push(`paragraph ${unit} is not its words with whole sentences dropped`);
    else if (everyWord && level > 0) out.push(`paragraph ${unit} dropped ${level} sentence(s) on a window with the room`);
  }
  return out;
}

async function sweepCard(page: Page, key: CardKey, everyWord: boolean, problems: string[], pagesOf: Record<string, number>) {
  const { dialog } = await openCardFromBook(page, key, { home: false, settled: true });
  const say = (problem: string) => problems.push(`${key}: ${problem}`);
  const overflow = await page.evaluate((card) => {
    const root = document.documentElement;
    const panel = document.querySelector<HTMLElement>(`[data-card-modal="${card}"] [data-gallery-panel]`)!;
    return root.scrollWidth - root.clientWidth + Math.max(0, panel.scrollWidth - panel.clientWidth);
  }, key);
  if (overflow > 0) say(`${overflow}px of sideways overflow`);
  if ((await dialog.locator("[data-pager]").count()) === 0) {
    // Words alone, in one sheet: nothing inside the panel scrolls (the modal itself may, as one sheet), and its words are real.
    const sheet = await page.evaluate((card) => {
      const panel = document.querySelector(`[role="dialog"][data-card-modal="${card}"] [data-gallery-panel]`)!;
      const scrollers = [...panel.querySelectorAll<HTMLElement>("*")].filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1).length;
      const words = [...panel.querySelectorAll<HTMLElement>('p[data-mask^="words-"]')].map((p) => p.textContent ?? "").join(" ").split(/\s+/).filter(Boolean).length;
      return { scrollers, words };
    }, key);
    if (sheet.scrollers) say(`${sheet.scrollers} scroller(s) inside the sheet`);
    if (sheet.words < MIN_WORDS) say(`${sheet.words} words in the sheet`);
    pagesOf[key] = 1;
  } else {
    const count = await dialog.locator("[data-pager-page]").count();
    pagesOf[key] = count;
    const shown: { unit: number; text: string }[] = [];
    for (let i = 0; i < count; i++) {
      if (i > 0) await dialog.locator(`[data-pager-dot="${i}"]`).click();
      await settle(page, key, i);
      const read = await readPage(page, key, i, { minWords: MIN_WORDS, minShare: MIN_MEDIA_SHARE });
      read.problems.forEach(say);
      shown.push(...read.paragraphs);
    }
    checkParagraphs(key, shown, everyWord).forEach(say);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
}

for (const size of SIZES) {
  for (const colorScheme of size.height === 664 ? (["light"] as const) : (["light", "dark"] as const)) {
    test.describe(`at ${size.width} by ${size.height} in ${colorScheme}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 3, colorScheme });

      test("every page of every card's modal shows a photo and real words, with nothing clipped and nothing scrolling", async ({ page }) => {
        test.setTimeout(480_000);
        await openHome(page);
        const problems: string[] = [];
        const pagesOf: Record<string, number> = {};
        for (const key of keys) await sweepCard(page, key, size.everyWord, problems, pagesOf);
        expect(problems, `pages per card ${JSON.stringify(pagesOf)}`).toEqual([]);
      });
    });
  }
}
