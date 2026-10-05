import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stub player with the real one's contract: play() flips `playing` on at
// once and emits (optimistic); a rejection or a load error flips it off and
// emits again; pause() flips it off and emits.
const player = {
  playing: false,
  listeners: new Set<() => void>(),
  emit() {
    this.listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },
  play() {
    this.playing = true;
    this.emit();
  },
  pause() {
    this.playing = false;
    this.emit();
  },
  fail() {
    this.playing = false;
    this.emit();
  },
};

vi.mock("./audio", () => ({ getSoundtrackPlayer: () => player }));

let now = 0;

async function freshStore() {
  vi.resetModules();
  player.playing = false;
  player.listeners.clear();
  return import("./soundtrack");
}

describe("the start window", () => {
  beforeEach(() => {
    now = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  it("marks a start that the player drops inside 4s as failed, and pauses", async () => {
    const store = await freshStore();
    store.startSoundtrack();
    expect(store.getSoundtrackState()).toBe("on");
    now += 300;
    player.fail();
    expect(store.getSoundtrackState()).toBe("paused");
    expect(store.getPlayFailed()).toBe(true);
  });

  it("never reads the visitor's own pause inside the window as a failure", async () => {
    const store = await freshStore();
    store.startSoundtrack();
    now += 500;
    store.pauseSoundtrack();
    expect(store.getSoundtrackState()).toBe("paused");
    expect(store.getPlayFailed()).toBe(false);
  });

  it("does not count a stop after the window", async () => {
    const store = await freshStore();
    store.startSoundtrack();
    now += store.START_WINDOW_MS + 1;
    player.fail();
    expect(store.getSoundtrackState()).toBe("paused");
    expect(store.getPlayFailed()).toBe(false);
  });

  it("clears the failure on the next successful start", async () => {
    const store = await freshStore();
    store.startSoundtrack();
    now += 200;
    player.fail();
    expect(store.getPlayFailed()).toBe(true);
    now += 2_000;
    store.startSoundtrack();
    expect(store.getSoundtrackState()).toBe("on");
    expect(store.getPlayFailed()).toBe(false);
    now += 5_000;
    expect(store.getPlayFailed()).toBe(false);
  });
});
