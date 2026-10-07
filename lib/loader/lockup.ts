import { COIL } from "@/lib/coil/constants";
import { GRADIENT_STOPS, smoothstep } from "./continuity";

// The resting lockup: "Hi, I'm" over "Aaron" exactly where the canvas draws
// them (components/coil/scene/name.ts, COIL.lockup), for the loader to hold
// in the server's HTML until the scene takes it. The geometry is written once,
// over an arithmetic that is either numbers (the tests, the metrics) or CSS
// calc text (the stylesheet, so it holds before any JavaScript and through a
// resize), and the tests evaluate the calc text against the numbers.

const L = COIL.lockup;
// isNarrow's line (width over height below this), as a CSS ratio.
const NARROW_BELOW = `${Math.round(COIL.narrow.aspectBelow * 1000)}/1000`;

// The display face's metrics, per em: "Aaron"'s advance, ink width, ink left
// bearing, cap height and descent; the "H" cap height the greeting is sized
// from; "Hi, I'm"'s ascent, descent and ink left bearing; and where the
// baseline sits under a line-height 1 box.
export type LockupMetrics = {
  advW: number;
  inkW: number;
  inkL: number;
  capR: number;
  descR: number;
  base: number;
  capH: number;
  gAsc: number;
  gDesc: number;
  gInkL: number;
};

// Profa Black in Chromium (measured 2026-10-06); the loader re-measures them
// once the face has loaded.
export const PROFA_METRICS: LockupMetrics = {
  advW: 2.81636,
  inkW: 2.76636,
  inkL: 0,
  capR: 0.63636,
  descR: 0.01,
  base: 0.75,
  capH: 0.63636,
  gAsc: 0.68727,
  gDesc: 0.11909,
  gInkL: -0.05182,
};

export type InkMetrics = {
  width: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
  fontBoundingBoxAscent?: number;
  fontBoundingBoxDescent?: number;
};

// The metrics from a canvas's measureText of the name, the greeting and an
// "H" at `em` px; null when they do not look like the display face (the face
// has not loaded, or a fallback answered).
export function lockupMetrics(name: InkMetrics, greeting: InkMetrics, cap: InkMetrics, em: number): LockupMetrics | null {
  const ascent = name.fontBoundingBoxAscent;
  const descent = name.fontBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent) || !(ascent! > 0)) return null;
  const m: LockupMetrics = {
    advW: name.width / em,
    inkW: (name.actualBoundingBoxLeft + name.actualBoundingBoxRight) / em,
    inkL: name.actualBoundingBoxLeft / em,
    capR: name.actualBoundingBoxAscent / em,
    descR: Math.max(0, name.actualBoundingBoxDescent) / em,
    // Line-height 1: the half-leading splits (1em - content) above and below.
    base: (ascent! + (em - ascent! - descent!) / 2) / em,
    capH: cap.actualBoundingBoxAscent / em,
    gAsc: greeting.actualBoundingBoxAscent / em,
    gDesc: Math.max(0, greeting.actualBoundingBoxDescent) / em,
    gInkL: greeting.actualBoundingBoxLeft / em,
  };
  const sane =
    m.inkW > 2 &&
    m.inkW < 3.5 &&
    m.advW >= m.inkW * 0.9 &&
    m.capR > 0.5 &&
    m.capR < 0.8 &&
    m.capH > 0.5 &&
    m.capH < 0.8 &&
    m.gAsc > 0.4 &&
    m.base > m.capR &&
    m.base < 1.2;
  return sane ? m : null;
}

// The metrics as the stylesheet's custom properties.
export function lockupVars(m: LockupMetrics): [string, string][] {
  return (Object.keys(m) as (keyof LockupMetrics)[]).map((key) => [`--${key}`, m[key].toFixed(5)]);
}

// ---------------------------------------------------------------- geometry

