import { describe, expect, it, vi } from "vitest";
import { STILL_NOTICE_KEY, createStillNoticeStore } from "@/lib/home/stillNotice";

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
}
const blockedStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("still notice store", () => {
  it("is not dismissed by default", () => {
    expect(createStillNoticeStore(memoryStorage()).dismissed()).toBe(false);
  });
  it("remembers a dismissal across visits and notifies once", () => {
    const storage = memoryStorage();
    const store = createStillNoticeStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dismiss();
    store.dismiss();
    expect(store.dismissed()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(storage.getItem(STILL_NOTICE_KEY)).toBe("1");
    expect(createStillNoticeStore(storage).dismissed()).toBe(true);
  });
  it("works in memory when storage is missing or throws", () => {
    for (const storage of [null, blockedStorage]) {
      const store = createStillNoticeStore(storage);
      expect(store.dismissed()).toBe(false);
      expect(() => store.dismiss()).not.toThrow();
      expect(store.dismissed()).toBe(true);
    }
  });
});
