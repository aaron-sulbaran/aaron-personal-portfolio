import { COIL } from "@/lib/coil/constants";
import { INTRO_HEADING_ID } from "@/lib/home/introId";

// The intro name's settle: "Hi, I'm Aaron." is server-rendered at its final
// place and opens larger (a transform only, origin at its top left), settling to
// 1x once. The start scale is capped so the heading's ink never crosses the
// viewport's right edge: on a phone the name fills the width already.
//
// The start is a CSS animation on [data-settle="run"] (globals.css), so it
// begins at first paint, not at hydration. A small script right after the h1
// (settleScript) measures the ink and sets --settle-from and the attribute
// before that paint; settleStartScale is the same rule in TypeScript (the
// lab's replay uses it, and a test holds the script to it).

export type SettleInput = {
  requested: number; // the start scale asked for (the lab's knob)
  reachPx: number; // the heading's ink, from the h1's left edge to its widest line's right end
  leftPx: number; // the h1's left edge in the viewport
  viewportWidth: number;
  marginPx: number; // kept clear of the viewport's right edge
};

export function settleStartScale({ requested, reachPx, leftPx, viewportWidth, marginPx }: SettleInput): number {
  if (!(reachPx > 0)) return 1;
  return Math.max(1, Math.min(requested, (viewportWidth - marginPx - leftPx) / reachPx));
}

// The script that goes right after the h1 in the page: only while the deal is
// pending (the head's init script set it; reduced motion never does), so a
// reduced-motion load, a return to the home by client navigation and a page
// without JS all keep the heading still at 1x.
export function settleScript(): string {
  const { startScale, marginPx } = COIL.deal.settle;
  return (
    `(function(){var h=document.getElementById(${JSON.stringify(INTRO_HEADING_ID)});` +
    `var d=document.documentElement;if(!h||d.getAttribute("data-deal")!=="pending")return;` +
    `var r=document.createRange();r.selectNodeContents(h);` +
    `var l=h.getBoundingClientRect().left,w=r.getBoundingClientRect().right-l;` +
    `var s=w>0?Math.max(1,Math.min(${startScale},(d.clientWidth-${marginPx}-l)/w)):1;` +
    `h.style.setProperty("--settle-from",s.toFixed(3));h.setAttribute("data-settle","run");})();`
  );
}
