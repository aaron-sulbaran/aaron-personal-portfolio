import { afterEach, describe, expect, it, vi } from "vitest";
import { getBridge, pillReached, resetBridge, setBridge, TODAY, subscribeBridge } from "./bridge";

describe("what the lab can change in the real pill, band and wave", () => {
  afterEach(() => resetBridge());

  it("reads as today until something writes it", () => {
    expect(TODAY).toEqual({ pill: "auto", credit: "band", creditBelow: false, status: "today", notNow: "today", waveWait: null, idle: 0, labPill: false });
    expect(getBridge()).toBe(TODAY);
  });

  it("leaves the pill's own rule alone on auto, and overrides it otherwise", () => {
    expect(pillReached("auto", true)).toBe(true);
    expect(pillReached("auto", false)).toBe(false);
    expect(pillReached("hold", false)).toBe(true);
    expect(pillReached("away", true)).toBe(false);
  });

  it("tells subscribers about a change, and not about a repeat", () => {
    const seen = vi.fn();
    const off = subscribeBridge(seen);
    setBridge({ pill: "hold" });
    setBridge({ pill: "hold" });
    setBridge({ credit: "hidden" });
    setBridge({ creditBelow: true });
    setBridge({ waveWait: 0.4 });
    setBridge({ waveWait: 0.4 });
    setBridge({ status: "hidden", notNow: "buttons", idle: 1, labPill: true });
    resetBridge();
    off();
    expect(seen).toHaveBeenCalledTimes(6);
  });

  it("goes back to production's values on a reset", () => {
    setBridge({ status: "hidden", waveWait: 0.3 });
    resetBridge();
    expect(getBridge()).toEqual(TODAY);
  });
});
