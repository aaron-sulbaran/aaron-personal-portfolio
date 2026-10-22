import { COIL } from "@/lib/coil/constants";

// The deal's head script, in the manner of themeInitScript (lib/theme.ts): it
// runs before the first paint and marks the page's cards section as closed
// (<html data-deal="pending">, which app/globals.css reads), and sets the name
// settle's timing as custom properties. Reduced motion skips it, so nothing
// there is ever closed. Without JS it never runs, so nothing is hidden. If the
// page's own script never takes over (a failed hydration), a CSS animation in
// globals.css opens everything again after a few seconds.
export function dealInitScript(): string {
  const { ms, delayMs } = COIL.deal.settle;
  return (
    `(function(){try{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
    `var d=document.documentElement;d.setAttribute("data-deal","pending");` +
    `d.style.setProperty("--settle-ms","${ms}ms");d.style.setProperty("--settle-delay","${delayMs}ms");}catch(x){}})();`
  );
}
