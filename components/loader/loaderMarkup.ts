import { FAST_START_THRESHOLD_FRAC } from "@/lib/home/recovery";
import { LOADER } from "@/lib/loader/progress";

// The loader's stylesheet and its pre-paint script, as strings: the overlay
// is armed by the server's HTML and this CSS alone, before any JavaScript.
//
// Geometry is ported from labs/loader-lab.html (mode a): the name's ink fills
// the pane edge to edge inside a 16px gutter, a box one cap height tall whose
// bottom edge is the baseline; the fill is a clipped copy of the name rising
// from the baseline to the cap top with --p. Portrait panes (3:4 and taller)
// rotate the name up the left edge and put the number in the free right
// column. The metrics below are Profa Black's (cap 700 of 1100 units, the cap
// line 0.11364em under a line-height 1 box, "Aaron" 2.76636em of ink); the
// component re-measures them once the face has loaded.
//
// Colors are the theme-fixed --loader-* tokens: the loader is always dark.

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export const LOADER_CSS = `
.coil-loader{position:fixed;inset:0;z-index:60;container-type:size;
  animation:coil-loader-in 180ms ${EASE} ${LOADER.guardMs}ms both,coil-loader-bail 400ms linear 9s forwards}
.coil-loader[data-js]{animation:coil-loader-in 180ms ${EASE} ${LOADER.guardMs}ms both}
.coil-loader[data-state=live]{animation:none;opacity:1;visibility:visible}
.coil-loader[data-state=gone],html[data-coil-loader=skip] .coil-loader{display:none}
@keyframes coil-loader-in{from{opacity:0;visibility:hidden}to{opacity:1;visibility:visible}}
@keyframes coil-loader-bail{to{opacity:0;visibility:hidden}}
.coil-loader__bg{position:absolute;inset:0;background:var(--loader-bg)}
.coil-loader__pane{position:absolute;inset:0;
  --gut:16px;--inkW:2.76636;--inkL:0;--capR:.63636;--capTop:.11364;--pad:.06;--p:0;
  --fs:calc((100cqw - 2 * var(--gut)) / var(--inkW));
  --cap:calc(var(--fs) * var(--capR));
  --W:calc(var(--fs) * var(--inkW))}
.coil-loader__name{position:absolute;left:var(--gut);top:calc(50cqh - var(--cap) / 2);
  width:calc(var(--inkW) * 1em);height:calc(var(--capR) * 1em);font-size:var(--fs);
  font-family:var(--font-display),sans-serif;font-weight:900;font-synthesis:none;font-kerning:normal;
  line-height:1;white-space:nowrap;transform-origin:50% 50%}
.coil-loader__glyph{position:absolute;display:block;left:calc(var(--inkL) * 1em);top:calc(var(--capTop) * -1em);line-height:1}
.coil-loader__base{color:var(--loader-name)}
.coil-loader__fill{position:absolute;inset:calc(var(--pad) * -1em);
  clip-path:inset(calc((var(--pad) + (1 - var(--p)) * var(--capR)) * 1em) 0 0 0)}
.coil-loader__fill .coil-loader__glyph{color:var(--loader-fill);
  left:calc((var(--pad) + var(--inkL)) * 1em);top:calc((var(--pad) - var(--capTop)) * 1em)}
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
  .coil-loader__name{left:calc(var(--gut) + var(--cap) / 2 - var(--W) / 2);transform:rotate(-90deg)}
  .coil-loader__fill{clip-path:inset(0 calc((var(--pad) + (1 - var(--p)) * var(--inkW)) * 1em) 0 0)}
  .coil-loader__count{left:calc(var(--gut) + var(--cap) + (100cqw - var(--gut) - var(--cap)) / 2)}
}
@media (prefers-reduced-motion: reduce){.coil-loader__pane{--p:1!important}}
`;

// Hides the loader before first paint on a deep load (a section hash, or a
// saved position past half a viewport: the fast start, same rule as
// lib/home/recovery.ts), so a slow connection never flashes it over #about.
// The key is lib/scroll.ts's saved scroll position.
export const LOADER_SKIP_SCRIPT = `(function(){try{var h=location.hash,d=h.length>1&&h!=="#main";if(!d){var y=Number(sessionStorage.getItem("aps:home-scroll-y"));d=y>innerHeight*${FAST_START_THRESHOLD_FRAC}}if(d)document.documentElement.setAttribute("data-coil-loader","skip")}catch(e){}})();`;

// No JavaScript, no loader: nothing would ever take it down.
export const LOADER_NOSCRIPT = "<style>.coil-loader{display:none}</style>";
