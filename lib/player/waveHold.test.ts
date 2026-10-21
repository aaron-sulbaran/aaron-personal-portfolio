import { describe, expect, it } from "vitest";
import { bandAway, checkRelease, createWaveHold, dropHold, pressAnswer } from "./waveHold";

const VIEWPORT = 900;
const rect = (bottom: number) => ({ top: bottom - 270, bottom });

describe("the wave waiting after an answer", () => {
  it("is away once the band's bottom edge is above the line, and not before", () => {
    expect(bandAway(rect(360), VIEWPORT, 0.4)).toBe(true);
    expect(bandAway(rect(361), VIEWPORT, 0.4)).toBe(false);
    expect(bandAway(rect(600), VIEWPORT, 0.4)).toBe(false);
    expect(bandAway(rect(360), VIEWPORT, 0.3)).toBe(false);
  });

  it("sends the ripple at once with no wait set, as production does", () => {
    const hold = createWaveHold();
    expect(pressAnswer(hold, null, false)).toEqual({ startRipple: true });
    expect(hold.on).toBe(false);
  });

  it("sends the ripple at once when the band is already scrolled away", () => {
    const hold = createWaveHold();
    expect(pressAnswer(hold, 0.4, true)).toEqual({ startRipple: true });
    expect(hold.on).toBe(false);
  });

  it("holds the wave and keeps the ripple back while the band is in view", () => {
    const hold = createWaveHold();
    expect(pressAnswer(hold, 0.4, false)).toEqual({ startRipple: false });
    expect(hold).toEqual({ on: true, ripple: true });
    expect(checkRelease(hold, false)).toEqual({ released: false, startRipple: false });
    expect(hold.on).toBe(true);
  });

  it("releases once, with the kept ripple, when the band has scrolled away", () => {
    const hold = createWaveHold();
    pressAnswer(hold, 0.4, false);
    expect(checkRelease(hold, true)).toEqual({ released: true, startRipple: true });
    expect(checkRelease(hold, true)).toEqual({ released: false, startRipple: false });
    expect(hold.on).toBe(false);
  });

  it("drops a hold without a ripple when the wait is switched off", () => {
    const hold = createWaveHold();
    pressAnswer(hold, 0.4, false);
    expect(dropHold(hold)).toBe(true);
    expect(hold).toEqual({ on: false, ripple: false });
    expect(dropHold(hold)).toBe(false);
  });

  it("holds again for a later answer pressed back in the band", () => {
    const hold = createWaveHold();
    pressAnswer(hold, 0.4, false);
    checkRelease(hold, true);
    pressAnswer(hold, 0.4, false);
    expect(hold.on).toBe(true);
  });
});
