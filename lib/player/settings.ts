// The music player lab's settings, per browser. The master switch is off by
// default and, off, nothing below is read: the band, the pill and the wave
// behave exactly as they do today. The other defaults are the direction Aaron
// chose after round 1 (the compact sheet, the home hub in the band, the island
// on phones), so Reset settings puts the lab on that direction.

export const ON_PLAY = ["today", "card", "sheet"] as const;
export type OnPlay = (typeof ON_PLAY)[number];

export const INTO_ISLE = ["today", "morph", "fade"] as const;
export type IntoIsle = (typeof INTO_ISLE)[number];

export const BACK_UP = ["pill", "reopen"] as const;
export type BackUp = (typeof BACK_UP)[number];

export const CREDIT = ["band", "player", "hidden"] as const;
export type CreditMode = (typeof CREDIT)[number];

export const PHONE = ["band", "bar", "island"] as const;
export type PhoneMode = (typeof PHONE)[number];

// With the sheet in the band, the band's own status sentence and its Pause or
// Resume beside the heading are redundant: the sheet is the feedback.
export const STATUS_LINE = ["today", "hidden"] as const;
export type StatusLine = (typeof STATUS_LINE)[number];

// After "Not now": the lone text link lower in the band, or two buttons beside
// the "No problem" line (Play it, and Freeze the wave).
export const NOT_NOW = ["today", "buttons"] as const;
export type NotNow = (typeof NOT_NOW)[number];

// After either answer: the wave reacts at once (today), or stays as it was
// until the band has scrolled away.
export const WAVE_AFTER_ANSWER = ["today", "waits"] as const;
export type WaveAfterAnswer = (typeof WAVE_AFTER_ANSWER)[number];

// The desktop isle near the footer: ride up to stay above its top edge, or
// fade out while the footer is in view.
export const FOOTER = ["lift", "hide"] as const;
export type FooterMode = (typeof FOOTER)[number];

// A phone to preview in the lab's frame; auto reads the real device.
export const PHONE_MODEL = ["auto", "iphone15", "iphone17pro", "iphone17promax", "android"] as const;
export type PhoneModel = (typeof PHONE_MODEL)[number];

export const SETTINGS_KEY = "lab-player-v1";
export const ROUND = 2;

// Where the hand-off to the isle happens, as a fraction of the viewport's
// height from its top: the band's bottom edge rising above this line starts
// it. 0.4 puts the band in the upper two fifths when it goes.
export const ISLE_LINE = { min: 0.1, max: 0.9, step: 0.01 } as const;

// Where a held wave is released, on the same scale: the band's bottom edge
// above this line counts as scrolled away.
export const WAVE_LINE = { min: 0.1, max: 0.9, step: 0.01 } as const;

export interface PlayerLabSettings {
  round: typeof ROUND;
  enabled: boolean;
  onPlay: OnPlay;
  intoIsle: IntoIsle;
  isleLine: number;
  backUp: BackUp;
  credit: CreditMode;
  phone: PhoneMode;
  statusLine: StatusLine;
  notNow: NotNow;
  waveAfterAnswer: WaveAfterAnswer;
  waveLine: number;
  footer: FooterMode;
  phoneModel: PhoneModel;
}

export const DEFAULT_SETTINGS: PlayerLabSettings = {
  round: ROUND,
  enabled: false,
  onPlay: "sheet",
  intoIsle: "morph",
  isleLine: 0.4,
  backUp: "reopen",
  credit: "hidden",
  phone: "island",
  statusLine: "hidden",
  notNow: "buttons",
  waveAfterAnswer: "waits",
  waveLine: 0.4,
  footer: "lift",
  phoneModel: "auto",
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
  // Round 1 stored no round. Its phone choice was between the band and a
  // bottom bar; the island (a pick Aaron named after it) replaces the bar the
  // first time round 2 reads those values, and the bar stays one click away.
  const fromRoundOne = stored.round !== ROUND;
  const phone = pick(PHONE, stored.phone, d.phone);
  return {
    round: ROUND,
    enabled: typeof stored.enabled === "boolean" ? stored.enabled : d.enabled,
    onPlay: pick(ON_PLAY, stored.onPlay, d.onPlay),
    intoIsle: pick(INTO_ISLE, stored.intoIsle, d.intoIsle),
    isleLine: clamp(stored.isleLine, ISLE_LINE, d.isleLine),
    backUp: pick(BACK_UP, stored.backUp, d.backUp),
    credit: pick(CREDIT, stored.credit, d.credit),
    phone: fromRoundOne && phone === "bar" ? "island" : phone,
    statusLine: pick(STATUS_LINE, stored.statusLine, d.statusLine),
    notNow: pick(NOT_NOW, stored.notNow, d.notNow),
    waveAfterAnswer: pick(WAVE_AFTER_ANSWER, stored.waveAfterAnswer, d.waveAfterAnswer),
    waveLine: clamp(stored.waveLine, WAVE_LINE, d.waveLine),
    footer: pick(FOOTER, stored.footer, d.footer),
    phoneModel: pick(PHONE_MODEL, stored.phoneModel, d.phoneModel),
  };
}

// What the Copy values button puts on the clipboard.
export function exportValues(settings: PlayerLabSettings, theme: "light" | "dark") {
  return { lab: "player", key: SETTINGS_KEY, theme, ...settings };
}

// Whether the lab draws a player at all: the master switch is on and On play
// is not Today (the band's other changes need no player).
export function drawsPlayer(settings: PlayerLabSettings): boolean {
  return settings.enabled && settings.onPlay !== "today";
}
