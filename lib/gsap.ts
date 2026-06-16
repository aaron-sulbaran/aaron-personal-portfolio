// Canonical GSAP entry point. Import gsap, ScrollTrigger, and useGSAP from
// here so plugin registration happens exactly once and only in the browser.
// ScrollTrigger and useGSAP are client-only; the window guard keeps SSR safe.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export { gsap, ScrollTrigger, useGSAP };
