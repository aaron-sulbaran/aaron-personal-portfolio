import type { CelSettings } from "@/lib/mark/cel";

// Aaron's pick from the mark lab (docs/lab-log-2026-10-05.md, "Mark lab",
// 2026-10-06), the only place these numbers live. His JSON's round-one values
// (stepped 220ms, ring splash, shockwave wipe, the 0.06 flash) drive the
// geometric strikes the cel strike replaced; the lab's cel path never reads
// them, so they are not here.
export type HoldConfig = { holdMs: number; drainMs: number; minFill: number; tasteMs: number; tasteRiseMs: number; dischargeMs: number };

export const HOLD: HoldConfig = { holdMs: 650, drainMs: 260, minFill: 0.3, tasteMs: 200, tasteRiseMs: 90, dischargeMs: 140 };

export const CEL_PICK: CelSettings = {
  celFps: 24,
  celFpp: 2,
  celPoses: 3,
  celBlanks: true,
  celBoil: 0.6,
  celArcs: true,
  celGlowRadius: 5,
  celGlow: 0.9,
  celPoolSize: 1,
  celPool: 0.8,
  celImpact: "crown",
  celShards: 16,
  celDrift: 1,
  celFlash: 0.14,
  celReach: 1,
  celAfterglowMs: 420,
  celTone: "night",
  celA: "flash",
  celSeed: 7,
};

export const MARK = { growPx: 10, growMs: 280, ease: "cubic-bezier(0.22, 1, 0.36, 1)", cardMarkPx: 168 } as const;

export const RING = { padPx: 14, baseStrokePx: 1.5, arcStrokePx: 4, tint: 0.16 } as const;

// Strike first: the bolt lands 40ms after the open, the surface forms 120ms
// before the mark settles, the words rise 100ms after it.
export const CARD = { strikeLeadS: 0.04, formEarlyS: 0.12, formS: 0.42, textDelayS: 0.1, textStaggerS: 0.05 } as const;
