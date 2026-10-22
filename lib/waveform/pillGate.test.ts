import { describe, expect, it } from "vitest";
import { pillReached } from "@/lib/waveform/pillGate";

const base = { bandPassed: false, promptPassed: false, promptOnScreen: false };

describe("when the stock pill may show", () => {
  it("stays hidden while the unanswered prompt is on screen", () => {
    expect(pillReached({ music: "before", bandPassed: false, promptPassed: false, promptOnScreen: true })).toBe(false);
    // Even with the band's own edge past: the prompt rules the first ask.
    expect(pillReached({ music: "before", bandPassed: true, promptPassed: false, promptOnScreen: true })).toBe(false);
  });

  it("stays hidden before the reader reaches the prompt", () => {
    expect(pillReached({ music: "before", ...base })).toBe(false);
  });

  it("stays hidden while the prompt has only partly left (its bottom is above the dock line but it is still in view)", () => {
    expect(pillReached({ music: "before", bandPassed: false, promptPassed: true, promptOnScreen: true })).toBe(false);
  });

  it("appears once the prompt has scrolled away, unanswered", () => {
    expect(pillReached({ music: "before", bandPassed: false, promptPassed: true, promptOnScreen: false })).toBe(true);
  });

  it("goes again when the prompt comes back into view", () => {
    expect(pillReached({ music: "before", bandPassed: true, promptPassed: true, promptOnScreen: true })).toBe(false);
  });

  it("follows the band, as before, once the question is answered", () => {
    for (const music of ["on", "paused", "off"] as const) {
      expect(pillReached({ music, bandPassed: false, promptPassed: true, promptOnScreen: false })).toBe(false);
      expect(pillReached({ music, bandPassed: true, promptPassed: false, promptOnScreen: true })).toBe(true);
    }
  });
});
