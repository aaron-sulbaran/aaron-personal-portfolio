"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import {
  A_RISE_FROM,
  A_RISE_TO,
  A_WIPE_RADIUS,
  BOLT_ELBOWS,
  BOLT_REVEAL_WIDTH,
  GROUND_Y,
  IMPACT,
  SPLASH_DOTS,
} from "./geometry";
import { EASES, beats, type EaseKey, type StrikeSettings } from "./settings";

// One GSAP timeline per strike. Only DrawSVG (the reveals) and CustomEase (the
// site's ease and Framer's easeOut, so the card copy opens on the modal's own
// curve) are registered; the site's lib/gsap.ts registers ScrollTrigger and
// Observer, which nothing here needs.
if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin, CustomEase);
  if (!CustomEase.get("site")) CustomEase.create("site", "0.22,1,0.36,1");
  if (!CustomEase.get("framerOut")) CustomEase.create("framerOut", "0,0,0.58,1");
}

export type Reduced = false | "fade" | "static";

const ease = (key: EaseKey) => EASES[key].gsap;

function parts(root: Element) {
  const one = <T extends Element>(part: string) => root.querySelector<T>(`[data-part="${part}"]`);
  return {
    rest: one<HTMLElement>("rest"),
    mark: one<SVGGElement>("anim-mark"),
    fx: one<SVGGElement>("fx"),
    boltReveal: one<SVGPathElement>("bolt-reveal"),
    leader: one<SVGPathElement>("leader"),
    legReveal: one<SVGPathElement>("leg-reveal"),
    barReveal: one<SVGPathElement>("bar-reveal"),
    aWipe: one<SVGCircleElement>("a-wipe"),
    aRise: one<SVGRectElement>("a-rise"),
    aInk: one<SVGGElement>("a-ink"),
    aTint: one<SVGGElement>("a-tint"),
    ring: one<SVGEllipseElement>("ring"),
    dots: Array.from(root.querySelectorAll<SVGCircleElement>('[data-part="dot"]')),
    ripples: Array.from(root.querySelectorAll<SVGLineElement>('[data-part="ripple"]')),
  };
}

