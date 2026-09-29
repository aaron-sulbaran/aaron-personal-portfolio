import { describe, expect, it, vi } from "vitest";
import { getSceneHover, setSceneHover, subscribeSceneHover } from "@/lib/cursor/hover";

describe("scene hover store", () => {
  it("notifies only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneHover(listener);
    setSceneHover(true);
    setSceneHover(true);
    expect(getSceneHover()).toBe(true);
    setSceneHover(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setSceneHover(true);
    expect(listener).toHaveBeenCalledTimes(2);
    setSceneHover(false);
  });
});
