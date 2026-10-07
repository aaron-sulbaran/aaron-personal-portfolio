import type { CSSProperties } from "react";

// The sections grammar as plain data: Aaron's pick from the sections lab
// (docs/lab-log-2026-10-05.md, "Aaron's pick, 2026-10-06") and the plan each
// kind of block follows. No DOM and no GSAP, so the server reads the sticky
// values and the tests read the rest; lib/sections/engine.ts turns a plan
// into a timeline. Everything masks in (his ruling), so the lab's rise, blur
// and dim have no reader here.

export type BlockKind = "kicker" | "heading" | "body" | "item" | "links";
export type Split = "lines" | "block";
export type StepTarget = "rule" | "label" | "lines" | "inner" | "hair" | "text" | "rowHair" | "rowInner";

export interface Grammar {
  lag: number; // s: how far every block's scrub trails the real scroll
  lagStep: number; // s: added per rank, so a kicker settles before its heading, a heading before its body
  itemLagStep: number; // s: added per Up to now item, so the items arrive in turn
  spread: number; // 0..1: how much a block's lines and rows overlap as they arrive
  bandStart: number; // viewport %: a block starts when its top reaches this line
  bandEnd: number; // viewport %: and is fully in when its top reaches this one
  follow: number; // viewport %: bodies, items and links start this much after headings
  ease: string; // power3, the one value Aaron is unsure of
  stickyTop: number; // px from the viewport top where a sticky column holds
  stopOffset: number; // px before its section's end where the hold lets go
}

export const GRAMMAR: Readonly<Grammar> = {
  lag: 0.8,
  lagStep: 0.12,
  itemLagStep: 0.06,
  spread: 0.4,
  bandStart: 90,
  bandEnd: 60,
  follow: 6,
  ease: "power3.out",
  stickyTop: 112,
  stopOffset: 120,
};

export const RANK: Readonly<Record<BlockKind, number>> = { kicker: 0, heading: 1, body: 2, item: 2, links: 2 };

export interface Step {
  target: StepTarget;
  from: Readonly<Record<string, number>>;
  at: number; // position in a timeline one unit long
  stagger?: number;
  row?: number;
}

export interface BlockPlan {
  scrub: number;
  ease: string;
  duration: number;
  split: Split | null;
  steps: Step[];
}

export interface PlanInput {
  kind: BlockKind;
  reduce: boolean;
  index?: number;
  split?: Split;
  rows?: number;
}

const MASKED = { yPercent: 110 };
const UNDRAWN = { scaleX: 0 };
const LABEL_AT = 0.45;
const TEXT_AT = 0.35;
const ROW_INNER_AT = 0.25;

export function scrubFor(kind: BlockKind, index = 0, g: Readonly<Grammar> = GRAMMAR): number {
  return g.lag + RANK[kind] * g.lagStep + (kind === "item" ? index * g.itemLagStep : 0);
}

export function bandFor(kind: BlockKind, offset = 0, g: Readonly<Grammar> = GRAMMAR): { start: string; end: string } {
  const shift = kind === "body" || kind === "item" || kind === "links" ? g.follow : 0;
  return { start: `top+=${offset} ${g.bandStart - shift}%`, end: `top+=${offset} ${g.bandEnd - shift}%` };
}

export function lineStagger(g: Readonly<Grammar> = GRAMMAR): number {
  return 0.5 * (1 - g.spread * 0.8);
}

export function planBlock({ kind, reduce, index = 0, split = "lines", rows = 0 }: PlanInput, g: Readonly<Grammar> = GRAMMAR): BlockPlan | null {
  if (reduce) return null;
  const base = { scrub: scrubFor(kind, index, g), ease: g.ease, duration: 1 };
  if (kind === "kicker") {
    return { ...base, split: null, steps: [{ target: "rule", from: UNDRAWN, at: 0 }, { target: "label", from: { opacity: 0, x: -8 }, at: LABEL_AT }] };
  }
  if (kind === "heading" || kind === "body") {
    const step: Step = split === "lines" ? { target: "lines", from: MASKED, at: 0, stagger: lineStagger(g) } : { target: "inner", from: MASKED, at: 0 };
    return { ...base, split, steps: [step] };
  }
  if (kind === "item") {
    return { ...base, split: null, steps: [{ target: "hair", from: UNDRAWN, at: 0 }, { target: "text", from: MASKED, at: TEXT_AT }] };
  }
  const gap = lineStagger(g);
  const steps = Array.from({ length: rows }, (_, row): Step[] => [
    { target: "rowHair", row, from: UNDRAWN, at: row * gap },
    { target: "rowInner", row, from: MASKED, at: row * gap + ROW_INNER_AT },
  ]).flat();
  return { ...base, split: null, steps };
}

export function stickyStyle(g: Readonly<Grammar> = GRAMMAR): CSSProperties {
  return { "--sections-sticky-top": `${g.stickyTop}px`, "--sections-sticky-stop": `${g.stopOffset}px` } as CSSProperties;
}
