import { COIL } from "@/lib/coil/constants";
import { NAME_POSITIONS, type NamePosition } from "@/lib/home/nameFlip";
import { PHONE_LAYOUTS, WAVE_PLACEMENTS, type PhoneLayout, type WavePlacement } from "@/lib/home/storyLayout";

// Page 1's lab knobs: one flat record, its ranges, the clamp every value passes
// through, and a tiny store the dev-only hero lab (/lab/hero) writes and the
// page's parts read when they use a value. The defaults are COIL.intro;
// production never writes the store, so it reads them as they are. The deal's
// own knobs stay in lib/home/dealKnobs.ts and are not repeated here.

const I = COIL.intro;

export const SHRINK_EASES = ["site", "power2.inOut", "power3.inOut", "expo.inOut"] as const;
export type ShrinkEase = (typeof SHRINK_EASES)[number];

export type IntroKnobs = {
  namePosition: NamePosition; // where the loader's name lands: center, top, topLeft
  loaderOn: boolean;
  loaderMs: number; // the fill's shortest run
  shrinkMs: number; // the name's shrink into the heading
  shrinkEase: ShrinkEase;
  fieldSize: number; // the field behind the name, scaling both radii
  fieldOffsetX: number; // shares of the heading's width
  fieldOffsetY: number; // shares of the heading's height
  orangeAmount: number; // the burnt orange lobe's strength, of its old share (name field and cards field)
  staggerOffset: number; // how far across a right block sits, of the free width
  staggerGapRem: number; // the room between blocks on a desktop
  wavePlacement: WavePlacement; // the band after block 1, 2 or 3
  phoneLayout: PhoneLayout;
};

// The knobs that are a plain number on a slider (the band's place is a choice of 1, 2 or 3).
export type NumericIntroKnob = Exclude<
  {
    [K in keyof IntroKnobs]: IntroKnobs[K] extends number ? K : never;
  }[keyof IntroKnobs],
  "wavePlacement"
>;

export type NumericSpec = { label: string; group: string; min: number; max: number; step: number; unit?: string };

export const INTRO_KNOB_SPEC: Record<NumericIntroKnob, NumericSpec> = {
  loaderMs: { label: "Loader fill, shortest run", group: "Loader", min: 200, max: 2500, step: 50, unit: "ms" },
  shrinkMs: { label: "Shrink duration", group: "Loader", min: 200, max: 2000, step: 50, unit: "ms" },
  fieldSize: { label: "Field size", group: "Field", min: 0.3, max: 2, step: 0.05 },
  fieldOffsetX: { label: "Field offset X", group: "Field", min: -0.6, max: 0.6, step: 0.02 },
  fieldOffsetY: { label: "Field offset Y", group: "Field", min: -0.6, max: 0.6, step: 0.02 },
  orangeAmount: { label: "Orange amount", group: "Field", min: 0, max: 1, step: 0.02 },
  staggerOffset: { label: "Stagger offset", group: "Paragraphs", min: 0, max: 1, step: 0.02 },
  staggerGapRem: { label: "Gap between blocks", group: "Paragraphs", min: 1, max: 14, step: 0.5, unit: "rem" },
};

export const CHOICE_SPEC = {
  namePosition: { label: "Name position", group: "Loader", options: NAME_POSITIONS },
  shrinkEase: { label: "Shrink ease", group: "Loader", options: SHRINK_EASES },
  wavePlacement: { label: "Wave after block", group: "Paragraphs", options: WAVE_PLACEMENTS },
  phoneLayout: { label: "Phone layout", group: "Phone", options: PHONE_LAYOUTS },
} as const;

export const DEFAULT_INTRO_KNOBS: IntroKnobs = {
  namePosition: I.namePosition,
  loaderOn: I.loader.on,
  loaderMs: I.loader.fillMs,
  shrinkMs: I.shrink.ms,
  shrinkEase: I.shrink.ease,
  fieldSize: I.field.size,
  fieldOffsetX: I.field.offsetX,
  fieldOffsetY: I.field.offsetY,
  orangeAmount: I.orangeAmount,
  staggerOffset: I.stagger.offset,
  staggerGapRem: I.stagger.gapRem,
  wavePlacement: I.wavePlacement,
  phoneLayout: I.phoneLayout,
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
  out.namePosition = pick(NAME_POSITIONS, input.namePosition, base.namePosition);
  out.shrinkEase = pick(SHRINK_EASES, input.shrinkEase, base.shrinkEase);
  out.wavePlacement = pick(WAVE_PLACEMENTS, input.wavePlacement, base.wavePlacement);
  out.phoneLayout = pick(PHONE_LAYOUTS, input.phoneLayout, base.phoneLayout);
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
