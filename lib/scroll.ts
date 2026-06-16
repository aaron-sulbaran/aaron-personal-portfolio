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