// The strike as a paused timeline on the mark rendered by StrikeMark. At its
// end the animated copy hides and the real AsMark (the "rest" layer) shows, so
// the settled frame is the shipped component, not a lookalike.
export function buildStrike(
  root: Element,
  s: StrikeSettings,
  { flash, reduced = false, splashScale = 1 }: { flash?: Element | null; reduced?: Reduced; splashScale?: number } = {},
) {
  const p = parts(root);
  const tl = gsap.timeline({ paused: true });

  if (reduced) {
    gsap.set([p.mark, p.fx], { autoAlpha: 0 });
    if (reduced === "static") gsap.set(p.rest, { autoAlpha: 1 });
    else tl.fromTo(p.rest, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: "none" });
    return tl;
  }

  const b = beats(s);
  const S = s.strikeMs / 1000;
  const A = s.aMs / 1000;
  const splash = s.splashMs / 1000;

  gsap.set(p.rest, { autoAlpha: 0 });
  gsap.set([p.mark, p.fx], { autoAlpha: 1 });

  // The strike.
  if (p.boltReveal) {
    if (s.strike === "fill") {
      tl.fromTo(p.boltReveal, { drawSVG: "0%" }, { drawSVG: "100%", duration: S, ease: ease(s.strikeEase) }, 0);
    } else if (s.strike === "stepped") {
      const [e1, e2] = BOLT_ELBOWS.map((f) => `${(f * 100).toFixed(2)}%`);
      const hold = S * 0.1;
      tl.fromTo(p.boltReveal, { drawSVG: "0%" }, { drawSVG: `0% ${e1}`, duration: S * 0.26, ease: ease(s.strikeEase) }, 0)
        .to(p.boltReveal, { drawSVG: `0% ${e2}`, duration: S * 0.2, ease: ease(s.strikeEase) }, S * 0.26 + hold)
        .to(p.boltReveal, { drawSVG: "0% 100%", duration: S * 0.34, ease: ease(s.strikeEase) }, S * 0.66);
    } else {
      const race = S * 0.62;
      if (p.leader) {
        tl.fromTo(p.leader, { drawSVG: "0%", autoAlpha: 1 }, { drawSVG: "100%", duration: race, ease: ease(s.strikeEase) }, 0);
        tl.to(p.leader, { autoAlpha: 0, duration: (S - race) * 0.8, ease: "power1.in" }, race);
      }
      tl.fromTo(
        p.boltReveal,
        { drawSVG: "100%", attr: { "stroke-width": 0 } },
        { attr: { "stroke-width": BOLT_REVEAL_WIDTH }, duration: S - race, ease: "power2.out" },
        race,
      );
    }
  }

  // The one flash: up in 60ms at the landing, down over 440ms. Never repeats.
  if (flash && s.flash > 0) {
    tl.fromTo(flash, { opacity: 0 }, { opacity: s.flash, duration: 0.06, ease: "power1.out" }, b.impact - 0.02);
    tl.to(flash, { opacity: 0, duration: 0.44, ease: "power2.out" }, b.impact + 0.04);
  } else if (flash) {
    gsap.set(flash, { opacity: 0 });
  }

  // The splash at the point.
  const size = s.splashSize * splashScale;
  if (s.splash === "ring" && p.ring) {
    // Hidden until the landing even when scrubbed backwards: a fromTo would
    // render its from state (a visible small ring) before the impact.
    gsap.set(p.ring, { opacity: 0, attr: { rx: 2, ry: 0.6, "stroke-width": 3.2 } });
    tl.set(p.ring, { opacity: 0.85 }, b.impact);
    tl.to(p.ring, { attr: { rx: 74 * size, ry: 74 * size * 0.26, "stroke-width": 0.5 }, duration: splash, ease: ease(s.splashEase) }, b.impact);
    tl.to(p.ring, { opacity: 0, duration: splash, ease: "power2.in" }, b.impact);
  }
  if (s.splash === "ripple") {
    p.ripples.forEach((line, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const reach = (i < 2 ? 96 : 64) * size;
      const start = b.impact + (i < 2 ? 0 : 0.07);
      const x = IMPACT[0];
      tl.fromTo(line, { attr: { x1: x, x2: x }, opacity: i < 2 ? 0.9 : 0.55 }, { attr: { x2: x + side * reach }, duration: splash, ease: ease(s.splashEase) }, start);
      tl.to(line, { attr: { x1: x + side * reach * 0.97 }, duration: splash, ease: "power3.in" }, start);
      tl.to(line, { opacity: 0, duration: splash * 0.5, ease: "power1.in" }, start + splash * 0.5);
    });
  }
  if (s.splash === "dots") {
    const travel = gsap.parseEase(ease(s.splashEase));
    p.dots.forEach((dot, i) => {
      const d = SPLASH_DOTS[i];
      if (!d) return;
      const state = { t: 0 };
      const render = () => {
        const flight = Math.min(state.t / 0.62, 1);
        const e = travel(flight);
        const x = IMPACT[0] + d.side * d.land * size * e;
        const y = IMPACT[1] + (GROUND_Y - IMPACT[1]) * e - d.lift * size * 4 * e * (1 - e);
        const fade = Math.min(state.t / 0.08, 1) * (state.t < 0.72 ? 1 : 1 - (state.t - 0.72) / 0.28);
        dot.setAttribute("cx", x.toFixed(2));
        dot.setAttribute("cy", y.toFixed(2));
        dot.setAttribute("opacity", fade.toFixed(3));
      };
      render();
      tl.to(state, { t: 1, duration: splash, ease: "none", onUpdate: render }, b.impact + d.delay);
    });
  }

  // The A.
  if (s.a === "trace" && p.legReveal && p.barReveal) {
    tl.fromTo(p.legReveal, { drawSVG: "0%" }, { drawSVG: "100%", duration: A * 0.68, ease: ease(s.aEase) }, b.aStart);
    tl.fromTo(p.barReveal, { drawSVG: "0%" }, { drawSVG: "100%", duration: A * 0.44, ease: ease(s.aEase) }, b.aStart + A * 0.56);
  } else if (s.a === "wipe" && p.aWipe) {
    tl.fromTo(p.aWipe, { attr: { r: 0 } }, { attr: { r: A_WIPE_RADIUS }, duration: A, ease: ease(s.aEase) }, b.aStart);
  } else if (s.a === "rise" && p.aRise) {
    tl.fromTo(p.aRise, { attr: { y: A_RISE_FROM } }, { attr: { y: A_RISE_TO }, duration: A, ease: ease(s.aEase) }, b.aStart);
  } else if (s.a === "scorch" && p.aInk) {
    if (p.aTint) {
      tl.fromTo(p.aTint, { opacity: 0 }, { opacity: 0.9, duration: A * 0.22, ease: "power2.out" }, b.aStart);
      tl.to(p.aTint, { opacity: 0, duration: A * 0.55, ease: "power1.inOut" }, b.aStart + A * 0.45);
    }
    tl.fromTo(p.aInk, { opacity: 0 }, { opacity: 1, duration: A * 0.8, ease: ease(s.aEase) }, b.aStart + A * 0.2);
  }

  // Settle onto the real component.
  tl.set(p.mark, { autoAlpha: 0 }, b.settle);
  tl.set(p.rest, { autoAlpha: 1 }, b.settle);
  if (b.end > b.settle) tl.set({}, {}, b.end);
  return tl;
}
