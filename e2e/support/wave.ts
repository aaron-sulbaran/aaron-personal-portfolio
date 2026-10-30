import type { Page } from "@playwright/test";
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

// The band's bottom edge at `y` px from the viewport's top.
export async function bandBottomAt(page: Page, y: number) {
  const top = await page.evaluate((y) => document.getElementById("listen")!.getBoundingClientRect().bottom + window.scrollY - y, y);
  await scrollToY(page, Math.round(top));
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
// top, the probe layout's origin): every line of text, and every link, button and control, outside the cards section, whose shader
// hides the line. Nothing fixed (it rides over the page), nothing hidden or inert. Read after the page has been walked, so every
// reveal has played and no line is still mid rise.
export type PageRects = { lines: (Rect & { text: string })[]; targets: (Rect & { label: string })[] };

export function pageRects(page: Page): Promise<PageRects> {
  return page.evaluate(() => {
    const probe = (window as unknown as { __wavePath: { layout: { origin: number } } }).__wavePath;
    const origin = probe.layout.origin;
    const rootLeft = document.querySelector("[data-wave-path]")!.parentElement!.getBoundingClientRect().left;
    const rectOf = (r: DOMRect) => ({ left: r.left - rootLeft, right: r.right - rootLeft, top: r.top + window.scrollY - origin, bottom: r.bottom + window.scrollY - origin });
    const hidden = (el: Element) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed" || n.hasAttribute("inert") || n.getAttribute("aria-hidden") === "true") return true;
      }
      return false;
    };
    const skipped = "[data-wave-path], #work, .sr-only, script, style, noscript";
    const cards = document.getElementById("work")!.getBoundingClientRect();
    const outsideCards = (r: Rect) => r.bottom <= cards.top + window.scrollY - origin || r.top >= cards.bottom + window.scrollY - origin;
    const lines: PageRects["lines"] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim() || hidden(el) || el.closest(skipped)) continue;
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (box.width >= 2 && box.height >= 2) lines.push({ ...rectOf(box), text: node.textContent.trim().slice(0, 24) });
    }
    const targets: PageRects["targets"] = [];
    const controls = "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [role='tab'], [tabindex]:not([tabindex='-1'])";
    for (const el of document.querySelectorAll(controls)) {
      const box = el.getBoundingClientRect();
      if (box.width < 4 || box.height < 4 || hidden(el) || el.closest(skipped)) continue;
      targets.push({ ...rectOf(box), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24) });
    }
    return { lines: lines.filter(outsideCards), targets: targets.filter(outsideCards) };
  });
}
