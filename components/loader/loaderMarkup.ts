import { COIL } from "@/lib/coil/constants";
import { FAST_START_THRESHOLD_FRAC } from "@/lib/home/recovery";
import { lockupVarDefaults, restLockupCss } from "@/lib/loader/lockup";
import { LOADER } from "@/lib/loader/progress";
import { HERO_HEADING_ID } from "@/components/home/HeroText";

// The loader's stylesheet and its pre-paint script, as strings: the overlay
// is armed by the server's HTML and this CSS alone, before any JavaScript.
//
// Two layers. The resting lockup ("Hi, I'm" over "Aaron" in the composite's
// ink, exactly where the canvas draws them: lib/loader/lockup.ts) shows from
// first paint, and the fallback h1 hides under it, so a load the scene takes
// over never shows the h1. The pane (the dark ground, the big name, the
// number) fades in over it only if the load outlives the 250ms guard.
// With no scene the hero still waits at opacity 0 under the resting lockup and fades in under it (data-dissolve); the lockup then leaves in one frame.
//
// The root is the hero's box at the top of the document (the hero is the
// first thing in #main, at least 100svh tall), not the viewport: the resting lockup
// scrolls with the hero by itself, before any JavaScript and on the
// compositor, so a page moved under the hold (a script, an anchor jump,
// find-in-page; the entrance lock stops only wheels and swipes) never leaves
// it floating over the book. The pane and its ground are fixed: a slow load
// covers the viewport wherever the page is.
//
// The pane's geometry is ported from labs/loader-lab.html (mode a): the
// name's ink fills the pane edge to edge inside a 16px gutter, a box one cap
// height tall whose bottom edge is the baseline; the fill is a clipped copy
// of the name rising from the baseline to the cap top with --p. The greeting
// rides the box above the cap line in the canvas lockup's proportions.
// Portrait panes (3:4 and taller) rotate the lockup up the left edge and put
// the number in the free right column. The face's metrics live on the root
// (Profa Black's by default; the component re-measures them once the face
// has loaded).
//
// The pane's colors are the theme-fixed --loader-* tokens: it is always dark.
// The resting lockup wears the theme's --name-* tokens, as the canvas does.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const L = COIL.lockup;
// The h1 hides under the resting lockup at most until the bail, should
// JavaScript never arrive to take the loader down.
const BAIL_MS = 9400;

