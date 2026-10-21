import { describe, expect, it } from "vitest";
import { createQueue, cycleRepeat, nextIndex, previousIndex, RESTART_AFTER_S, setRepeat, setShuffle, shuffleOrder, type Queue, type Rng } from "./queue";

// A small deterministic generator, so a shuffle in a test is the same every run.
function seeded(seed: number): Rng {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const LENGTH = 7;
const sorted = (order: number[]) => order.slice().sort((a, b) => a - b);
const ALL = [0, 1, 2, 3, 4, 5, 6];

describe("repeat", () => {
  it("cycles off, all, one, and back to off", () => {
    expect(cycleRepeat("off")).toBe("all");
    expect(cycleRepeat("all")).toBe("one");
    expect(cycleRepeat("one")).toBe("off");
  });

  it("starts on all, as the site's music always wrapped", () => {
    expect(createQueue(LENGTH).repeat).toBe("all");
    expect(createQueue(LENGTH).order).toEqual(ALL);
  });
});

describe("shuffle", () => {
  it("puts every track in the order once, with the playing one first", () => {
    const order = shuffleOrder(LENGTH, 4, seeded(1));
    expect(order[0]).toBe(4);
    expect(sorted(order)).toEqual(ALL);
  });

  it("is a different order for a different roll, and the same for the same one", () => {
    expect(shuffleOrder(LENGTH, null, seeded(3))).toEqual(shuffleOrder(LENGTH, null, seeded(3)));
    expect(shuffleOrder(LENGTH, null, seeded(3))).not.toEqual(shuffleOrder(LENGTH, null, seeded(8)));
  });

  it("turns on at the current track and off back to the list's order", () => {
    const on = setShuffle(createQueue(LENGTH), true, 5, seeded(2));
    expect(on.shuffle).toBe(true);
    expect(on.order[0]).toBe(5);
    expect(sorted(on.order)).toEqual(ALL);
    expect(setShuffle(on, false, 5, seeded(2)).order).toEqual(ALL);
  });

  it("changes nothing when it is already in the state asked for", () => {
    const queue = createQueue(LENGTH);
    expect(setShuffle(queue, false, 0, seeded(1))).toBe(queue);
    expect(setRepeat(queue, "all")).toBe(queue);
  });

  it("plays every track once before any repeats, then starts a new pass", () => {
    let queue = setShuffle(createQueue(LENGTH), true, 2, seeded(7));
    const rng = seeded(9);
    let current = 2;
    const played = [current];
    for (let i = 0; i < LENGTH - 1; i++) {
      const move = nextIndex(queue, current, "press", rng);
      current = move.index as number;
      queue = move.queue;
      played.push(current);
    }
    expect(sorted(played)).toEqual(ALL);
    const wrap = nextIndex(queue, current, "press", rng);
    expect(wrap.index).not.toBe(current);
    expect(sorted(wrap.queue.order)).toEqual(ALL);
    expect(wrap.queue.order[0]).toBe(wrap.index);
  });
});

describe("next", () => {
  const off: Queue = createQueue(LENGTH, "off");
  const all: Queue = createQueue(LENGTH, "all");

  it("goes to the next track in the list", () => {
    expect(nextIndex(all, 2, "press", seeded(1)).index).toBe(3);
    expect(nextIndex(all, 2, "ended", seeded(1)).index).toBe(3);
  });

  it("wraps to the first track from the last on repeat all, and on a press whatever the repeat", () => {
    expect(nextIndex(all, 6, "ended", seeded(1)).index).toBe(0);
    expect(nextIndex(off, 6, "press", seeded(1)).index).toBe(0);
  });

  it("stops after the last track ends when repeat is off", () => {
    expect(nextIndex(off, 6, "ended", seeded(1)).index).toBeNull();
    expect(nextIndex(off, 5, "ended", seeded(1)).index).toBe(6);
  });

  it("plays a track that ends again on repeat one, and still moves on a press", () => {
    const one = setRepeat(all, "one");
    expect(nextIndex(one, 3, "ended", seeded(1))).toMatchObject({ index: 3, restart: true });
    expect(nextIndex(one, 3, "press", seeded(1))).toMatchObject({ index: 4, restart: false });
  });

  it("follows a track chosen from the list: the next one is the one after it", () => {
    expect(nextIndex(all, 5, "press", seeded(1)).index).toBe(6);
  });

  it("starts a shuffle again from a track chosen off its order", () => {
    const shuffled: Queue = { shuffle: true, repeat: "all", order: [0, 1, 2] };
    const move = nextIndex(shuffled, 6, "press", seeded(1));
    expect(move.queue.order[0]).toBe(6);
    expect(move.index).toBe(move.queue.order[1]);
  });

  it("copes with a one-track queue and an empty one", () => {
    expect(nextIndex(createQueue(1), 0, "press", seeded(1)).index).toBe(0);
    expect(nextIndex(createQueue(1, "off"), 0, "ended", seeded(1)).index).toBeNull();
    expect(nextIndex(createQueue(0), 0, "press", seeded(1)).index).toBeNull();
  });
});

describe("previous", () => {
  const queue = createQueue(LENGTH);

  it("restarts the track when more than three seconds of it have played", () => {
    expect(previousIndex(queue, 3, RESTART_AFTER_S + 0.1, seeded(1))).toMatchObject({ index: 3, restart: true });
  });

  it("goes back a track in the first three seconds, and wraps from the first to the last", () => {
    expect(previousIndex(queue, 3, 1, seeded(1))).toMatchObject({ index: 2, restart: false });
    expect(previousIndex(queue, 0, 0, seeded(1)).index).toBe(6);
  });

  it("goes back along the shuffled order", () => {
    const shuffled = setShuffle(queue, true, 4, seeded(5));
    const forward = nextIndex(shuffled, 4, "press", seeded(5));
    const back = previousIndex(forward.queue, forward.index as number, 0, seeded(5));
    expect(back.index).toBe(4);
  });
});
