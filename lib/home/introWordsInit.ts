import { FRESH_LOAD_GUARD } from "@/lib/home/introLoaderInit";
import { HERO_LAB_KEY } from "@/lib/home/introLabKey";

// Page 1's words, head script (slice 5): on a fresh load of the home (the same
// checks as the loader's, lib/home/introLoaderInit.ts FRESH_LOAD_GUARD) it
// runs before the first paint and sets <html data-intro-words="wait">, which
// app/globals.css reads to hold the arriving items (the [data-arrive] ones)
// at their start, transparent and a little low. The page's own script then
// plays them once the loader hands the name over (components/home/IntroArrival.tsx).
// It never runs for reduced motion or any other load, and without JavaScript it
// never runs at all, so the server's HTML is never blank: every word is in it
// and visible. In development only, the lab's arrival switch turns it off.
export function introWordsInitScript(dev: boolean = process.env.NODE_ENV !== "production"): string {
  const lab = dev ? `var l=JSON.parse(localStorage.getItem(${JSON.stringify(HERO_LAB_KEY)})||"{}");if(l.arrivalOn===false)return;` : "";
  return `(function(){try{` + FRESH_LOAD_GUARD + lab + `document.documentElement.setAttribute("data-intro-words","wait");` + `}catch(x){}})();`;
}
