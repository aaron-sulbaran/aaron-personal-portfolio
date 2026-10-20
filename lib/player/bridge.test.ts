import { afterEach, describe, expect, it, vi } from "vitest";
import { pillReached, resetBridge, setBridge, TODAY, subscribeBridge } from "./bridge";

describe("what the lab can change in the real pill and band", () => {
  afterEach(() => resetBridge());

  it("reads as today until something writes it", () => {
    expect(TODAY).toEqual({ pill: "auto", credit: "band" });
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
    resetBridge();
    off();
    expect(seen).toHaveBeenCalledTimes(3);
  });
});
