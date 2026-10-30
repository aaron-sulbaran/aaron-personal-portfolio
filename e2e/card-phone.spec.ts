import type { Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { openCardFromBook } from "./support/cards";

// Every card's modal on a phone, paged through to its last page: nothing in a page scrolls (no window of words, no scrolling stage), and no
// text is clipped (every line of text on the current page is inside the pages' area and inside the panel). Words that do not fit beside
// their media have a page of their own (lib/gallery/paginate), so this holds at Safari's short 664px window as well as at 844.
// A card with no photos is its words alone, in the modal itself, which scrolls as one sheet: there only an inner scroller is a fault.

const keys = Object.keys(siteContent.cards) as CardKey[];

type Problems = string[];

// Read one page, once it is the current page and at rest.
function readPage(page: Page, key: CardKey, index: number): Promise<Problems> {
  return page.evaluate(
    ([card, i]) => {
      const out: string[] = [];
      const dialog = document.querySelector<HTMLElement>(`[role="dialog"][data-card-modal="${card}"]`)!;
      const pageEl = dialog.querySelector<HTMLElement>(`[data-pager-page="${i}"]`)!;
      const area = dialog.querySelector<HTMLElement>("[data-pager-viewport]")!.getBoundingClientRect();
      const panel = dialog.querySelector<HTMLElement>("[data-gallery-panel]")!.getBoundingClientRect();
      const name = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute("data-block") ? `[${el.getAttribute("data-block")}]` : ""}`;
      for (const el of pageEl.querySelectorAll<HTMLElement>("*")) {
        const style = getComputedStyle(el);
        const scrolls = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
        if (scrolls) out.push(`page ${i + 1}: ${name(el)} scrolls (${el.clientHeight} of ${el.scrollHeight}px)`);
        if (el.hasAttribute("data-scrolls")) out.push(`page ${i + 1}: ${name(el)} is a scroll window`);
      }
      // Every line of text: a text node's own rects, which are where the lines are drawn.
      const range = document.createRange();
      const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || !node.textContent?.trim() || el.closest(".sr-only, [aria-hidden='true'], [inert]")) continue;
        const shown = getComputedStyle(el);
        if (shown.visibility === "hidden" || shown.display === "none" || Number(shown.opacity) === 0) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          if (r.top < area.top - 1 || r.bottom > area.bottom + 1 || r.left < panel.left - 1 || r.right > panel.right + 1) {
            out.push(`page ${i + 1}: text clipped "${node.textContent.trim().slice(0, 30)}" (${Math.round(r.top)} to ${Math.round(r.bottom)}, area ${Math.round(area.top)} to ${Math.round(area.bottom)})`);
            break;
          }
        }
      }
      // The words' own area holds all its blocks.
      const text = pageEl.querySelector<HTMLElement>("[data-pager-text]");
      const inner = text?.firstElementChild as HTMLElement | undefined;
      if (text && inner && inner.getBoundingClientRect().bottom > text.getBoundingClientRect().bottom + 1) out.push(`page ${i + 1}: words run past their area`);
      return out;
    },
    [key, index] as const,
  );
}

async function pagesOf(page: Page, key: CardKey, problems: Problems) {
  const dialog = page.locator(`[role="dialog"][data-card-modal="${key}"]`);
  const pager = dialog.locator("[data-pager]");
  if ((await pager.count()) === 0) {
    // Words alone: nothing inside the panel scrolls (the modal itself does, as one sheet).
    problems.push(
      ...(await page.evaluate((card) => {
        const panel = document.querySelector(`[role="dialog"][data-card-modal="${card}"] [data-gallery-panel]`)!;
        return [...panel.querySelectorAll<HTMLElement>("*")].filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1).map((el) => `${el.tagName.toLowerCase()} scrolls inside the sheet`);
      }, key)),
    );
    return 1;
  }
  const count = await dialog.locator("[data-pager-page]").count();
  for (let i = 0; i < count; i++) {
    await dialog.locator(`[data-pager-dot="${i}"]`).click();
    await page.waitForTimeout(460);
    problems.push(...(await readPage(page, key, i)));
  }
  return count;
}

for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 664 }]) {
  test.describe(`at ${viewport.width} by ${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("every card's modal pages through with nothing scrolling and no text clipped", async ({ page }) => {
      test.setTimeout(420_000);
      await openHome(page);
      const problems: Problems = [];
      const pages: Record<string, number> = {};
      for (const key of keys) {
        const { dialog } = await openCardFromBook(page, key, { home: false, settled: true });
        const found: Problems = [];
        pages[key] = await pagesOf(page, key, found);
        problems.push(...found.map((problem) => `${key}: ${problem}`));
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
      expect(problems, `pages per card ${JSON.stringify(pages)}`).toEqual([]);
    });
  });
}