export type Arith<T> = {
  n: (x: number) => T;
  add: (a: T, b: T) => T;
  sub: (a: T, b: T) => T;
  mul: (a: T, b: T) => T;
  div: (a: T, b: T) => T;
  ceil: (a: T) => T; // up to a whole px
};

export const NUM_ARITH: Arith<number> = {
  n: (x) => x,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => a / b,
  ceil: (a) => Math.ceil(a),
};

// Calc text: every operation parenthesized, wrapped in calc() by the caller.
export const CSS_ARITH: Arith<string> = {
  n: (x) => String(x),
  add: (a, b) => `(${a} + ${b})`,
  sub: (a, b) => `(${a} - ${b})`,
  mul: (a, b) => `(${a} * ${b})`,
  div: (a, b) => `(${a} / ${b})`,
  ceil: (a) => `round(up, ${a}, 1px)`,
};

type Metrics<T> = Record<keyof LockupMetrics, T>;
type Ink<T> = { left: T; baseline: T; fontPx: T };

export type LockupPose<T> = {
  name: Ink<T>; // the ink's left edge, the baseline, the size
  greeting: Ink<T>;
  mask: { top: T; height: T }; // the name's band, the gradient's span
};

// The canvas lockup on a pane `view` CSS px across (name.ts's layout): the
// name's advance spans a share of the width, its cap height is centered, the
// greeting sits on its left edge above it.
export function lockupPose<T>(a: Arith<T>, view: { width: T; height: T }, m: Metrics<T>, narrow: boolean): LockupPose<T> {
  const half = a.n(0.5);
  const size = a.div(a.mul(view.width, a.n(narrow ? L.widthNarrow : L.widthWide)), m.advW);
  const ascent = a.mul(m.capR, size);
  const capTop = a.sub(a.mul(view.height, half), a.mul(ascent, half));
  const left = a.mul(a.sub(view.width, a.mul(m.inkW, size)), half);
  const greetPx = a.mul(size, a.div(a.mul(a.n(L.greetingCap), m.capR), m.capH));
  const pad = a.ceil(a.mul(size, a.n(L.pad)));
  return {
    name: { left, baseline: a.add(capTop, ascent), fontPx: size },
    greeting: {
      left: a.add(left, a.mul(size, a.n(L.greetingShift))),
      baseline: a.sub(capTop, a.mul(greetPx, a.add(m.gDesc, a.mul(a.n(L.greetingGap), m.gAsc)))),
      fontPx: greetPx,
    },
    mask: { top: a.sub(capTop, pad), height: a.add(a.add(ascent, a.mul(m.descR, size)), a.mul(a.n(2), pad)) },
  };
}

type Span<T> = { left: T; top: T; fontPx: T };

// A text box at line-height 1 for an ink placement: its top is the baseline
// less the face's baseline offset, its left the pen (the ink's left edge plus
// the left bearing).
export function inkSpan<T>(a: Arith<T>, ink: Ink<T>, bearing: T, base: T): Span<T> {
  return {
    left: a.add(ink.left, a.mul(bearing, ink.fontPx)),
    top: a.sub(ink.baseline, a.mul(base, ink.fontPx)),
    fontPx: ink.fontPx,
  };
}

// The two text boxes, and the gradient's span from the name box's top.
export function lockupSpans<T>(a: Arith<T>, pose: LockupPose<T>, m: Metrics<T>) {
  const name = inkSpan(a, pose.name, m.inkL, m.base);
  return {
    name,
    greeting: inkSpan(a, pose.greeting, m.gInkL, m.base),
    gradient: { top: a.sub(pose.mask.top, name.top), height: pose.mask.height },
  };
}

// ---------------------------------------------------------------- stylesheet

const VAR_METRICS = Object.fromEntries(Object.keys(PROFA_METRICS).map((key) => [key, `var(--${key})`])) as Metrics<string>;

