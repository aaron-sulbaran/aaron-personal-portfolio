// In-page navigation for the single scrolling document. "#main" (or any href
// whose target is missing) scrolls to the very top so the hero/ring reads in
// full; any other hash scrolls its section into view. Reduced motion jumps
// instantly instead of animating, matching the globals.css scroll-behavior rule.
export function scrollToTarget(href: string, prefersReducedMotion: boolean) {
  const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
  const id = href.replace(/^#/, "");
  const el = id ? document.getElementById(id) : null;
  if (!el || id === "main") {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  el.scrollIntoView({ behavior, block: "start" });
}

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
}

// Refresh scroll recovery. We take manual control of scroll restoration (see
// TileRing) so the hero entrance freeze never strands a visitor who reloaded
// deep in the document. To restore their place ourselves we persist the scroll
// position to sessionStorage and read it back on the next load.
const SCROLL_KEY = "aps:home-scroll-y";

export function saveScrollY(y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.round(y)));
  } catch {
    // Private mode / disabled storage: degrade to no persistence.
  }
}

export function readScrollY(): number | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
