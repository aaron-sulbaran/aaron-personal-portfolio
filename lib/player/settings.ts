// The music player lab's settings, per browser. Bump the key when a field's
// meaning changes. Everything is off by default, so the band renders exactly
// as it does today (every default below is today's behavior).

export const ON_PLAY = ["today", "card", "sheet"] as const;
export type OnPlay = (typeof ON_PLAY)[number];

export const INTO_ISLE = ["today", "morph", "fade"] as const;
export type IntoIsle = (typeof INTO_ISLE)[number];

export const BACK_UP = ["pill", "reopen"] as const;
export type BackUp = (typeof BACK_UP)[number];

export const CREDIT = ["band", "player", "hidden"] as const;
export type CreditMode = (typeof CREDIT)[number];

export const PHONE = ["band", "bar"] as const;
export type PhoneMode = (typeof PHONE)[number];

export const SETTINGS_KEY = "lab-player-v1";

// Where the hand-off to the isle happens, as a fraction of the viewport's
// height from its top: the band's bottom edge rising above this line starts
// it. 0.4 puts the band in the upper two fifths when it goes.
export const ISLE_LINE = { min: 0.1, max: 0.9, step: 0.01 } as const;

export interface PlayerLabSettings {
  enabled: boolean;
  onPlay: OnPlay;
  intoIsle: IntoIsle;
  isleLine: number;
  backUp: BackUp;
  credit: CreditMode;
  phone: PhoneMode;
}

export const DEFAULT_SETTINGS: PlayerLabSettings = {
  enabled: false,
  onPlay: "today",
  intoIsle: "today",
  isleLine: 0.4,
  backUp: "pill",
  credit: "band",
  phone: "band",
};

const pick = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

const clamp = (value: unknown, range: { min: number; max: number }, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback;

export function parseSettings(raw: string | null): PlayerLabSettings {
  let stored: Partial<Record<keyof PlayerLabSettings, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") stored = parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const d = DEFAULT_SETTINGS;
  return {
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : d.enabled,
    onPlay: pick(ON_PLAY, stored.onPlay, d.onPlay),
    intoIsle: pick(INTO_ISLE, stored.intoIsle, d.intoIsle),
    isleLine: clamp(stored.isleLine, ISLE_LINE, d.isleLine),
    backUp: pick(BACK_UP, stored.backUp, d.backUp),
    credit: pick(CREDIT, stored.credit, d.credit),
    phone: pick(PHONE, stored.phone, d.phone),
  };
}

// What the Copy values button puts on the clipboard.
export function exportValues(settings: PlayerLabSettings, theme: "light" | "dark") {
  return { lab: "player", key: SETTINGS_KEY, round: 1, theme, ...settings };
}

// Whether the lab changes the player at all: the master switch is on and the
// settings differ from today's in the player (credit alone does not draw one).
export function drawsPlayer(settings: PlayerLabSettings): boolean {
  return settings.enabled && settings.onPlay !== "today";
}
