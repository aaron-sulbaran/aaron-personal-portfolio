import { SECTION_KEYS, type Anchors, type Rect, type SectionKey, type Span } from "@/lib/wavepath/spine";

// The page the line is laid on, in layer px (origin: the band's document
// top). Sections are [data-wave-anchor]; their words the union of their
// [data-wave-words] blocks; gaps fall between one section's last words and the
// next one's first. A word block outside every section (page 1's paragraphs
// and teaser, which sit between the band and the cards) still keeps the line
// clear: it joins the blocks the dots avoid, though it is no section's words.
// Tops come from the offset chain, so a reveal's transform never moves them; a
// sticky block is never measured (its offset moves with the scroll). Layout
// only, never in a paint.
export function docTop(el: HTMLElement): number {
  let y = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop;
  return y;
}

const stuck = (el: HTMLElement) => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "sticky") return true;
  return false;
};

// The horizontal ink of an element: the union of its text runs (and icons),
// from client rects (a reveal's rise is vertical, so x is never skewed).
function inkX(el: HTMLElement, originLeft: number): { left: number; right: number } {
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = Infinity;
  let right = -Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  }
  el.querySelectorAll("svg").forEach((icon) => {
    const r = icon.getBoundingClientRect();
    if (!r.width) return;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  });
  if (left > right) {
    const r = el.getBoundingClientRect();
    return { left: r.left - originLeft, right: r.right - originLeft };
  }
  return { left: left - originLeft, right: right - originLeft };
}

// Every link and button the line keeps off (a tap target is as big as its box, not its ink), outside the cards section, whose
// shader hides the line. A fixed one rides over the page and has no place on it; neither has one that is not drawn.
const TARGETS = "a[href], button, [role='button'], [role='link'], input, select, textarea, summary";

function measureLinks(root: HTMLElement, origin: number, originLeft: number): Rect[] {
  const links: Rect[] = [];
  root.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
    if (!el.offsetWidth || !el.offsetHeight || stuck(el) || el.closest('[data-wave-anchor="cards"], [data-wave-path], [aria-hidden="true"], [inert]')) return;
    if (getComputedStyle(el).visibility === "hidden") return;
    for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return;
    const t = docTop(el) - origin;
    const r = el.getBoundingClientRect();
    links.push({ left: r.left - originLeft, right: r.right - originLeft, top: t, bottom: t + el.offsetHeight });
  });
  return links;
}

export function measureAnchors(root: HTMLElement, origin: number): Anchors | null {
  const originLeft = root.getBoundingClientRect().left;
  const box = {} as Record<SectionKey, Span>;
  const words = {} as Record<SectionKey, Span>;
  const blocks: Rect[] = [];
  const measured = new Set<HTMLElement>();
  for (const key of SECTION_KEYS) {
    const el = root.querySelector<HTMLElement>(`[data-wave-anchor="${key}"]`);
    if (!el) return null;
    const top = docTop(el) - origin;
    box[key] = { top, bottom: top + el.offsetHeight };
    let first = Infinity;
    let last = -Infinity;
    el.querySelectorAll<HTMLElement>("[data-wave-words]").forEach((w) => {
      if (stuck(w)) return;
      measured.add(w);
      const t = docTop(w) - origin;
      first = Math.min(first, t);
      last = Math.max(last, t + w.offsetHeight);
      blocks.push({ ...inkX(w, originLeft), top: t, bottom: t + w.offsetHeight });
    });
    words[key] = Number.isFinite(first) ? { top: first, bottom: last } : box[key];
  }
  root.querySelectorAll<HTMLElement>("[data-wave-words]").forEach((w) => {
    if (measured.has(w) || stuck(w)) return;
    const t = docTop(w) - origin;
    // Above the band the line has no layer, so there is nothing to keep clear of.
    if (t + w.offsetHeight < 0) return;
    blocks.push({ ...inkX(w, originLeft), top: t, bottom: t + w.offsetHeight });
  });
  const line = root.querySelector<HTMLElement>("[data-wave-band-line]");
  return { width: root.clientWidth, box, words, blocks, headings: [], links: measureLinks(root, origin, originLeft), hairlines: [], line: line ? docTop(line) - origin + line.offsetHeight / 2 : undefined };
}
