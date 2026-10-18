// The quick page's own GSAP entry: the site's gsap (lib/gsap.ts, which registers
// ScrollTrigger and the "site" ease) plus DrawSVG, MotionPath and ScrollTo,
// registered only here so the home page's bundle never carries them.
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { gsap, ScrollTrigger } from "@/lib/gsap";

if (typeof window !== "undefined") gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin, ScrollToPlugin);

export { gsap, ScrollTrigger, DrawSVGPlugin, MotionPathPlugin, ScrollToPlugin };
