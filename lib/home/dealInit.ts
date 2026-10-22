// The deal's head script, in the manner of themeInitScript (lib/theme.ts): it
// runs before the first paint and marks the page's cards section as closed
// (<html data-deal="pending">, which app/globals.css reads). Reduced motion
// skips it, so nothing there is ever closed. Without JS it never runs, so
// nothing is hidden and the page shows the dealt state. If the page's own
// script never takes over (a failed hydration), a CSS animation in
// globals.css opens everything again after a few seconds.
export function dealInitScript(): string {
  return (
    `(function(){try{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
    `document.documentElement.setAttribute("data-deal","pending");}catch(x){}})();`
  );
}
