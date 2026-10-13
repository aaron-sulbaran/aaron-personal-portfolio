import { QUICK_ORDERS, type QuickOrder } from "./items";
import { SPEED_RANGE } from "./motion";

// The quick lab's settings, stored per browser. Bump the key when a field's meaning changes.

export type QuickVariant = "spine" | "rail" | "road";

export const QUICK_VARIANTS: readonly QuickVariant[] = ["spine", "rail", "road"];

export interface QuickLabSettings {
  variant: QuickVariant;
  order: QuickOrder;
  speed: number;
  reduced: boolean;
}

export const SETTINGS_KEY = "lab-quick-v2";

export const DEFAULT_SETTINGS: QuickLabSettings = { variant: "spine", order: "newest", speed: 1, reduced: false };

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
    order: QUICK_ORDERS.includes(stored.order as QuickOrder) ? (stored.order as QuickOrder) : DEFAULT_SETTINGS.order,
    speed,
    reduced: typeof stored.reduced === "boolean" ? stored.reduced : DEFAULT_SETTINGS.reduced,
  };
}

export function sameSettings(a: QuickLabSettings, b: QuickLabSettings): boolean {
  return a.variant === b.variant && a.order === b.order && a.speed === b.speed && a.reduced === b.reduced;
}

export function exportValues(settings: QuickLabSettings, theme: "light" | "dark") {
  return { lab: "quick", round: 2, ...settings, theme };
}
