import type { InviteMode } from "./invite";
import { SPEED_RANGE } from "./motion";
import { DEFAULT_TEXTS, parseTexts, sameTexts, type QuickTexts } from "./texts";

// The quick lab's settings, stored per browser. Bump the key when a field's meaning changes.

export type QuickVariant = "rail" | "trip" | "road";

export const QUICK_VARIANTS: readonly QuickVariant[] = ["rail", "trip", "road"];

export interface QuickLabSettings {
  variant: QuickVariant;
  speed: number;
  reduced: boolean;
  texts: QuickTexts;
}

export const SETTINGS_KEY = "lab-quick-v4";

export const DEFAULT_SETTINGS: QuickLabSettings = { variant: "rail", speed: 1, reduced: false, texts: DEFAULT_TEXTS };

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
    speed,
    reduced: typeof stored.reduced === "boolean" ? stored.reduced : DEFAULT_SETTINGS.reduced,
    texts: parseTexts(stored.texts),
  };
}

export function sameSettings(a: QuickLabSettings, b: QuickLabSettings): boolean {
  return a.variant === b.variant && a.speed === b.speed && a.reduced === b.reduced && sameTexts(a.texts, b.texts);
}

export function exportValues(settings: QuickLabSettings, theme: "light" | "dark", invite: InviteMode) {
  return { lab: "quick", round: 3, ...settings, invite, theme };
}
