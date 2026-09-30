import { afterEach, describe, expect, it, vi } from "vitest";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
    data,
  };
}

async function load(storage: ReturnType<typeof fakeStorage>) {
  vi.resetModules();
  vi.stubGlobal("sessionStorage", storage);
  return import("@/lib/home/seen");
}

describe("seen store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the ring's existing key, so seen carries across heroes", async () => {
    const storage = fakeStorage({ "aaron-explored-tiles": JSON.stringify(["drum-major", 7]) });
    const seen = await load(storage);
    expect(seen.SEEN_STORAGE_KEY).toBe("aaron-explored-tiles");
    expect(Array.from(seen.getSeen())).toEqual(["drum-major"]);
    expect(seen.isSeen("drum-major")).toBe(true);
  });

  it("marks once, persists, notifies, and keeps a stable snapshot between changes", async () => {
    const storage = fakeStorage();
    const seen = await load(storage);
    const listener = vi.fn();
    seen.subscribeSeen(listener);
    const before = seen.getSeen();
    expect(seen.getSeen()).toBe(before);
    seen.markSeen("mt-fuji");
    seen.markSeen("mt-fuji");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(seen.getSeen()).not.toBe(before);
    expect(JSON.parse(storage.data.get("aaron-explored-tiles") ?? "[]")).toEqual(["mt-fuji"]);
  });

  it("survives corrupt storage", async () => {
    const storage = fakeStorage({ "aaron-explored-tiles": "{not json" });
    const seen = await load(storage);
    expect(seen.getSeen().size).toBe(0);
    seen.markSeen("misuki");
    expect(seen.isSeen("misuki")).toBe(true);
  });
});
