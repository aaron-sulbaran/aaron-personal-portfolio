// The deck's riffle as a plan (pure): split the deck into two halves, bring
// them back interleaved in a quick cascade, square up. Cards are indexed from
// the bottom of the deck (0) to the top. The player (components/home/deckPlayer)
// runs the plan with GSAP on the cards' own transforms.

export type RiffleHalf = "L" | "R";

export type RiffleDrop = {
  card: number;
  half: RiffleHalf;
  startMs: number;
  durationMs: number;
};

export type RifflePlan = {
  halves: RiffleHalf[]; // each card's half, bottom to top
  splitEndMs: number; // the halves have parted
  drops: RiffleDrop[]; // in the order the cards fall back, the first becoming the new bottom
  squareStartMs: number; // the deck squares up
  totalMs: number;
};

const SPLIT_END = 0.3;
const DROPS_START = 0.24;
const DROPS_END = 0.84;
const DROP_SHARE = 0.22;
const SQUARE_START = 0.78;

export function riffleSteps(count: number, totalMs: number): RifflePlan {
  const n = Math.max(0, Math.floor(count));
  const lowerSize = Math.ceil(n / 2);
  const halves = Array.from({ length: n }, (_, card): RiffleHalf => (card < lowerSize ? "L" : "R"));
  const lower = halves.flatMap((half, card) => (half === "L" ? [card] : []));
  const upper = halves.flatMap((half, card) => (half === "R" ? [card] : []));
  const order: number[] = [];
  for (let i = 0; i < lowerSize; i++) {
    order.push(lower[i]);
    if (i < upper.length) order.push(upper[i]);
  }
  const dropMs = DROP_SHARE * totalMs;
  const span = (DROPS_END - DROPS_START) * totalMs - dropMs;
  const stagger = order.length > 1 ? span / (order.length - 1) : 0;
  const drops = order.map((card, i): RiffleDrop => ({ card, half: halves[card], startMs: DROPS_START * totalMs + i * stagger, durationMs: dropMs }));
  return { halves, splitEndMs: SPLIT_END * totalMs, drops, squareStartMs: SQUARE_START * totalMs, totalMs };
}