// The still notice waits for the loader to go (and leaves the tab order meanwhile).
//
// Reduced motion never runs a scene: the h1 waits for the decoded still, at most a hand-off's give-up.
// Its duration is !important over globals.css's reduced-motion zeroing (the
// noscript rule's animation:none still wins on the name).
export const LOADER_CSS = `
.coil-loader{position:absolute;top:0;left:0;right:0;height:100vh;height:100svh;z-index:60;container-type:size;pointer-events:none;${lockupVarDefaults()};
  animation:coil-loader-bail 400ms linear 9s forwards}
.coil-loader[data-js]{animation:none}
.coil-loader__bg,.coil-loader__pane{animation:coil-loader-in 180ms ${EASE} ${LOADER.guardMs}ms both}
.coil-loader:not([data-state=live]) .coil-loader__bg{pointer-events:auto}
.coil-loader[data-state=live] :is(.coil-loader__bg,.coil-loader__pane){animation:none;opacity:1;visibility:visible}
.coil-loader[data-state=rest] :is(.coil-loader__bg,.coil-loader__pane),.coil-loader[data-rest=off] .coil-loader__rest{display:none}
.coil-loader[data-state=gone],html[data-coil-loader=skip] .coil-loader{display:none}
html:not([data-coil-loader=skip]):has(.coil-loader:not([data-state=gone])) [data-still-notice]{visibility:hidden}
@keyframes coil-loader-in{from{opacity:0;visibility:hidden}to{opacity:1;visibility:visible}}
@keyframes coil-loader-bail{to{opacity:0;visibility:hidden}}
@keyframes coil-loader-h1{from,to{opacity:0}}
@media (prefers-reduced-motion: no-preference){
  html:not([data-coil-loader=skip]):has(.coil-loader:not([data-state=gone]):not([data-rest=off])) #${HERO_HEADING_ID}{animation:coil-loader-h1 ${BAIL_MS}ms linear}
  html:not([data-coil-loader=skip]):has(.coil-loader:not([data-state=gone]):not([data-rest=off]):not([data-dissolve])) [data-hero-still]{opacity:0}
  [data-hero-still]{transition:opacity ${LOADER.stillFadeMs}ms linear}
}
${restLockupCss()}
.coil-loader__bg{position:fixed;inset:0;background:var(--loader-bg)}
.coil-loader__pane{position:fixed;inset:0;
  --gut:16px;--pad:.06;--p:0;
  --fs:calc((100cqw - 2 * var(--gut)) / var(--inkW));
  --cap:calc(var(--fs) * var(--capR));
  --W:calc(var(--fs) * var(--inkW));
  --gEm:calc(${L.greetingCap} * var(--capR) / var(--capH));
  --gB:calc(var(--fs) * var(--gEm) * (var(--gAsc) * ${1 + L.greetingGap} + var(--gDesc)))}
.coil-loader__name{position:absolute;left:var(--gut);top:calc(50cqh - var(--cap) / 2);
  width:calc(var(--inkW) * 1em);height:calc(var(--capR) * 1em);font-size:var(--fs);
  font-family:var(--font-display),sans-serif;font-weight:900;font-synthesis:none;font-kerning:normal;
  line-height:1;white-space:nowrap;transform-origin:50% 50%}
.coil-loader__glyph{position:absolute;display:block;left:calc(var(--inkL) * 1em);top:calc((var(--capR) - var(--base)) * 1em);line-height:1}
.coil-loader__base{color:var(--loader-name)}
.coil-loader__greet{position:absolute;display:block;line-height:1;font-size:calc(var(--fs) * var(--gEm));
  left:calc(var(--fs) * (${L.greetingShift} + var(--gEm) * var(--gInkL)));
  top:calc(var(--fs) * var(--gEm) * -1 * (var(--gDesc) + ${L.greetingGap} * var(--gAsc) + var(--base)));
  color:var(--loader-name);transition:color ${LOADER.greetingAccentMs}ms linear}
.coil-loader__fill{position:absolute;inset:calc(var(--pad) * -1em);
  clip-path:inset(calc((var(--pad) + (1 - var(--p)) * var(--capR)) * 1em) 0 0 0)}
.coil-loader__fill .coil-loader__glyph{color:var(--loader-fill);
  left:calc((var(--pad) + var(--inkL)) * 1em);top:calc((var(--pad) + var(--capR) - var(--base)) * 1em)}
.coil-loader__count{position:absolute;top:22px;left:50%;transform:translateX(-50%);
  font:500 12px/1 var(--font-sans),system-ui,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.01em;
  color:var(--loader-muted);white-space:nowrap;
  animation:coil-loader-count 180ms ${EASE} ${LOADER.numberAfterMs}ms both}
.coil-loader__count[data-exit]{animation:none}
.coil-loader__count[data-hidden]{animation:none;visibility:hidden}
@keyframes coil-loader-count{from{opacity:0;visibility:hidden}to{opacity:1;visibility:visible}}
.coil-loader__num{display:inline-block;min-width:3ch;text-align:right}
@container (max-aspect-ratio: 3/4){
  .coil-loader__pane{--fs:calc((100cqh - 2 * var(--gut)) / var(--inkW))}
  .coil-loader__name{left:calc(var(--gut) + var(--gB) + var(--cap) / 2 - var(--W) / 2);transform:rotate(-90deg)}
  .coil-loader__fill{clip-path:inset(0 calc((var(--pad) + (1 - var(--p)) * var(--inkW)) * 1em) 0 0)}
  .coil-loader__count{left:calc(var(--gut) + var(--gB) + var(--cap) + (100cqw - var(--gut) - var(--gB) - var(--cap)) / 2)}
}
.coil-loader[data-full] :is(.coil-loader__base,.coil-loader__greet){color:var(--loader-fill)}
@media (prefers-reduced-motion: reduce){
  html:not(:has([data-still-ready])) #${HERO_HEADING_ID}{animation:coil-loader-h1 ${LOADER.handoffGiveUpMs}ms linear;animation-duration:${LOADER.handoffGiveUpMs}ms!important}
  .coil-loader__pane{--p:1!important}
  :is(.coil-loader__base,.coil-loader__greet){color:var(--loader-fill)}
  .coil-loader__rest{display:none}
}
`;

// Hides the loader before first paint on a deep load (a section hash, or a
// saved position past half a viewport: the fast start, same rule as
// lib/home/recovery.ts), so a slow connection never flashes it over #about.
// The key is lib/scroll.ts's saved scroll position.
export const LOADER_SKIP_SCRIPT = `(function(){try{var h=location.hash,d=h.length>1&&h!=="#main";if(!d){var y=Number(sessionStorage.getItem("aps:home-scroll-y"));d=y>innerHeight*${FAST_START_THRESHOLD_FRAC}}if(d)document.documentElement.setAttribute("data-coil-loader","skip")}catch(e){}})();`;

// No JavaScript, no loader: nothing would ever take it down, and the h1
// carries the hero.
export const LOADER_NOSCRIPT = `<style>.coil-loader{display:none}#${HERO_HEADING_ID}{animation:none!important}</style>`;
