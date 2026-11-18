import { describe, expect, it, vi } from "vitest";
import { HINT_OPENED_KEY, MARK_HOLD_IDLE, createHintStore, getMarkHold, getSceneHover, setMarkHold, setSceneHover, subscribeMarkHold, subscribeSceneHover } from "@/lib/cursor/hover";

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
    removeItem: (key: string) => void map.delete(key),
  };
}
const blockedStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
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
      expect(store.takeOnce("aaron-hint-keep")).toBe(true);
      expect(store.takeOnce("aaron-hint-keep")).toBe(false);
    }
  });

  it("hands out a once-ever line exactly once, across visits", () => {
    const storage = memoryStorage();
    expect(createHintStore(storage).takeOnce("aaron-hint-keep")).toBe(true);
    const next = createHintStore(storage);
    expect(next.takeOnce("aaron-hint-keep")).toBe(false);
    expect(next.opened()).toBe(false);
  });
});

describe("the mark's hold", () => {
  it("publishes the hold and notifies only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMarkHold(listener);
    setMarkHold({ fill: 0.5, spent: 0, hidden: false });
    setMarkHold({ fill: 0.5, spent: 0, hidden: false });
    expect(getMarkHold().fill).toBe(0.5);
    setMarkHold(MARK_HOLD_IDLE);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("hint store forget", () => {
  it("forget clears the first open and tells the hint listeners (the lab's First visit again)", () => {
    const storage = memoryStorage();
    storage.setItem(HINT_OPENED_KEY, "1");
    const store = createHintStore(storage);
    const heard = vi.fn();
    store.subscribe(heard);
    store.forget();
    expect(store.opened()).toBe(false);
    expect(storage.getItem(HINT_OPENED_KEY)).toBeNull();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("forget on blocked storage still clears this page's memory and never throws", () => {
    const no = () => {
      throw new Error("blocked");
    };
    const store = createHintStore({ getItem: no, setItem: no, removeItem: no });
    store.markOpened();
    expect(() => store.forget()).not.toThrow();
    expect(store.opened()).toBe(false);
  });
});
