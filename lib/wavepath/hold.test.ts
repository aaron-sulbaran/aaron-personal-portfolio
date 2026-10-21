import { describe, expect, it } from "vitest";
import { RELEASE_LINE } from "./constants";
import { bandAway, checkRelease, createWaveHold, pressAnswer } from "./hold";

const VIEWPORT = 900;
const rect = (bottom: number) => ({ top: bottom - 270, bottom });

describe("the wave waiting after an answer", () => {
  it("releases at 0.40 of the viewport, one fraction for every screen", () => {
    expect(RELEASE_LINE).toBe(0.4);
  });

  it("is away once the band's bottom edge is above the line, and not before", () => {
    expect(bandAway(rect(360), VIEWPORT, RELEASE_LINE)).toBe(true);
    expect(bandAway(rect(361), VIEWPORT, RELEASE_LINE)).toBe(false);
    expect(bandAway(rect(600), VIEWPORT, RELEASE_LINE)).toBe(false);
  });

  it("reads the line against the viewport's height, not any page offset", () => {
    expect(bandAway(rect(0.4 * 700), 700, RELEASE_LINE)).toBe(true);
    expect(bandAway(rect(0.4 * 700 + 1), 700, RELEASE_LINE)).toBe(false);
    expect(bandAway(rect(0.4 * 1400), 1400, RELEASE_LINE)).toBe(true);
  });

  it("sends the ripple at once when the band is already scrolled away", () => {
    const hold = createWaveHold();
    expect(pressAnswer(hold, true)).toEqual({ startRipple: true });
    expect(hold.on).toBe(false);
  });

  it("holds the wave and keeps the ripple back while the band is in view", () => {
    const hold = createWaveHold();
    expect(pressAnswer(hold, false)).toEqual({ startRipple: false });
    expect(hold).toEqual({ on: true, ripple: true });
    expect(checkRelease(hold, false)).toEqual({ released: false, startRipple: false });
    expect(hold.on).toBe(true);
  });

  it("releases once, with the kept ripple, when the band has scrolled away", () => {
    const hold = createWaveHold();
    pressAnswer(hold, false);
    expect(checkRelease(hold, true)).toEqual({ released: true, startRipple: true });
    expect(checkRelease(hold, true)).toEqual({ released: false, startRipple: false });
    expect(hold.on).toBe(false);
  });

  it("holds again for a later answer pressed back in the band", () => {
    const hold = createWaveHold();
    pressAnswer(hold, false);
    checkRelease(hold, true);
    pressAnswer(hold, false);
    expect(hold.on).toBe(true);
  });
});
