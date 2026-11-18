import { afterEach, describe, expect, it, vi } from "vitest";
import { setSpotlightUp, spotlightUp, subscribeSpotlight } from "@/lib/home/spotlight";

describe("the spotlight store", () => {
  afterEach(() => setSpotlightUp(false));

  it("starts down and reads back what was set", () => {
    expect(spotlightUp()).toBe(false);
    setSpotlightUp(true);
    expect(spotlightUp()).toBe(true);
  });

  it("notifies on a change only, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSpotlight(listener);
    setSpotlightUp(true);
    setSpotlightUp(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setSpotlightUp(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setSpotlightUp(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
