// The Talos sting, the brand kit's approved radar opening in its full cut
// (talos/brand/kit/motion/talos-sting.html, 2.75 s): the coin is a scope, a
// sweep turns and lights three contacts, the die strikes the T as the nearest
// one closes in, and ALOS fans out from behind the coin. seek(t) is a pure
// function of time; components/card/TalosSting draws the frame. The last frame
// is the static lockup (lockup.test.ts), and nothing here touches the DOM.

export const STING = {
  durationMs: 2750,
  strikeMs: 1550,
  dropMs: [1310, 1550],
  squashMs: 67, // two frames at 30 fps, the coin at 96 percent
  settleMs: 200,
  squashScale: 0.96,
  dieLift: 560, // the die starts this far above its landing, out of frame
  wordMs: [1620, 2390], // the strike plus 70 ms, then 770 ms
  letterStaggerMs: 40, // the S leaves first, each letter 40 ms after the one before
  wordTravel: 120, // units the word slides right, in lockup space
  compress: 12, // extra start offset per letter; the narrowest gap (L to O) is 16
  wipeFrom: 300, // the wipe opens inside the coin's right half
  wipeTo: 1330,
  wipeStart: 216, // the wipe's left edge, the coin's centre in lockup space
  sweepTurnMs: 1150, // constant, a scope turns at one rate
  sweepRadius: 232,
  sectorDeg: 24, // three flat sectors of 24 degrees
  // [bearing clockwise from 12 o'clock, range of the first pass, range of the second]
  contacts: [[58, 196, 64], [196, 190, 44], [302, 150, 26]],
  contactFadeShare: 0.9, // of a turn, then dim until the next pass
  contactFloor: 0.2,
} as const;

export interface Contact { x: number; y: number; opacity: number }
export interface Scope { sectors: readonly [string, string, string]; contacts: readonly (Contact | null)[] }

export interface StingFrame {
  tMs: number;
  struck: boolean;
  coinScale: number;
  dieY: number | null; // null: no die on screen
  scope: Scope | null; // null from the strike on, so the struck frame is the plain mark
  wipeWidth: number; // the word's mask, from STING.wipeStart
  wordDone: boolean; // the mask is gone and the word is the lockup's
  letterShift: readonly [number, number, number, number]; // x offsets of A, L, O, S
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const seg = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const cubicIn = (x: number) => x * x * x;
const cubicOut = (x: number) => 1 - (1 - x) ** 3;
const fmt = (n: number) => Math.round(n * 1000) / 1000;

const turns = STING.strikeMs / STING.sweepTurnMs;

function clockPoint(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [256 + r * Math.sin(a), 256 - r * Math.cos(a)];
}

function sector(from: number, to: number): string {
  const [ax, ay] = clockPoint(from, STING.sweepRadius);
  const [bx, by] = clockPoint(to, STING.sweepRadius);
  const r = fmt(STING.sweepRadius);
  return `M256 256L${fmt(ax)} ${fmt(ay)}A${r} ${r} 0 0 1 ${fmt(bx)} ${fmt(by)}Z`;
}

// A contact is drawn where it was when the lead edge last crossed its bearing,
// at full brightness, and dims (cubic out) until the next crossing.
function scopeAt(t: number): Scope {
  const deg = 360 * turns * seg(t, 0, STING.strikeMs);
  const contacts = STING.contacts.map(([bearing, first, second]): Contact | null => {
    if (deg < bearing) return null;
    const pass = Math.floor((deg - bearing) / 360);
    const crossedMs = ((bearing + 360 * pass) / (360 * turns)) * STING.strikeMs;
    const [x, y] = clockPoint(bearing, pass === 0 ? first : second);
    return { x: fmt(x), y: fmt(y), opacity: fmt(lerp(1, STING.contactFloor, cubicOut(seg(t, crossedMs, crossedMs + STING.contactFadeShare * STING.sweepTurnMs)))) };
  });
  const sectors = [0, 1, 2].map((k) => sector(deg - STING.sectorDeg * (k + 1), deg - STING.sectorDeg * k)) as [string, string, string];
  return { sectors, contacts };
}

export function seek(tMs: number): StingFrame {
  const t = clamp(tMs, 0, STING.durationMs);
  const struck = t >= STING.strikeMs;
  const hardEnd = STING.strikeMs + STING.squashMs;
  const coinScale = !struck ? 1 : t < hardEnd ? STING.squashScale : lerp(STING.squashScale, 1, cubicOut(seg(t, hardEnd, hardEnd + STING.settleMs)));
  const [dropStart, dropEnd] = STING.dropMs;
  const dieY = !struck && t >= dropStart ? fmt(lerp(-STING.dieLift, 0, cubicIn(seg(t, dropStart, dropEnd)))) : null;
  const [wordStart, wordEnd] = STING.wordMs;
  const progress = cubicOut(seg(t, wordStart, wordEnd));
  const letterShift = [0, 1, 2, 3].map((k) => {
    const p = cubicOut(seg(t, wordStart + (3 - k) * STING.letterStaggerMs, wordEnd));
    return fmt(lerp(-STING.wordTravel - k * STING.compress, 0, p));
  }) as unknown as StingFrame["letterShift"];
  const wipeX = t < wordStart ? STING.wipeStart : lerp(STING.wipeFrom, STING.wipeTo, progress);
  return {
    tMs: t,
    struck,
    coinScale: fmt(coinScale),
    dieY,
    scope: struck ? null : scopeAt(t),
    wipeWidth: fmt(Math.max(0, wipeX - STING.wipeStart)),
    wordDone: progress >= 1,
    letterShift,
  };
}
