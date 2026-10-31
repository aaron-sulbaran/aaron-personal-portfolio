// Canonical GSAP entry point. Import gsap, ScrollTrigger, SplitText
// and useGSAP from here so plugin registration happens exactly once and only
// in the browser. ScrollTrigger and useGSAP are client-only; the window guard
// keeps SSR safe. ScrollTrigger drives the back half's scroll effects: the
// band's dock line (useBandPassed) and the sections grammar
// (lib/sections/engine.ts), whose lines SplitText splits; ScrollToPlugin is the "Deal me
// in" button's smooth scroll to the cards (lib/home/dealScroll.ts), which the
// reader's wheel or touch interrupts only where the deal is no cutscene (no
// scene); the cutscene's lock keeps them out. No Observer, Draggable or
// InertiaPlugin: the Coil's wheel and drag are the scene's own pointer and
// wheel listeners (components/coil/scene/input.ts), and it coasts the
// conveyor itself. Every full refresh
// passes through guardRefreshScroll, so a resize never moves the reader.
// CustomEase names the site's ease "site" for the mark card's GSAP open.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";
import { guardRefreshScroll, type RecordedScroll } from "./scrollRefresh";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin, SplitText, CustomEase);
  if (!CustomEase.get("site")) CustomEase.create("site", "0.22,1,0.36,1");
  // Once per page: a dev Fast Refresh re-runs this module, and a second guard
  // would take the first one's auto for the root's own value and keep it.
  const host = window as { __refreshGuard?: true };
  if (!host.__refreshGuard) {
    host.__refreshGuard = true;
    const root = document.documentElement;
    guardRefreshScroll({
      on: (event, callback) => ScrollTrigger.addEventListener(event, callback),
      windowScroll: () => ScrollTrigger.getScrollFunc(window) as ScrollTrigger.ScrollFunc & RecordedScroll,
      root,
      scrollY: () => window.scrollY,
      flushStyle: () => getComputedStyle(root).scrollBehavior,
      nextFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
    });
  }
}

export { gsap, ScrollTrigger, ScrollToPlugin, SplitText, CustomEase, useGSAP };
