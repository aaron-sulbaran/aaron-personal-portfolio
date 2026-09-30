import { beforeEach, describe, expect, it, vi } from "vitest";

// Fresh module state per test: the store is module-level by design.
async function load() {
  vi.resetModules();
  return import("@/lib/home/readiness");
}

describe("home readiness store", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts at pre with no hero, and a page without a hero never waits", async () => {
    const r = await load();
    expect(r.getHomeReadiness()).toBe("pre");
    expect(r.hasHomeHero()).toBe(false);
    const onReady = vi.fn();
    r.whenHomeReady(onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("waits for ready while a hero owns the store, then fires once", async () => {
    const r = await load();
    const release = r.claimHomeReadiness();
    const onReady = vi.fn();
    r.whenHomeReady(onReady);
    r.publishHomeReadiness("entering");
    expect(onReady).not.toHaveBeenCalled();
    r.publishHomeReadiness("ready");
    r.publishHomeReadiness("entering");
    r.publishHomeReadiness("ready");
    expect(onReady).toHaveBeenCalledTimes(1);
    release();
  });

  it("notifies subscribers only on real changes and resets when the owner leaves", async () => {
    const r = await load();
    const release = r.claimHomeReadiness();
    const listener = vi.fn();
    const unsubscribe = r.subscribeHomeReadiness(listener);
    r.publishHomeReadiness("ready");
    r.publishHomeReadiness("ready");
    expect(listener).toHaveBeenCalledTimes(1);
    release();
    release();
    expect(r.getHomeReadiness()).toBe("pre");
    expect(r.hasHomeHero()).toBe(false);
    unsubscribe();
  });

  it("a cancelled wait never fires", async () => {
    const r = await load();
    r.claimHomeReadiness();
    const onReady = vi.fn();
    const cancel = r.whenHomeReady(onReady);
    cancel();
    r.publishHomeReadiness("ready");
    expect(onReady).not.toHaveBeenCalled();
  });
});
