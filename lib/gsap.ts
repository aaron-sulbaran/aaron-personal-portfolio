// Canonical GSAP entry point. Import gsap, ScrollTrigger, Observer, and
// useGSAP from here so plugin registration happens exactly once and only in
// the browser. ScrollTrigger and useGSAP are client-only; the window guard
// keeps SSR safe. ScrollTrigger drives the back half's scroll effects: the
// band's dock line (useBandPassed), the read-along and Up to now; Observer
// is the Coil's touch drag-to-spin on coarse pointers (touch only: the wheel
// is a raw listener in the scene, never Observer). No Draggable or
// InertiaPlugin: the scene coasts the conveyor itself.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/Observer";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, Observer);
}

export { gsap, ScrollTrigger, Observer, useGSAP };
