import { describe, expect, it, vi } from "vitest";
import { QUEST } from "./constants";
import { ALL_QUEST_IDS, isQuestId, questIds } from "./registry";
import { createQuestStore } from "./store";

function memoryStorage(initial?: string): Storage {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(QUEST.storageKey, initial);
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const make = (storage: Storage | null, today = () => "2026-11-06") => createQuestStore({ storage: () => storage, knownId: isQuestId, today });
const stored = (storage: Storage) => JSON.parse(storage.getItem(QUEST.storageKey) ?? "null");

describe("quest store", () => {
  it("records a find at the current clock and persists it at once", () => {
    const storage = memoryStorage();
    const store = make(storage);
    store.addClock(1500);
    expect(store.markFound("card:talos")).toBe(true);
    expect(store.getSnapshot().found).toEqual({ "card:talos": 1500 });
    expect(stored(storage)).toMatchObject({ v: 1, found: { "card:talos": 1500 }, clockMs: 1500 });
  });

  it("ignores unknown and already-found ids", () => {
    const store = make(memoryStorage());
    expect(store.markFound("card:nope")).toBe(false);
    expect(store.markFound("egg:logo")).toBe(true);
    store.addClock(900);
    expect(store.markFound("egg:logo")).toBe(false);
    expect(store.getSnapshot().found).toEqual({ "egg:logo": 0 });
  });

  it("keeps one snapshot object until something changes", () => {
    const store = make(memoryStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    store.markFound("egg:logo");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(first);
    store.markFound("egg:logo");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const store = make(memoryStorage());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.markFound("egg:logo");
    expect(listener).not.toHaveBeenCalled();
  });

  it("records a finish once, when a category completes, and never overwrites it", () => {
    const store = make(memoryStorage());
    questIds("cards").slice(0, 5).forEach((id) => store.markFound(id));
    questIds("pops").slice(0, 3).forEach((id) => store.markFound(id));
    store.addClock(60_000);
    store.markFound("egg:period");
    expect(store.getSnapshot().finishes).toEqual({ any: { ms: 60_000, date: "2026-11-06" } });
    store.addClock(60_000);
    ALL_QUEST_IDS.forEach((id) => store.markFound(id));
    expect(store.getSnapshot().finishes.any).toEqual({ ms: 60_000, date: "2026-11-06" });
    expect(store.getSnapshot().finishes.full).toEqual({ ms: 120_000, date: "2026-11-06" });
  });

  it("addClock notifies but does not write storage; persist does", () => {
    const storage = memoryStorage();
    const store = make(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    store.addClock(2000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(storage.getItem(QUEST.storageKey)).toBeNull();
    store.persist();
    expect(stored(storage).clockMs).toBe(2000);
  });

  it("reads saved progress, dropping unknown ids and bad numbers", () => {
    const raw = JSON.stringify({
      v: 1,
      found: { "card:talos": 5, "card:nope": 1, "egg:logo": "x", "egg:period": null, "mvp:quick": -3 },
      clockMs: 9000,
      finishes: { any: { ms: 100, date: "2026-11-01" }, full: { ms: "no", date: "2026-11-01" } },
    });
    const state = make(memoryStorage(raw)).getSnapshot();
    expect(state.found).toEqual({ "card:talos": 5 });
    expect(state.clockMs).toBe(9000);
    expect(state.finishes).toEqual({ any: { ms: 100, date: "2026-11-01" } });
  });

  it("starts fresh on corrupt JSON or another version", () => {
    expect(make(memoryStorage("{nope")).getSnapshot().found).toEqual({});
    expect(make(memoryStorage(JSON.stringify({ v: 2, found: { "card:talos": 1 }, clockMs: 5, finishes: {} }))).getSnapshot()).toMatchObject({ found: {}, clockMs: 0 });
    expect(make(memoryStorage("[]")).getSnapshot().clockMs).toBe(0);
  });

  it("degrades to memory when storage is missing or throws", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    for (const store of [make(null), make(blocked)]) {
      expect(store.markFound("egg:logo")).toBe(true);
      store.addClock(10);
      expect(() => store.persist()).not.toThrow();
      expect(store.getSnapshot().found).toHaveProperty("egg:logo");
      expect(() => store.reset()).not.toThrow();
    }
    const throwing = createQuestStore({ storage: () => { throw new Error("no"); }, knownId: isQuestId });
    expect(throwing.markFound("egg:logo")).toBe(true);
  });

  it("reload picks up another tab's write, and reset clears everything", () => {
    const storage = memoryStorage();
    const store = make(storage);
    const other = make(storage);
    other.markFound("egg:period");
    const listener = vi.fn();
    store.subscribe(listener);
    store.reload();
    expect(store.getSnapshot().found).toHaveProperty("egg:period");
    expect(listener).toHaveBeenCalled();
    store.reset();
    expect(store.getSnapshot().found).toEqual({});
    expect(storage.getItem(QUEST.storageKey)).toBeNull();
  });
});
