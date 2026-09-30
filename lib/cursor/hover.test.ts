import { describe, expect, it, vi } from "vitest";
import { HINT_OPENED_KEY, createHintStore, getSceneHover, setSceneHover, subscribeSceneHover } from "@/lib/cursor/hover";

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

// A Storage stand-in: a map, or one that throws like a blocked or private one.
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}
const blockedStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("first-visit hint store", () => {
  it("starts unopened, remembers the first open across visits, and notifies once", () => {
    const storage = memoryStorage();
    const store = createHintStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.opened()).toBe(false);
    store.markOpened();
    store.markOpened();
    expect(store.opened()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(storage.getItem(HINT_OPENED_KEY)).toBe("1");
    expect(createHintStore(storage).opened()).toBe(true);
  });

  it("works in memory when storage is missing or throws", () => {
    for (const storage of [null, blockedStorage]) {
      const store = createHintStore(storage);
      expect(store.opened()).toBe(false);
      expect(() => store.markOpened()).not.toThrow();
      expect(store.opened()).toBe(true);
      expect(store.takeOnce("aaron-hint-tap")).toBe(true);
      expect(store.takeOnce("aaron-hint-tap")).toBe(false);
    }
  });

  it("hands out a once-ever line exactly once, across visits", () => {
    const storage = memoryStorage();
    expect(createHintStore(storage).takeOnce("aaron-hint-tap")).toBe(true);
    const next = createHintStore(storage);
    expect(next.takeOnce("aaron-hint-tap")).toBe(false);
    expect(next.opened()).toBe(false);
  });
});
