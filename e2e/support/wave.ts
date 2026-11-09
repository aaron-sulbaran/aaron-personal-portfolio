import { expect, type Page } from "@playwright/test";
import type { Rect } from "@/lib/wavepath/spine";
import { scrollToY } from "./coil";

// Placing the page against the band.

export const BAND_PARK = 0.7;

export async function documentTop(page: Page, selector: string) {
  return page.evaluate((sel) => document.querySelector(sel)!.getBoundingClientRect().top + window.scrollY, selector);
}

// The band's centre at `at` of the viewport height (BAND_PARK by default).
export async function parkBand(page: Page, at = BAND_PARK) {
  const y = await page.evaluate((at) => {
    const band = document.getElementById("listen")!.getBoundingClientRect();
    return band.top + window.scrollY + band.height / 2 - at * window.innerHeight;
  }, at);
  await scrollToY(page, Math.round(y));
}

// The wave's head at rest on its target. Scrolled past an unanswered prompt the wave follows the reader (Nov 9), so a page opened at the
// cards and scrolled back to the band has the head easing back to the run's end; a test that needs the quiet band waits for it here.
export async function headAtRest(page: Page) {
  await page.waitForFunction(() => {
    const f = (window as unknown as { __wavePath: { frame: () => { head: number; target: number; length: number } | null } }).__wavePath.frame();
    return !!f && f.length > 0 && f.head === f.target;
  });
}

// The band's bottom edge at `y` px from the viewport's top.
export async function bandBottomAt(page: Page, y: number) {
  const top = await page.evaluate((y) => document.getElementById("listen")!.getBoundingClientRect().bottom + window.scrollY - y, y);
  await scrollToY(page, Math.round(top));
}

// The page done moving: the document's height the same over two reads `ms` apart (the numbers chart morphs flat or skyline as
// the reader passes it, and the line is laid again once it lands). Read before measuring the page against the line.
export async function pageSettled(page: Page, ms = 400) {
  await expect
    .poll(async () => {
      const a = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.waitForTimeout(ms);
      return a === (await page.evaluate(() => document.documentElement.scrollHeight));
    }, { timeout: 15_000, message: "the page's height settles" })
    .toBe(true);
}

// Where the path layer's ink is, in document px: every painted pixel of every
// tile that holds a bitmap (a tile owns one only near the viewport). minY and
// maxY are null when nothing is painted. `bandBottom` is the band's bottom edge
// in the same px, so a test can say "no ink above it".
export type PathInk = { painted: number; minY: number | null; maxY: number | null; bandBottom: number };

export async function pathInk(page: Page): Promise<PathInk> {
  return page.evaluate(() => {
    let painted = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>("[data-wave-path] canvas")) {
      if (!canvas.width || !canvas.height) continue;
      const rect = canvas.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const scale = canvas.height / rect.height;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
          painted++;
          minY = Math.min(minY, top + y / scale);
          maxY = Math.max(maxY, top + y / scale);
        }
      }
    }
    const band = document.getElementById("listen")!.getBoundingClientRect();
    return { painted, minY: painted ? minY : null, maxY: painted ? maxY : null, bandBottom: band.bottom + window.scrollY };
  });
}

// How many pixels of the band's own canvas are painted.
export const bandInkPixels = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#listen canvas")!;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return painted;
  });

// What the line must keep off, as the browser drew it, in the path layer's px (x from the layer's left, y from the band's document
// top, the probe layout's origin): every line of text (a page's number too: it is drawn, though hidden from assistive tech), and
// every link, button and control, as much of each as its clipping ancestors let show, outside the cards section, whose shader
// hides the line. Nothing fixed (it rides over the page), nothing hidden or inert. Read after the page has been walked, so every
// reveal has played and no line is still mid rise.
export type PageRects = { lines: (Rect & { text: string })[]; targets: (Rect & { label: string })[] };

export function pageRects(page: Page): Promise<PageRects> {
  return page.evaluate(() => {
    const probe = (window as unknown as { __wavePath: { layout: { origin: number } } }).__wavePath;
    const origin = probe.layout.origin;
    const rootLeft = document.querySelector("[data-wave-path]")!.parentElement!.getBoundingClientRect().left;
    const rectOf = (r: { left: number; right: number; top: number; bottom: number }) => ({ left: r.left - rootLeft, right: r.right - rootLeft, top: r.top + window.scrollY - origin, bottom: r.bottom + window.scrollY - origin });
    const hidden = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed" || n.hasAttribute("inert")) return true;
      }
      return false;
    };
    // A box shows only inside every ancestor that clips its overflow.
    const shown = (el: Element, box: { left: number; right: number; top: number; bottom: number }) => {
      const out = { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      for (let n = el.parentElement; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        const b = n.getBoundingClientRect();
        if (style.overflowX !== "visible") Object.assign(out, { left: Math.max(out.left, b.left), right: Math.min(out.right, b.right) });
        if (style.overflowY !== "visible") Object.assign(out, { top: Math.max(out.top, b.top), bottom: Math.min(out.bottom, b.bottom) });
      }
      return out.right - out.left >= 2 && out.bottom - out.top >= 2 ? out : null;
    };
    const skipped = "[data-wave-path], #work, .sr-only, [role='tooltip'], script, style, noscript";
    const cards = document.getElementById("work")!.getBoundingClientRect();
    const outsideCards = (r: Rect) => r.bottom <= cards.top + window.scrollY - origin || r.top >= cards.bottom + window.scrollY - origin;
    const lines: PageRects["lines"] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || hidden(el) || el.closest(skipped)) continue;
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) {
        const seen = box.width >= 2 && box.height >= 2 ? shown(el, box) : null;
        if (seen) lines.push({ ...rectOf(seen), text: node.textContent.trim().slice(0, 24) });
      }
    }
    const targets: PageRects["targets"] = [];
    const controls = "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [role='tab'], [tabindex]:not([tabindex='-1'])";
    for (const el of document.querySelectorAll(controls)) {
      const box = el.getBoundingClientRect();
      if (box.width < 4 || box.height < 4 || hidden(el) || el.closest(skipped) || el.closest("[aria-hidden='true']")) continue;
      const seen = shown(el, box);
      if (seen) targets.push({ ...rectOf(seen), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24) });
    }
    return { lines: lines.filter(outsideCards), targets: targets.filter(outsideCards) };
  });
}
