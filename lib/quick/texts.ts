import { quickCopy, quickYears } from "@/lib/content/quick";
import { DEFAULT_CUSTOM_NEXT } from "./next";
import type { YearLine } from "./years";

// The words the lab lets me edit in place: the intro, each year's sentence,
// the custom what's-next lines and the two "find the MVP again" tips. The page
// renders the content's own; the lab passes its edits. Pure.

export interface QuickTexts {
  intro: string;
  years: Record<string, string>;
  customShort: string;
  customFull: string;
  tipToast: string;
  tipBack: string;
}

export const DEFAULT_TEXTS: QuickTexts = {
  intro: quickCopy.intro,
  years: Object.fromEntries(quickYears.map(({ year, line }) => [year, line])),
  customShort: DEFAULT_CUSTOM_NEXT.customShort,
  customFull: DEFAULT_CUSTOM_NEXT.customFull,
  tipToast: quickCopy.tips.toast,
  tipBack: quickCopy.tips.back,
};

const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

export function parseTexts(stored: unknown): QuickTexts {
  if (!stored || typeof stored !== "object") return DEFAULT_TEXTS;
  const raw = stored as Partial<Record<keyof QuickTexts, unknown>>;
  const years = raw.years && typeof raw.years === "object" ? (raw.years as Record<string, unknown>) : {};
  return {
    intro: text(raw.intro, DEFAULT_TEXTS.intro),
    years: Object.fromEntries(quickYears.map(({ year }) => [year, text(years[year], DEFAULT_TEXTS.years[year])])),
    customShort: text(raw.customShort, DEFAULT_TEXTS.customShort),
    customFull: text(raw.customFull, DEFAULT_TEXTS.customFull),
    tipToast: text(raw.tipToast, DEFAULT_TEXTS.tipToast),
    tipBack: text(raw.tipBack, DEFAULT_TEXTS.tipBack),
  };
}

export const yearLines = (texts: QuickTexts): YearLine[] => quickYears.map(({ year }) => ({ year, line: texts.years[year] ?? "" }));

export function sameTexts(a: QuickTexts, b: QuickTexts): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
