import { COIL } from "@/lib/coil/constants";
import { lockupVars } from "@/lib/home/lockup";

// Page 1's layout knobs as DOM: the custom properties the page carries, from
// one pure function. The server renders it with the defaults (so the first
// paint never waits on a knob), and the dev-only lab bridge
// (components/home/IntroLabBridge.tsx) writes it again when a knob moves;
// app/globals.css does the rest. Where each block sits is the story's fixed
// stagger (lib/home/storyLayout.ts), not a knob.

export type DomProps = { attrs: Record<string, string>; vars: Record<string, string> };

export type DomKnobs = {
  nameVwDesktop: number;
  nameVwPhone: number;
  bandDesktopPx: number;
  bandPhonePx: number;
  staggerGapRem: number;
  // The ribbon's card height (the deal lab's knobs; the constants' when absent):
  // the room the page leaves for it.
  ribbonDesktopPx?: number;
  ribbonPhonePx?: number;
};

// The name's font size on a desktop and on a phone: a share of the viewport's
// width, held between COIL.intro.name's rem bounds. The lockup's --lk.
export function nameSizeCss(vw: number): string {
  const { minRem, maxRem } = COIL.intro.name;
  return `clamp(${minRem}rem, ${vw}vw, ${maxRem}rem)`;
}

export type IntroDomPlan = {
  page: DomProps;
};

export function introDomPlan(knobs: DomKnobs): IntroDomPlan {
  return {
    page: {
      attrs: {},
      vars: {
        ...lockupVars(),
        "--story-gap": `${knobs.staggerGapRem}rem`,
        "--lk-d": nameSizeCss(knobs.nameVwDesktop),
        "--lk-p": nameSizeCss(knobs.nameVwPhone),
        "--band-d": `${knobs.bandDesktopPx}px`,
        "--band-p": `${knobs.bandPhonePx}px`,
        "--ribbon-d": `${knobs.ribbonDesktopPx ?? COIL.deal.ribbon.cardHeightPx}px`,
        "--ribbon-p": `${knobs.ribbonPhonePx ?? COIL.deal.ribbon.cardHeightPhonePx}px`,
        "--name-reach": String(COIL.intro.nameCanvas.reach),
      },
    },
  };
}
