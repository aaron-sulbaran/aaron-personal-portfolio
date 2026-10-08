import { describe, expect, it } from "vitest";
import type { StillTheme } from "@/lib/coil/heroStill";
import { STILL_OFF, createStillReadiness } from "@/lib/home/stillReadiness";

type Deferred = { theme: StillTheme; resolve: () => void; reject: () => void; promise: Promise<void> };

// A store over a fake decode: each call is a deferred the test settles.
function setup({ gaveUp = false, motion = true } = {}) {
  const calls: Deferred[] = [];
  const flags = { gaveUp, motion };
  const store = createStillReadiness({
    decode: (theme) => {
      let resolve = () => {};
      let reject = () => {};
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = () => rej(new Error("no still"));
      });
      promise.catch(() => undefined);
      calls.push({ theme, resolve, reject, promise });
      return promise;
    },
    gaveUp: () => flags.gaveUp,
    motion: () => flags.motion,
  });
  const views: string[] = [];
  store.subscribe(() => views.push(JSON.stringify(store.view())));
  return { store, calls, flags, views, decodes: (theme: StillTheme) => calls.filter((c) => c.theme === theme).length };
}
const flush = () => new Promise((done) => setTimeout(done, 0));

describe("the hero still's readiness, per theme", () => {
  it("is off until the current theme's still decodes, then ready and warm", async () => {
    const { store, calls } = setup();
    expect(store.view()).toBe(STILL_OFF);
    store.show("light");
    expect(calls.map((c) => c.theme)).toEqual(["light"]);
    expect(store.view().ready).toBe(false);
    calls[0].resolve();
    await flush();
    expect(store.view()).toEqual({ ready: true, late: false, warm: true });
  });

  it("warms the other theme once the current one is ready, and only once", async () => {
    const { store, calls, decodes } = setup();
    store.show("light");
    calls[0].resolve();
    await flush();
    expect(decodes("dark"), "the other theme's decode starts").toBe(1);
    store.show("light");
    expect(decodes("dark"), "no second warm while it is in flight").toBe(1);
    expect(decodes("light"), "a ready theme never decodes again").toBe(1);
  });

  it("a toggle to a ready theme keeps the still, no late arrival", async () => {
    const { store, calls } = setup();
    store.show("light");
    calls[0].resolve();
    await flush();
    calls[1].resolve();
    await flush();
    store.show("dark");
    expect(store.view()).toEqual({ ready: true, late: false, warm: true });
    store.show("light");
    expect(store.view()).toEqual({ ready: true, late: false, warm: true });
  });

  it("a toggle to a theme not yet ready drops the still at once; its arrival is late", async () => {
    const { store, calls } = setup();
    store.show("light");
    calls[0].resolve();
    await flush();
    store.show("dark");
    expect(store.view().ready, "the h1 lockup returns the moment the theme changes").toBe(false);
    calls[1].resolve();
    await flush();
    expect(store.view()).toEqual({ ready: true, late: true, warm: true });
    store.settle();
    expect(store.view()).toEqual({ ready: true, late: false, warm: true });
  });

  it("a first arrival after the loader's give-up is late; before it, not", async () => {
    const before = setup();
    before.store.show("light");
    before.calls[0].resolve();
    await flush();
    expect(before.store.view().late).toBe(false);

    const after = setup();
    after.store.show("light");
    after.flags.gaveUp = true;
    after.calls[0].resolve();
    await flush();
    expect(after.store.view()).toEqual({ ready: true, late: true, warm: true });
  });

  it("never late under reduced motion: the still takes the hero at once", async () => {
    const { store, calls } = setup({ gaveUp: true, motion: false });
    store.show("light");
    calls[0].resolve();
    await flush();
    expect(store.view()).toEqual({ ready: true, late: false, warm: true });
  });

  it("a late dissolve cut short by a toggle to a theme not ready ends with it", async () => {
    const { store, calls } = setup({ gaveUp: true });
    store.show("light");
    calls[0].resolve();
    await flush();
    expect(store.view().late).toBe(true);
    calls[1].reject();
    await flush();
    store.show("dark");
    expect(store.view()).toEqual({ ready: false, late: false, warm: true });
  });

  it("remembers no failure: a rejected decode is retried on the next need", async () => {
    const { store, calls, decodes } = setup();
    store.show("light");
    calls[0].reject();
    await flush();
    expect(store.view().ready).toBe(false);
    store.show("light");
    expect(decodes("light"), "the next need decodes again").toBe(2);
    calls[1].resolve();
    await flush();
    expect(store.view().ready).toBe(true);
  });

  it("a warm that fails is retried when its theme is shown", async () => {
    const { store, calls, decodes } = setup();
    store.show("light");
    calls[0].resolve();
    await flush();
    calls[1].reject();
    await flush();
    store.show("dark");
    expect(decodes("dark")).toBe(2);
    expect(store.view().ready).toBe(false);
    calls[2].resolve();
    await flush();
    expect(store.view()).toEqual({ ready: true, late: true, warm: true });
  });

  it("decoded() is the current theme's decode in flight, never a second one", async () => {
    const { store, calls, decodes } = setup();
    store.show("light");
    const decoded = store.decoded();
    expect(decodes("light")).toBe(1);
    calls[0].resolve();
    await expect(decoded).resolves.toBeUndefined();
  });

  it("decoded() rejects with a failed decode, and the next call decodes again", async () => {
    const { store, calls, decodes } = setup();
    store.show("light");
    const first = store.decoded();
    calls[0].reject();
    await expect(first).rejects.toThrow();
    store.decoded();
    expect(decodes("light")).toBe(2);
  });

  it("each arrival counts for its own theme, and is late once a still has shown", async () => {
    const { store, calls, views } = setup();
    store.show("light");
    store.show("dark");
    calls[1].resolve();
    await flush();
    expect(store.view().ready).toBe(true);
    store.show("light");
    expect(store.view().ready).toBe(false);
    const seen = views.length;
    calls[0].resolve();
    await flush();
    expect(views.length, "one change for the light arrival").toBe(seen + 1);
    expect(store.view()).toEqual({ ready: true, late: true, warm: true });
  });

  it("keeps one view object while nothing changes, and tells listeners only of changes", async () => {
    const { store, calls, views } = setup();
    store.show("light");
    const view = store.view();
    store.show("light");
    expect(store.view()).toBe(view);
    expect(views).toEqual([]);
    calls[0].resolve();
    await flush();
    expect(views).toEqual([JSON.stringify({ ready: true, late: false, warm: true })]);
  });
});
