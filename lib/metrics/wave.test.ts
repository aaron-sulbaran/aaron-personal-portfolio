import { describe, expect, it } from "vitest";
import { GALLERY } from "@/lib/gallery/constants";
import { TOKENS } from "./settings";
import { WAVE_EASE, WAVE_MASK_MS, waveEvents, waveSchedule, type WaveInput } from "./wave";

const base: WaveInput = { direction: "ltr", figures: 3, gapMs: 160, offsetMs: 200, reduced: false, maskMs: 480 };
const ltr = (over: Partial<WaveInput> = {}) => waveSchedule({ ...base, ...over });
const rtl = (over: Partial<WaveInput> = {}) => waveSchedule({ ...base, direction: "rtl", ...over });
const names = (input: ReturnType<typeof waveSchedule>) => waveEvents(input).map((e) => e.name);

describe("the wave going to Tokens (left to right)", () => {
  it("switches the bars first, starts each figure a gap after the last from the offset, and masks the band in after them", () => {
    const wave = ltr();
    expect(wave.barsAtMs).toBe(0);
    expect(wave.figureAtMs).toEqual([200, 360, 520]);
    expect(wave.bandAtMs).toBe(680);
    expect(wave.endMs).toBe(1480);
    expect(wave.instant).toBe(false);
    expect(names(wave)).toEqual(["bars", "figure-0", "figure-1", "figure-2", "band-in"]);
  });

  it("follows the gap and the offset the lab sets", () => {
    const wave = ltr({ gapMs: 200, offsetMs: 0, figures: 3 });
    expect(wave.figureAtMs).toEqual([0, 200, 400]);
    expect(wave.bandAtMs).toBe(600);
    expect(ltr({ offsetMs: 500 }).figureAtMs[0]).toBe(500);
  });

  it("ends when the last figure has masked out and in, which is after the band's own mask", () => {
    expect(ltr().endMs).toBe(520 + 2 * 480);
    expect(ltr({ gapMs: 400, offsetMs: 0 }).endMs).toBe(800 + 2 * 480);
  });

  it("with no gap moves every figure and the band together after the offset, still in order", () => {
    const wave = ltr({ gapMs: 0 });
    expect(wave.figureAtMs).toEqual([200, 200, 200]);
    expect(wave.bandAtMs).toBe(200);
    expect(names(wave)).toEqual(["bars", "figure-0", "figure-1", "figure-2", "band-in"]);
  });
});

describe("the wave coming back to Commits (right to left)", () => {
  it("starts at the last figure, goes up the column, masks the band out, then switches the bars", () => {
    const wave = rtl();
    expect(wave.figureAtMs).toEqual([320, 160, 0]);
    expect(wave.bandAtMs).toBe(480);
    expect(wave.barsAtMs).toBe(680);
    expect(wave.endMs).toBe(1280);
    expect(names(wave)).toEqual(["figure-2", "figure-1", "figure-0", "band-out", "bars"]);
  });

  it("runs the figures the opposite way to the way there, the band after them in both, the bars on the far end", () => {
    const there = names(ltr());
    const back = names(rtl());
    expect(there.slice(1, 4)).toEqual([...back.slice(0, 3)].reverse());
    expect(there[0]).toBe("bars");
    expect(back.at(-1)).toBe("bars");
  });

  it("puts the bars the offset after the band, and a zero offset starts the bars with the band", () => {
    expect(rtl({ offsetMs: 0 }).barsAtMs).toBe(rtl({ offsetMs: 0 }).bandAtMs);
    expect(rtl({ offsetMs: 400 }).barsAtMs).toBe(480 + 400);
  });

  it("with no gap starts every figure and the band at 0 and the bars at the offset", () => {
    const wave = rtl({ gapMs: 0 });
    expect(wave.figureAtMs).toEqual([0, 0, 0]);
    expect(wave.bandAtMs).toBe(0);
    expect(wave.barsAtMs).toBe(200);
    expect(names(wave)).toEqual(["figure-2", "figure-1", "figure-0", "band-out", "bars"]);
  });

  it("ends when the last of the first figure's mask, the band's mask and the bars' switch is done", () => {
    expect(rtl({ offsetMs: 1000 }).endMs).toBe(480 + 1000);
    expect(rtl({ offsetMs: 0 }).endMs).toBe(320 + 2 * 480);
  });
});

describe("the house reveal", () => {
  it("runs each mask at the length and ease of the card modal's mask-in", () => {
    expect(WAVE_MASK_MS).toBe(GALLERY.mask.lengthMs);
    expect(WAVE_EASE).toBe(GALLERY.ease.gsap);
    expect(TOKENS.maskMs).toBe(GALLERY.mask.lengthMs);
  });
});

describe("reduced motion", () => {
  it("swaps everything at once in either direction, with nothing to mask", () => {
    for (const make of [ltr, rtl]) {
      const wave = make({ reduced: true });
      expect(wave).toMatchObject({ barsAtMs: 0, figureAtMs: [0, 0, 0], bandAtMs: 0, endMs: 0, instant: true });
    }
  });
});

describe("the schedule", () => {
  it("clamps negative timings to zero and follows the figure count", () => {
    expect(ltr({ gapMs: -50, offsetMs: -10 }).figureAtMs).toEqual([0, 0, 0]);
    expect(ltr({ figures: 4 }).figureAtMs).toHaveLength(4);
    expect(rtl({ figures: 2 }).figureAtMs).toEqual([160, 0]);
  });
});