// The metrics' defaults, for the loader's root.
export function lockupVarDefaults() {
  return lockupVars(PROFA_METRICS)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function gradientColor(k: number) {
  if (k === 0) return "var(--name-grad-top)";
  if (k === 1) return "var(--name-grad-bottom)";
  return `color-mix(in srgb, var(--name-grad-top), var(--name-grad-bottom) ${(smoothstep(k) * 100).toFixed(4)}%)`;
}

// The lockup's three parts as selectors: the ink layer (a container's
// child, inset 0), the greeting and the name inside it.
export type LockupSelectors = { layer: string; greet: string; name: string };

// The loader's resting lockup (components/loader/Loader.tsx).
export const LOADER_LOCKUP: LockupSelectors = {
  layer: ".coil-loader__rest",
  greet: ".coil-loader__rest-greet",
  name: ".coil-loader__rest-name",
};

// The hero's h1 (components/home/HeroText.tsx): the container is the h1.
export const HERO_LOCKUP = {
  container: ".hero-lockup",
  layer: ".hero-lockup__ink",
  greet: ".hero-lockup__greet",
  name: ".hero-lockup__name",
  stop: ".hero-lockup__stop",
} as const satisfies LockupSelectors & { container: string; stop: string };

function placement(sel: LockupSelectors, narrow: boolean) {
  const s = lockupSpans(CSS_ARITH, lockupPose(CSS_ARITH, { width: "100cqw", height: "100cqh" }, VAR_METRICS, narrow), VAR_METRICS);
  const stops = GRADIENT_STOPS.map((k) => `${gradientColor(k)} calc(${s.gradient.top} + ${s.gradient.height} * ${k})`);
  const box = (b: Span<string>) => `left:calc(${b.left});top:calc(${b.top});font-size:calc(${b.fontPx})`;
  return (
    `${sel.greet}{${box(s.greeting)}}` +
    `${sel.name}{${box(s.name)};background-image:linear-gradient(to bottom,${stops.join(",")})}`
  );
}

// The resting lockup's rules: the composite's ink over the field (the
// letters at the gradient, the layer at --name-ink times the gain), the
// greeting in the gradient's top color, the name in the gradient itself.
// The theme's tokens carry the colors, so a theme switch needs nothing.
// One function for both lockups, so the h1 lands at the loader's pose.
export function restLockupCss(sel: LockupSelectors = LOADER_LOCKUP) {
  return (
    `${sel.layer}{position:absolute;inset:0;pointer-events:none;opacity:calc(var(--name-ink) * ${L.inkGain});` +
    `font-family:var(--font-display),sans-serif;font-weight:900;font-synthesis:none;font-kerning:normal;line-height:1;white-space:nowrap}` +
    `${sel.greet},${sel.name}{position:absolute;display:block;line-height:1}` +
    `${sel.greet}{color:var(--name-grad-top)}` +
    `${sel.name}{color:transparent;-webkit-background-clip:text;background-clip:text}` +
    placement(sel, false) +
    `@container (aspect-ratio < ${NARROW_BELOW}){${placement(sel, true)}}`
  );
}

// The h1 as the lockup: the h1 covers the box the loader's root covers (the
// hero's top, full width, 100svh) and is the size container, so the same
// rules land at the identical pose, with the metrics' defaults until the
// loader measures the face (it sets them on both). The layer's ink is
// COIL.lockup.stillInk: --name-ink at stillInk over the gain, so the shared
// opacity rule comes out at stillInk. The period sits in the name's box at
// zero size: an inline box, so the accessible name joins it to the name
// with no space (an absolutely placed sr-only span is block-level, and the
// name computation puts a space before a block).
export function heroLockupCss() {
  const h = HERO_LOCKUP;
  return (
    `${h.container}{position:absolute;top:0;left:0;right:0;height:100vh;height:100svh;margin:0;container-type:size;pointer-events:none;${lockupVarDefaults()}}` +
    `${h.layer}{--name-ink:calc(${L.stillInk} / ${L.inkGain})}` +
    `${h.stop}{font-size:0}` +
    restLockupCss(h)
  );
}
