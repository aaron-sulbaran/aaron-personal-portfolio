// Canonical GSAP entry point. Import gsap, ScrollTrigger, and useGSAP from
// here so plugin registration happens exactly once and only in the browser.
// ScrollTrigger and useGSAP are client-only; the window guard keeps SSR safe.
// ScrollTrigger pins the desktop hero; the ring-arc carousel scrubs from its
// native scroll progress (no Observer: the free-scroll model never captures
// input). The mobile coverflow carousel uses a custom touch handler (no
// Draggable/InertiaPlugin), so those plugins are not registered either.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export { gsap, ScrollTrigger, useGSAP };
