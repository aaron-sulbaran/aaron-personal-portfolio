// The player's queue, pure: the order the tracks play in, shuffle and repeat,
// and what next and previous mean under them. The audio player only knows
// "this track index"; the player asks the queue what comes after it.
//
//   off  the order is the list's order.
//   on   the order is a shuffle that starts at the track now playing, so
//        nothing repeats until every track has played; at its end it is
//        shuffled again, never opening on the track that just finished.
//   repeat  off: the queue stops after its last track ends. all: it wraps.
//           one: a track that ends plays again. Pressing next or previous
//           still moves, and always wraps.

export type RepeatMode = "off" | "all" | "one";
export const REPEAT_CYCLE: readonly RepeatMode[] = ["off", "all", "one"];
export const cycleRepeat = (mode: RepeatMode): RepeatMode => REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(mode) + 1) % REPEAT_CYCLE.length];

// Previous restarts the track when more than this much of it has played.
export const RESTART_AFTER_S = 3;

export type Rng = () => number;

export interface Queue {
  shuffle: boolean;
  repeat: RepeatMode;
  order: number[];
}

const identity = (length: number): number[] => Array.from({ length }, (_, index) => index);

// The site's own music never stops by itself (the player used to wrap), so the queue starts on repeat all.
export function createQueue(length: number, repeat: RepeatMode = "all"): Queue {
  return { shuffle: false, repeat, order: identity(length) };
}

// A Fisher-Yates shuffle of every track, with `first` at the head when it is given.
export function shuffleOrder(length: number, first: number | null, rng: Rng): number[] {
  const rest = identity(length).filter((index) => index !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first === null ? rest : [first, ...rest];
}

export function setShuffle(queue: Queue, on: boolean, current: number, rng: Rng): Queue {
  const length = queue.order.length;
  if (on === queue.shuffle) return queue;
  return { ...queue, shuffle: on, order: on ? shuffleOrder(length, current, rng) : identity(length) };
}

export const setRepeat = (queue: Queue, repeat: RepeatMode): Queue => (repeat === queue.repeat ? queue : { ...queue, repeat });

// Where `current` sits in the order. A track picked from the list may not be where the queue expected, and a shuffle then starts again from it.
function locate(queue: Queue, current: number, rng: Rng): { queue: Queue; position: number } {
  const at = queue.order.indexOf(current);
  if (at >= 0) return { queue, position: at };
  const order = queue.shuffle ? shuffleOrder(queue.order.length, current, rng) : identity(queue.order.length);
  return { queue: { ...queue, order }, position: queue.shuffle ? 0 : Math.max(0, order.indexOf(current)) };
}

export interface Move {
  index: number | null; // the track to play, or null: the queue has ended
  restart: boolean; // the same track from its start
  queue: Queue;
}

export type NextReason = "press" | "ended";

export function nextIndex(queue: Queue, current: number, reason: NextReason, rng: Rng): Move {
  const length = queue.order.length;
  if (length === 0) return { index: null, restart: false, queue };
  if (reason === "ended" && queue.repeat === "one") return { index: current, restart: true, queue };
  const located = locate(queue, current, rng);
  const { position } = located;
  if (position + 1 < length) return { index: located.queue.order[position + 1], restart: false, queue: located.queue };
  if (reason === "ended" && queue.repeat === "off") return { index: null, restart: false, queue: located.queue };
  if (!queue.shuffle) return { index: located.queue.order[0], restart: false, queue: located.queue };
  // A new shuffle for the next pass, which never opens on the track that just played (unless it is the only one).
  const order = shuffleOrder(length, null, rng);
  if (length > 1 && order[0] === current) [order[0], order[1]] = [order[1], order[0]];
  return { index: order[0], restart: false, queue: { ...located.queue, order } };
}

export function previousIndex(queue: Queue, current: number, positionSeconds: number, rng: Rng): Move {
  const length = queue.order.length;
  if (length === 0) return { index: null, restart: false, queue };
  if (positionSeconds > RESTART_AFTER_S) return { index: current, restart: true, queue };
  const located = locate(queue, current, rng);
  const before = located.position - 1;
  return { index: located.queue.order[before >= 0 ? before : length - 1], restart: false, queue: located.queue };
}
