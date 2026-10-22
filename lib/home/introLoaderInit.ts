import { FAST_START_THRESHOLD_FRAC } from "@/lib/home/recovery";
import { HERO_LAB_KEY } from "@/lib/home/introLabKey";
import { HOME_SCROLL_KEY } from "@/lib/scroll";

// The loader's head script, in the manner of the deal's (lib/home/dealInit.ts):
// it runs before the first paint and arms the loader (<html data-intro-loader="on">,
// which app/globals.css reads: the loader shows over the page and the heading
// waits under it). It arms nothing for reduced motion, for any page but the
// home, for a deep load (a section hash, or a saved position past half a
// viewport: the same fast start as lib/home/recovery.ts), and, in development
// only, when the lab has the loader off. Without JavaScript it never runs, so
// the heading is simply there. If the page's own script never takes over (a
// failed hydration) a CSS animation in globals.css lifts everything after nine
// seconds. The scroll key is lib/scroll.ts's saved position.

export function introLoaderInitScript(dev: boolean = process.env.NODE_ENV !== "production"): string {
  const lab = dev ? `var l=JSON.parse(localStorage.getItem(${JSON.stringify(HERO_LAB_KEY)})||"{}");if(l.loaderOn===false)return;` : "";
  return (
    `(function(){try{` +
    `if(location.pathname!=="/")return;` +
    `if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
    `var h=location.hash;if(h.length>1&&h!=="#main")return;` +
    `var y=Number(sessionStorage.getItem(${JSON.stringify(HOME_SCROLL_KEY)}));if(y>window.innerHeight*${FAST_START_THRESHOLD_FRAC})return;` +
    lab +
    `document.documentElement.setAttribute("data-intro-loader","on");` +
    `}catch(x){}})();`
  );
}
