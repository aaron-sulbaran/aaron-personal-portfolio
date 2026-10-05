// What the panel tunes, the presets, and what "Copy values" puts on the
// clipboard. Durations are milliseconds at 1x; eases are GSAP names, and the
// site's own ease exports as its cubic-bezier.

export type StrikeKind = "fill" | "leader" | "stepped";
export type SplashKind = "dots" | "ring" | "ripple" | "none";
export type AKind = "trace" | "rise" | "wipe" | "scorch";
export type EaseKey = "site" | "expoIn" | "power3In" | "power2In" | "power2Out" | "expoOut" | "power2InOut" | "linear";
export type EffectColor = "accent" | "ink";
export type CardLayout = "side" | "above" | "ground";
export type OpenOrder = "strike-first" | "card-first";
export type TriggerKind = "click-at-top" | "double-click" | "hold";
export type HintKind = "none" | "twitch" | "glint";

export type StrikeSettings = {
  strike: StrikeKind;
  strikeMs: number;
  strikeEase: EaseKey;
  pauseMs: number;
  splash: SplashKind;
  splashSize: number;
  splashMs: number;
  splashEase: EaseKey;
  a: AKind;
  aMs: number;
  aEase: EaseKey;
  flash: number;
  effect: EffectColor;
  speed: number;
};

export type Settings = StrikeSettings & {
  sizePx: number;
  cardMarkPx: number;
  layout: CardLayout;
  order: OpenOrder;
  trigger: TriggerKind;
  holdMs: number;
  hint: HintKind;
};

export const EASES: Record<EaseKey, { name: string; gsap: string; export: string }> = {
  site: { name: "Site ease (out)", gsap: "site", export: "cubic-bezier(0.22, 1, 0.36, 1)" },
  expoIn: { name: "Expo in (accelerates)", gsap: "expo.in", export: "expo.in" },
  power3In: { name: "Power3 in", gsap: "power3.in", export: "power3.in" },
  power2In: { name: "Power2 in (moves at once)", gsap: "power2.in", export: "power2.in" },
  power2Out: { name: "Power2 out", gsap: "power2.out", export: "power2.out" },
  expoOut: { name: "Expo out", gsap: "expo.out", export: "expo.out" },
  power2InOut: { name: "Power2 in out", gsap: "power2.inOut", export: "power2.inOut" },
  linear: { name: "Linear", gsap: "none", export: "none" },
};

export const STRIKE_LABELS: Record<StrikeKind, string> = {
  fill: "Fill along the zigzag",
  leader: "Leader, then it thickens",
  stepped: "Stepped, one jolt per segment",
};
export const SPLASH_LABELS: Record<SplashKind, string> = {
  dots: "Dots along the ground",
  ring: "Ground ring",
  ripple: "Ground ripple",
  none: "None",
};
export const A_LABELS: Record<AKind, string> = {
  trace: "Traced from the impact, then the bar",
  rise: "Rises out of the ground",
  wipe: "Shockwave wipe",
  scorch: "Scorch fades up",
};
export const LAYOUT_LABELS: Record<CardLayout, string> = {
  side: "Mark left, text right",
  above: "Mark above",
  ground: "On a ground line",
};
export const ORDER_LABELS: Record<OpenOrder, string> = {
  "strike-first": "Strike, then the card forms",
  "card-first": "Card, then the strike",
};
export const TRIGGER_LABELS: Record<TriggerKind, string> = {
  "click-at-top": "Click at the top",
  "double-click": "Double click",
  hold: "Press and hold",
};
export const HINT_LABELS: Record<HintKind, string> = {
  none: "No hint",
  twitch: "Twitch once",
  glint: "Glint once",
};

const RECOMMENDED: Settings = {
  strike: "fill",
  strikeMs: 220,
  strikeEase: "power2In",
  pauseMs: 110,
  splash: "dots",
  splashSize: 1,
  splashMs: 640,
  splashEase: "power2Out",
  a: "trace",
  aMs: 620,
  aEase: "site",
  flash: 0.06,
  effect: "accent",
  speed: 1,
  sizePx: 300,
  cardMarkPx: 168,
  layout: "ground",
  order: "strike-first",
  trigger: "click-at-top",
  holdMs: 650,
  hint: "none",
};

