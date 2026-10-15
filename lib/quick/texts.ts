import { quickClosing, quickCopy, quickYears } from "@/lib/content/quick";
import type { YearLine } from "./years";

// The words the lab lets me edit in place: the intro, each year's
// sentence and the closing line. The page renders the content's own; the lab
// passes its edits. Pure.

export interface QuickTexts {
  intro: string;
  years: Record<string, string>;
  closing: string;
}

export const DEFAULT_TEXTS: QuickTexts = {
  intro: quickCopy.intro,
  years: Object.fromEntries(quickYears.map(({ year, line }) => [year, line])),
  closing: quickClosing.line,
};

const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

export function parseTexts(stored: unknown): QuickTexts {
  if (!stored || typeof stored !== "object") return DEFAULT_TEXTS;
  const raw = stored as Partial<Record<keyof QuickTexts, unknown>>;
  const years = raw.years && typeof raw.years === "object" ? (raw.years as Record<string, unknown>) : {};
  return {
    intro: text(raw.intro, DEFAULT_TEXTS.intro),
    years: Object.fromEntries(quickYears.map(({ year }) => [year, text(years[year], DEFAULT_TEXTS.years[year])])),
    closing: text(raw.closing, DEFAULT_TEXTS.closing),
  };
}

export const yearLines = (texts: QuickTexts): YearLine[] => quickYears.map(({ year }) => ({ year, line: texts.years[year] ?? "" }));

export function sameTexts(a: QuickTexts, b: QuickTexts): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
