import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Web Audio graph and media element, enough for the player's play and
// pause paths. resume() settles only when the test says so, to hold a play()
// in the window where a pause() or Not now can land.
const gainParam = { cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
let releaseResume: () => void = () => {};
let resumeCalls = 0;
let elementPlays = 0;

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  destination = {};
  addEventListener() {}
  resume() {
    resumeCalls++;
    return new Promise<void>((resolve) => {
      releaseResume = resolve;
    });
  }
  createMediaElementSource() {
    return { connect: vi.fn() };
  }
  createAnalyser() {
    return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 4, connect: vi.fn(), getByteFrequencyData: vi.fn() };
  }
  createGain() {
    return { gain: gainParam, connect: vi.fn() };
  }
}

class FakeAudio {
  src: string;
  preload = "";
  volume = 1;
  currentTime = 0;
  duration = 100;
  constructor(src: string) {
    this.src = src;
  }
  addEventListener() {}
  play() {
    elementPlays++;
    return Promise.resolve();
  }
  pause() {}
}

async function freshPlayer() {
  vi.resetModules();
  const { getSoundtrackPlayer } = await import("./audio");
  return getSoundtrackPlayer();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the soundtrack player", () => {
  beforeEach(() => {
    resumeCalls = 0;
    gainParam.linearRampToValueAtTime.mockClear();
    elementPlays = 0;
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("Audio", FakeAudio);
  });

  it("plays once the context has resumed", async () => {
    const player = await freshPlayer();
    player.play();
    expect(resumeCalls).toBe(1);
    releaseResume();
    await settle();
    expect(elementPlays).toBe(1);
    expect(player.getSnapshot().playing).toBe(true);
  });

  it("stays paused when pause() lands while the context is still resuming", async () => {
    const player = await freshPlayer();
    player.play();
    player.pause();
    releaseResume();
    await settle();
    expect(elementPlays).toBe(0);
    expect(player.getSnapshot().playing).toBe(false);
    expect(gainParam.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it("lets a second play() win over the first when both wait on the resume", async () => {
    const player = await freshPlayer();
    player.play();
    const releaseFirst = releaseResume;
    player.play();
    releaseFirst();
    releaseResume();
    await settle();
    expect(elementPlays).toBe(1);
    expect(player.getSnapshot().playing).toBe(true);
  });
});