export const PRESETS: readonly { id: string; name: string; note: string; settings: Settings }[] = [
  {
    id: "struck",
    name: "Struck",
    note: "My pick. A fast accelerating fill down the zigzag, a held beat, dots skitter along the ground and settle into a dotted row, then the A climbs up beside the tail and runs down to its foot, and the bar draws across from the bolt.",
    settings: RECOMMENDED,
  },
  {
    id: "return",
    name: "Return stroke",
    note: "Closer to real lightning: a thin leader finds the ground, then the bolt swells around it with the one flash. The A rises out of the ground.",
    settings: {
      ...RECOMMENDED,
      strike: "leader",
      strikeMs: 300,
      strikeEase: "power3In",
      pauseMs: 70,
      splash: "ripple",
      splashMs: 560,
      splashEase: "expoOut",
      a: "rise",
      aMs: 520,
      aEase: "site",
      flash: 0.08,
    },
  },
  {
    id: "stepped",
    name: "Stepped",
    note: "Three jolts, one per segment, then a ground ring and a shockwave that uncovers the A. The most dramatic and the most literal.",
    settings: {
      ...RECOMMENDED,
      strike: "stepped",
      strikeMs: 360,
      strikeEase: "power2Out",
      pauseMs: 60,
      splash: "ring",
      splashSize: 1.1,
      splashMs: 620,
      splashEase: "expoOut",
      a: "wipe",
      aMs: 460,
      aEase: "power2Out",
      flash: 0.06,
    },
  },
  {
    id: "quiet",
    name: "Quiet",
    note: "No splash and no flash: the bolt fills, and the A scorches up in the accent and cools to ink. For a card that should whisper.",
    settings: {
      ...RECOMMENDED,
      strike: "fill",
      strikeMs: 260,
      strikeEase: "power3In",
      pauseMs: 140,
      splash: "none",
      a: "scorch",
      aMs: 720,
      aEase: "power2InOut",
      flash: 0,
    },
  },
];

export const INITIAL: Settings = PRESETS[0].settings;

export function sameSettings(a: Settings, b: Settings) {
  return (Object.keys(a) as (keyof Settings)[]).every((key) => a[key] === b[key]);
}

// The timeline's beats in seconds at 1x; strike.ts builds from these and the
// panel reports them, so the numbers can never disagree.
export function beats(s: StrikeSettings) {
  const impact = s.strikeMs / 1000;
  const aStart = impact + s.pauseMs / 1000;
  const settle = aStart + s.aMs / 1000;
  const splashEnd = s.splash === "none" ? impact : impact + s.splashMs / 1000;
  const flashEnd = s.flash > 0 ? impact + 0.5 : impact;
  const end = Math.max(settle, splashEnd, flashEnd);
  return { impact, aStart, settle, end };
}

const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;

export function exportValues(s: Settings, label: string, theme: string) {
  const b = beats(s);
  return {
    label,
    theme,
    strike: STRIKE_LABELS[s.strike],
    strikeDuration: `${s.strikeMs}ms`,
    strikeEase: EASES[s.strikeEase].export,
    impactPause: `${s.pauseMs}ms`,
    splash: SPLASH_LABELS[s.splash],
    splashSize: s.splashSize,
    splashDuration: `${s.splashMs}ms`,
    splashEase: EASES[s.splashEase].export,
    aReveal: A_LABELS[s.a],
    aDuration: `${s.aMs}ms`,
    aEase: EASES[s.aEase].export,
    flashAmount: s.flash,
    flashRise: s.flash > 0 ? "60ms" : "none",
    flashDecay: s.flash > 0 ? "440ms" : "none",
    effectColor: s.effect === "accent" ? "var(--color-accent)" : "var(--color-foreground)",
    speed: s.speed,
    impactAt: ms(b.impact / s.speed),
    markSettledAt: ms(b.settle / s.speed),
    totalDuration: ms(b.end / s.speed),
    specimenSize: `${s.sizePx}px`,
    cardMarkSize: `${s.cardMarkPx}px`,
    cardLayout: LAYOUT_LABELS[s.layout],
    openOrder: ORDER_LABELS[s.order],
    trigger: TRIGGER_LABELS[s.trigger],
    holdDuration: s.trigger === "hold" ? `${s.holdMs}ms` : "n/a",
    hint: HINT_LABELS[s.hint],
    restingMark: "components/menu/BrandMark.tsx AsMark, flat currentColor",
    reducedMotion: "no strike: the static mark, the card fades in over 180ms",
  };
}
