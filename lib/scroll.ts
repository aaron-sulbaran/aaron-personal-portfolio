// Navigate to an in-page section from anywhere in the site. SiteNav and Menu
// render on every route, but the sections only exist on the single-page home
// document. On "/", smooth-scroll and stamp the hash (only a hash we honored).
// On any other route, do a real navigation to the home anchor and let the home
// page's deep-link handler place the scroll.
export function navigateToSection(href: string, prefersReducedMotion: boolean) {
  if (window.location.pathname !== "/") {
    window.location.assign(href === "#main" ? "/" : `/${href}`);
    return;
  }
  const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
  const id = href.replace(/^#/, "");
  const el = id && id !== "main" ? document.getElementById(id) : null;
  if (!el) {
    window.scrollTo({ top: 0, behavior });
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return;
  }
  el.scrollIntoView({ behavior, block: "start" });
  window.history.replaceState(null, "", href);
  landOn(el, behavior);
}

// A jump aims once, when it starts. Anything above the section that changes
// height on the way (page 1's card slot closing once the reader is below it,
// the numbers chart rising as it comes into view) moves the section, and the
// jump would rest short of it: Menu, then Connect, rested 230px down instead of
// at Connect's top. So once the scroll has stopped the jump looks again, and if
// the section has moved it scrolls once more. A wheel, touch, press or key of
// the reader's own in the meantime leaves the page where they put it.
export const JUMP = { stillFrames: 8, tolerancePx: 2, tries: 2, maxMs: 6000 } as const;

export function sectionRestY(at: { top: number; scrollY: number; marginTop: number; maxScroll: number }): number {
  return Math.min(Math.max(at.top + at.scrollY - at.marginTop, 0), at.maxScroll);
}

export const jumpIsShort = (restY: number, scrollY: number) => Math.abs(restY - scrollY) > JUMP.tolerancePx;

const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

function landOn(el: HTMLElement, behavior: ScrollBehavior) {
  const started = performance.now();
  let tries: number = JUMP.tries;
  let lastY = Number.NaN;
  let stillFor = 0;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of READER_INPUT) window.removeEventListener(type, stop, true);
  };
  for (const type of READER_INPUT) window.addEventListener(type, stop, { capture: true, passive: true });
  const step = () => {
    const y = window.scrollY;
    stillFor = y === lastY ? stillFor + 1 : 0;
    lastY = y;
    if (performance.now() - started > JUMP.maxMs) return stop();
    if (stillFor >= JUMP.stillFrames) {
      const restY = sectionRestY({
        top: el.getBoundingClientRect().top,
        scrollY: y,
        marginTop: parseFloat(getComputedStyle(el).scrollMarginTop) || 0,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
      });
      if (!jumpIsShort(restY, y) || tries <= 0) return stop();
      tries -= 1;
      stillFor = 0;
      el.scrollIntoView({ behavior, block: "start" });
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

// Refresh scroll recovery. We take manual control of scroll restoration (see
// lib/home/recovery.ts) so the entrance lock never strands a visitor who reloaded
// deep in the document. To restore their place ourselves we persist the scroll
// position to sessionStorage and read it back on the next load.
export const HOME_SCROLL_KEY = "aps:home-scroll-y";

export function saveScrollY(y: number) {
  try {
    sessionStorage.setItem(HOME_SCROLL_KEY, String(Math.round(y)));
  } catch {
    // Private mode / disabled storage: degrade to no persistence.
  }
}

export function readScrollY(): number | null {
  try {
    const raw = sessionStorage.getItem(HOME_SCROLL_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
