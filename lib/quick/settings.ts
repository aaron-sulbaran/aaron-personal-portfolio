import type { InviteMode } from "./invite";
import { SPEED_RANGE, TITLE_UNFOLD } from "./motion";
import { DEFAULT_TEXTS, parseTexts, sameTexts, type QuickTexts } from "./texts";

// The quick lab's settings, stored per browser. Bump the key when a field's meaning changes.

export type QuickVariant = "rail" | "trip" | "road";

export const QUICK_VARIANTS: readonly QuickVariant[] = ["rail", "trip", "road"];

export type TitleMode = "unfold" | "spelled";

export const TITLE_MODES: readonly TitleMode[] = ["unfold", "spelled"];

export interface QuickLabSettings {
  variant: QuickVariant;
  titleMode: TitleMode;
  unfoldDelayMs: number;
  unfoldStaggerMs: number;
  speed: number;
  reduced: boolean;
  texts: QuickTexts;
}

export const SETTINGS_KEY = "lab-quick-v5";

export const DEFAULT_SETTINGS: QuickLabSettings = { variant: "rail", titleMode: "unfold", unfoldDelayMs: TITLE_UNFOLD.delayMs, unfoldStaggerMs: TITLE_UNFOLD.staggerMs, speed: 1, reduced: false, texts: DEFAULT_TEXTS };

const clamped = (value: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback;

export function parseSettings(raw: string | null): QuickLabSettings {
  let stored: Partial<Record<keyof QuickLabSettings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") stored = parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const speed = typeof stored.speed === "number" && Number.isFinite(stored.speed) ? Math.min(SPEED_RANGE.max, Math.max(SPEED_RANGE.min, stored.speed)) : DEFAULT_SETTINGS.speed;
  return {
    variant: QUICK_VARIANTS.includes(stored.variant as QuickVariant) ? (stored.variant as QuickVariant) : DEFAULT_SETTINGS.variant,
    titleMode: TITLE_MODES.includes(stored.titleMode as TitleMode) ? (stored.titleMode as TitleMode) : DEFAULT_SETTINGS.titleMode,
    unfoldDelayMs: clamped(stored.unfoldDelayMs, TITLE_UNFOLD.delayRange, DEFAULT_SETTINGS.unfoldDelayMs),
    unfoldStaggerMs: clamped(stored.unfoldStaggerMs, TITLE_UNFOLD.staggerRange, DEFAULT_SETTINGS.unfoldStaggerMs),
    speed,
    reduced: typeof stored.reduced === "boolean" ? stored.reduced : DEFAULT_SETTINGS.reduced,
    texts: parseTexts(stored.texts),
  };
}

export function sameSettings(a: QuickLabSettings, b: QuickLabSettings): boolean {
  return a.variant === b.variant && a.titleMode === b.titleMode && a.unfoldDelayMs === b.unfoldDelayMs && a.unfoldStaggerMs === b.unfoldStaggerMs && a.speed === b.speed && a.reduced === b.reduced && sameTexts(a.texts, b.texts);
}

export function exportValues(settings: QuickLabSettings, theme: "light" | "dark", invite: InviteMode) {
  return { lab: "quick", round: 4, ...settings, invite, theme };
}
