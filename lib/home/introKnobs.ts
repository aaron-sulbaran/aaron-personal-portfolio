import { COIL } from "@/lib/coil/constants";
import { NAME_INK_MODES, type NameInkMode } from "@/lib/coil/nameInk";

// Page 1's lab knobs: one flat record, its ranges, the clamp every value passes
// through, and a tiny store the dev-only hero lab (/lab/hero) writes and the
// page's parts read when they use a value. The defaults are COIL.intro;
// production never writes the store, so it reads them as they are. The deal's
// own knobs stay in lib/home/dealKnobs.ts and are not repeated here.

const I = COIL.intro;

export const SHRINK_EASES = ["site", "power2.inOut", "power3.inOut", "expo.inOut"] as const;
export type ShrinkEase = (typeof SHRINK_EASES)[number];

export type IntroKnobs = {
  loaderOn: boolean;
  loaderMs: number; // the fill's shortest run
  shrinkMs: number; // the name's shrink onto its place
  shrinkEase: ShrinkEase;
  nameInk: NameInkMode; // the name's ink: production's pale one, or the stronger (3:1 or better)
  nameVwDesktop: number; // the name's font size, share of the viewport's width, on a desktop
  nameVwPhone: number; // and on a phone
  bandDesktopPx: number; // the soundtrack band's height between the blocks
  bandPhonePx: number;
  orangeAmount: number; // the burnt orange lobe's strength, of its old share (the name's field and the cards field)
  staggerGapRem: number; // the room between blocks on a desktop
  arrivalOn: boolean; // page 1's words arrive on load (off: they are simply there)
  arrivalTotalMs: number; // from the loader's handoff to the last item done
  arrivalStaggerMs: number; // between one item and the next
  arrivalRisePx: number; // how far each item rises as it fades in
};

// The knobs that are a plain number on a slider.
export type NumericIntroKnob = {
  [K in keyof IntroKnobs]: IntroKnobs[K] extends number ? K : never;
}[keyof IntroKnobs];

export type NumericSpec = { label: string; group: string; min: number; max: number; step: number; unit?: string };

export const INTRO_KNOB_SPEC: Record<NumericIntroKnob, NumericSpec> = {
  loaderMs: { label: "Loader fill, shortest run", group: "Loader", min: 200, max: 2500, step: 50, unit: "ms" },
  shrinkMs: { label: "Shrink duration", group: "Loader", min: 200, max: 2000, step: 50, unit: "ms" },
  nameVwDesktop: { label: "Name size, desktop", group: "Name", min: 4, max: 24, step: 0.5, unit: "vw" },
  nameVwPhone: { label: "Name size, phone", group: "Name", min: 8, max: 40, step: 0.5, unit: "vw" },
  bandDesktopPx: { label: "Wave height, desktop", group: "Wave", min: 80, max: 340, step: 4, unit: "px" },
  bandPhonePx: { label: "Wave height, phone", group: "Wave", min: 60, max: 260, step: 4, unit: "px" },
  orangeAmount: { label: "Orange amount", group: "Field", min: 0, max: 1, step: 0.02 },
  staggerGapRem: { label: "Gap between blocks", group: "Paragraphs", min: 0.5, max: 14, step: 0.5, unit: "rem" },
  arrivalTotalMs: { label: "Arrival, total", group: "Arrival", min: 600, max: 3500, step: 50, unit: "ms" },
  arrivalStaggerMs: { label: "Arrival, stagger", group: "Arrival", min: 0, max: 400, step: 10, unit: "ms" },
  arrivalRisePx: { label: "Arrival, rise", group: "Arrival", min: 0, max: 48, step: 1, unit: "px" },
};

export const CHOICE_SPEC = {
  shrinkEase: { label: "Shrink ease", group: "Loader", options: SHRINK_EASES },
  nameInk: { label: "Name ink", group: "Name", options: NAME_INK_MODES },
} as const;

export const DEFAULT_INTRO_KNOBS: IntroKnobs = {
  loaderOn: I.loader.on,
  loaderMs: I.loader.fillMs,
  shrinkMs: I.shrink.ms,
  shrinkEase: I.shrink.ease,
  nameInk: I.nameInk,
  nameVwDesktop: I.name.vwDesktop,
  nameVwPhone: I.name.vwPhone,
  bandDesktopPx: I.band.desktopPx,
  bandPhonePx: I.band.phonePx,
  orangeAmount: I.orangeAmount,
  staggerGapRem: I.stagger.gapRem,
  arrivalOn: I.arrival.on,
  arrivalTotalMs: I.arrival.totalMs,
  arrivalStaggerMs: I.arrival.staggerMs,
  arrivalRisePx: I.arrival.risePx,
};

const NUMERIC = Object.keys(INTRO_KNOB_SPEC) as NumericIntroKnob[];

// Every knob held to its range or its list. A value of the wrong kind falls
// back to the base, and keys that are not knobs are dropped, so a stale or
// hand-edited saved record cannot break the page.
export function clampIntroKnobs(input: Partial<Record<string, unknown>>, base: IntroKnobs = DEFAULT_INTRO_KNOBS): IntroKnobs {
  const out: IntroKnobs = { ...base };
  for (const key of NUMERIC) {
    const value = input[key];
    const spec = INTRO_KNOB_SPEC[key];
    out[key] = typeof value === "number" && Number.isFinite(value) ? Math.min(spec.max, Math.max(spec.min, value)) : base[key];
  }
  out.loaderOn = typeof input.loaderOn === "boolean" ? input.loaderOn : base.loaderOn;
  out.arrivalOn = typeof input.arrivalOn === "boolean" ? input.arrivalOn : base.arrivalOn;
  out.shrinkEase = pick(SHRINK_EASES, input.shrinkEase, base.shrinkEase);
  out.nameInk = pick(NAME_INK_MODES, input.nameInk, base.nameInk);
  return out;
}

function pick<T extends string | number>(list: readonly T[], value: unknown, fallback: T): T {
  return list.find((item) => item === value) ?? fallback;
}

// The record the lab saves, and the JSON "Copy values" hands over.
export function introValues(knobs: IntroKnobs): IntroKnobs {
  return { ...knobs };
}

export function parseStoredIntroKnobs(raw: string | null): Partial<IntroKnobs> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Partial<IntroKnobs>) : null;
  } catch {
    return null;
  }
}

// ---- the store ----

let current: IntroKnobs = DEFAULT_INTRO_KNOBS;
const listeners = new Set<() => void>();

export function getIntroKnobs(): IntroKnobs {
  return current;
}

// Dev only: the lab and its frames are the writers, and none is built in production.
export function setIntroKnobs(patch: Partial<IntroKnobs>) {
  if (process.env.NODE_ENV === "production") return;
  current = clampIntroKnobs({ ...current, ...patch }, current);
  listeners.forEach((listener) => listener());
}

export function resetIntroKnobs() {
  if (process.env.NODE_ENV === "production") return;
  current = DEFAULT_INTRO_KNOBS;
  listeners.forEach((listener) => listener());
}

export function subscribeIntroKnobs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
