import { COIL } from "@/lib/coil/constants";
import { lockupVars } from "@/lib/home/lockup";
import { BAND_ID, MORE_ID, blockId, staggerPlan, storyItems, type PhoneLayout, type WavePlacement } from "@/lib/home/storyLayout";
import type { NamePosition } from "@/lib/home/nameFlip";

// Page 1's layout knobs as DOM: the attributes and custom properties the
// section and its story items carry, from one pure function. The server
// renders it with the defaults (so the first paint never waits on a knob), and
// the dev-only lab bridge (components/home/IntroLabBridge.tsx) writes it again
// when a knob moves; app/globals.css does the rest.

export type DomProps = { attrs: Record<string, string>; vars: Record<string, string> };

export type DomKnobs = {
  namePosition: NamePosition;
  phoneLayout: PhoneLayout;
  wavePlacement: WavePlacement | number;
  staggerOffset: number;
  staggerGapRem: number;
};

// The name's font size, one clamp (COIL.intro.heading): the lockup's --lk.
export function headingSizeCss(): string {
  const { minRem, vw, maxRem } = COIL.intro.heading;
  return `clamp(${minRem}rem, ${vw}vw, ${maxRem}rem)`;
}

export function introDomPlan(knobs: DomKnobs, blocks: number): { section: DomProps; items: Record<string, DomProps> } {
  const story = storyItems(blocks, { wavePlacement: knobs.wavePlacement, phoneLayout: knobs.phoneLayout });
  const stagger = staggerPlan(blocks, knobs.staggerOffset);
  const items: Record<string, DomProps> = {};
  for (const item of story) {
    const index = Number(item.id.replace("block-", ""));
    const isBlock = item.id !== BAND_ID && item.id !== MORE_ID;
    const step = isBlock ? stagger[index - 1] : undefined;
    items[item.id] = {
      attrs: { "data-collapsible": String(item.collapsible), ...(step ? { "data-side": step.side } : {}) },
      vars: { "--o-d": String(item.order.desktop), "--o-p": String(item.order.phone), ...(step ? { "--shift": String(step.shift) } : {}) },
    };
  }
  return {
    section: {
      attrs: { "data-name-position": knobs.namePosition, "data-phone-layout": knobs.phoneLayout, "data-wave-after": String(knobs.wavePlacement) },
      vars: { ...lockupVars(), "--lk": headingSizeCss(), "--story-gap": `${knobs.staggerGapRem}rem` },
    },
    items,
  };
}

export const blockIds = (blocks: number) => Array.from({ length: blocks }, (_, i) => blockId(i + 1));
