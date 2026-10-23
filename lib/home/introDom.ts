import { COIL } from "@/lib/coil/constants";
import { lockupVars } from "@/lib/home/lockup";
import { staggerPlan, type PhoneBlock2, type TopLayout } from "@/lib/home/storyLayout";

// Page 1's layout knobs as DOM: the attributes and custom properties the first
// screen, the about section and their blocks carry, from one pure function. The
// server renders it with the defaults (so the first paint never waits on a
// knob), and the dev-only lab bridge (components/home/IntroLabBridge.tsx)
// writes it again when a knob moves; app/globals.css does the rest.

export type DomProps = { attrs: Record<string, string>; vars: Record<string, string> };

export type DomKnobs = {
  topLayout: TopLayout;
  phoneBlock2: PhoneBlock2;
  nameVwDesktop: number;
  nameVwPhone: number;
  bandDesktopPx: number;
  bandPhonePx: number;
  staggerOffset: number;
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
  firstScreen: DomProps;
  about: DomProps;
  // One entry per block of a section (by its position in the section), the stagger.
  firstBlocks: DomProps[];
  aboutBlocks: DomProps[];
};

function blockProps(side: "left" | "right", shift: number): DomProps {
  return { attrs: { "data-side": side }, vars: { "--shift": String(shift) } };
}

export function introDomPlan(knobs: DomKnobs): IntroDomPlan {
  const stagger = staggerPlan(2, knobs.staggerOffset);
  const shared = { "--story-gap": `${knobs.staggerGapRem}rem` };
  return {
    firstScreen: {
      attrs: { "data-top-layout": knobs.topLayout, "data-phone-block2": knobs.phoneBlock2 },
      vars: {
        ...lockupVars(),
        ...shared,
        "--lk-d": nameSizeCss(knobs.nameVwDesktop),
        "--lk-p": nameSizeCss(knobs.nameVwPhone),
        "--band-d": `${knobs.bandDesktopPx}px`,
        "--band-p": `${knobs.bandPhonePx}px`,
        "--ribbon-d": `${knobs.ribbonDesktopPx ?? COIL.deal.ribbon.cardHeightPx}px`,
        "--ribbon-p": `${knobs.ribbonPhonePx ?? COIL.deal.ribbon.cardHeightPhonePx}px`,
      },
    },
    about: { attrs: { "data-phone-block2": knobs.phoneBlock2 }, vars: shared },
    firstBlocks: stagger.map((step) => blockProps(step.side, step.shift)),
    aboutBlocks: stagger.map((step) => blockProps(step.side, step.shift)),
  };
}
