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

// A sticky element is seen anywhere down its track (the sticky element's parent, whose height it rides), so what sits in one keeps
// the line off the whole track: its x where it is drawn, its y the track's.
function stickyTrack(el: HTMLElement): HTMLElement | null {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "sticky") return n.parentElement;
  return null;
}

// What of a rect its clipping ancestors let show: a box that overflows a parent with overflow hidden or clip (the numbers chart's
// canvas inside its stage) is drawn only inside it. Layer px; null when nothing of it shows.
function clipped(el: HTMLElement, rect: Rect, origin: number, originLeft: number): Rect | null {
  const out = { ...rect };
  for (let n = el.parentElement; n; n = n.parentElement) {
    const style = getComputedStyle(n);
    const clipsX = style.overflowX !== "visible";
    const clipsY = style.overflowY !== "visible";
    if (!clipsX && !clipsY) continue;
    const b = n.getBoundingClientRect();
    if (clipsX) {
      out.left = Math.max(out.left, b.left - originLeft);
      out.right = Math.min(out.right, b.right - originLeft);
    }
    if (clipsY) {
      const t = docTop(n) - origin;
      out.top = Math.max(out.top, t);
      out.bottom = Math.min(out.bottom, t + n.offsetHeight);
    }
  }
  return out.right > out.left && out.bottom > out.top ? out : null;
}

// Where an element is drawn on the page, layer px: x from its client rect (a reveal's rise is vertical, so x is never skewed), y
// from the offset chain (so a reveal's transform never moves it) or, in a sticky element, its track's; clipped as it shows.
function placed(el: HTMLElement, x: { left: number; right: number }, origin: number, originLeft: number): Rect | null {
  const track = stickyTrack(el);
  const t = docTop(track ?? el) - origin;
  return clipped(el, { left: x.left - originLeft, right: x.right - originLeft, top: t, bottom: t + (track ?? el).offsetHeight }, origin, originLeft);
}

const offPage = (el: Element) => {
  if (el.closest('[data-wave-anchor="cards"], [data-wave-path], [inert]')) return true;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (style.position === "fixed" || style.display === "none" || style.visibility === "hidden") return true;
  }
  return false;
};

// Every link and button the line keeps off (a tap target is as big as its box, not its ink), outside the cards section, whose
// shader hides the line. A fixed one rides over the page and has no place on it; neither has one that is not drawn.
const TARGETS = "a[href], button, [role='button'], [role='link'], input, select, textarea, summary, [tabindex]:not([tabindex='-1'])";

function measureLinks(root: HTMLElement, origin: number, originLeft: number): Rect[] {
  const links: Rect[] = [];
  root.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
    if (!el.offsetWidth || !el.offsetHeight || el.closest('[aria-hidden="true"]') || offPage(el)) return;
    const r = el.getBoundingClientRect();
    const rect = placed(el, r, origin, originLeft);
    if (rect) links.push(rect);
  });
  return links;
}

// Every other line of text the reader sees that no block of words holds: a page's number (drawn, though hidden from assistive
// tech), a heading that is not one of the words, the line under page 1's button. One rect per text run.
function measureLoose(root: HTMLElement, origin: number, originLeft: number): Rect[] {
  const loose: Rect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent?.trim() || el.closest("[data-wave-words], .sr-only, [role='tooltip'], script, style") || offPage(el)) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // A text run's own box, from its element's offset chain: the run sits r.top - (its element's client top) into it.
    const box = el.getBoundingClientRect();
    const track = stickyTrack(el);
    const top = track ? docTop(track) - origin : docTop(el) - origin + (r.top - box.top);
    const rect = clipped(el, { left: r.left - originLeft, right: r.right - originLeft, top, bottom: top + (track ? track.offsetHeight : r.height) }, origin, originLeft);
    if (rect && rect.bottom > 0) loose.push(rect);
  }
  return loose;
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
  return { width: root.clientWidth, box, words, blocks, headings: measureLoose(root, origin, originLeft), links: measureLinks(root, origin, originLeft), hairlines: [], line: line ? docTop(line) - origin + line.offsetHeight / 2 : undefined };
}
